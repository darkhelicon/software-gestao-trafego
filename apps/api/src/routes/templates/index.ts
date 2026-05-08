import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Prisma } from "@helzo-scale/database";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";
import { incrementQuota } from "../../middlewares/require-quota.js";
import { getCampaignQueue } from "../../lib/queues.js";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  platform: z.enum(["TIKTOK", "META"]),
  config: z.record(z.unknown()),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
});

const applyTemplateSchema = z.object({
  advertiserAccountId: z.string(),
  names: z.array(z.string().min(1).max(255)).min(1).max(50),
});

const readHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission("campaigns:read"),
];

const writeHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission("campaigns:write"),
];

export const templateRoutes: FastifyPluginAsync = async (app) => {
  // GET /templates?platform=TIKTOK|META
  app.get("/", { preHandler: readHandler }, async (request, reply) => {
    const { platform } = request.query as { platform?: string };

    const templates = await app.prisma.campaignTemplate.findMany({
      where: {
        organizationId: request.organizationId,
        isActive: true,
        ...(platform && { platform: platform as "TIKTOK" | "META" }),
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ success: true, data: templates });
  });

  // POST /templates
  app.post("/", { preHandler: writeHandler }, async (request, reply) => {
    const body = createTemplateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: "Validation error",
        details: body.error.flatten(),
      });
    }

    const template = await app.prisma.campaignTemplate.create({
      data: {
        organizationId: request.organizationId,
        name: body.data.name,
        platform: body.data.platform,
        config: body.data.config as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    return reply.status(201).send({ success: true, data: template });
  });

  // PUT /templates/:id
  app.put("/:id", { preHandler: writeHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateTemplateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: "Validation error",
        details: body.error.flatten(),
      });
    }

    const template = await app.prisma.campaignTemplate.findFirst({
      where: { id, organizationId: request.organizationId, isActive: true },
    });

    if (!template) {
      return reply
        .status(404)
        .send({ success: false, error: "Template not found" });
    }

    const updated = await app.prisma.campaignTemplate.update({
      where: { id },
      data: {
        ...(body.data.name !== undefined && { name: body.data.name }),
        ...(body.data.config !== undefined && { config: body.data.config as Prisma.InputJsonValue }),
      },
    });

    return reply.send({ success: true, data: updated });
  });

  // DELETE /templates/:id — soft delete
  app.delete("/:id", { preHandler: writeHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const template = await app.prisma.campaignTemplate.findFirst({
      where: { id, organizationId: request.organizationId, isActive: true },
    });

    if (!template) {
      return reply
        .status(404)
        .send({ success: false, error: "Template not found" });
    }

    await app.prisma.campaignTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return reply.status(204).send();
  });

  // POST /templates/:id/apply — bulk create campaigns from template
  app.post(
    "/:id/apply",
    { preHandler: writeHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = applyTemplateSchema.safeParse(request.body);

      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: body.error.flatten(),
        });
      }

      const template = await app.prisma.campaignTemplate.findFirst({
        where: { id, organizationId: request.organizationId, isActive: true },
      });

      if (!template) {
        return reply
          .status(404)
          .send({ success: false, error: "Template not found" });
      }

      const count = body.data.names.length;

      // Check quota
      const { getQuotaLimit, getQuotaUsed } = await import("../../lib/quota.js");
      const [limit, used] = await Promise.all([
        getQuotaLimit(app.prisma, request.planSlug, "campaigns_per_day"),
        getQuotaUsed(app.prisma, app.redis, request.organizationId, "campaigns_per_day"),
      ]);

      if (limit !== -1 && used + count > limit) {
        return reply.status(429).send({
          success: false,
          error: "Would exceed daily campaign quota",
          code: "QUOTA_EXCEEDED",
          limit,
          used,
          requested: count,
        });
      }

      // Validate advertiser account matches template platform
      const account = await app.prisma.advertiserAccount.findFirst({
        where: {
          id: body.data.advertiserAccountId,
          organizationId: request.organizationId,
          platform: template.platform,
          isActive: true,
        },
        include: { tiktokConnection: true, metaConnection: true },
      });

      if (!account) {
        return reply.status(404).send({
          success: false,
          error: `Advertiser account not found for platform ${template.platform}`,
        });
      }

      const connectionId =
        template.platform === "TIKTOK"
          ? account.tiktokConnection?.id
          : account.metaConnection?.id;

      if (!connectionId) {
        return reply.status(400).send({
          success: false,
          error: "Platform connection is inactive",
        });
      }

      const config = template.config as Record<string, unknown>;

      // Create job
      const job = await app.prisma.campaignJob.create({
        data: {
          organizationId: request.organizationId,
          platform: template.platform,
          status: "PENDING",
          totalItems: count,
          payload: { templateId: template.id },
        },
      });

      // Create one Campaign + CampaignJobItem per name
      const items = await Promise.all(
        body.data.names.map(async (name) => {
          const campaign = await app.prisma.campaign.create({
            data: {
              organizationId: request.organizationId,
              advertiserAccountId: account.id,
              platform: template.platform,
              name,
              status: "PENDING",
              ...(typeof config["budget"] === "number" ? { budget: config["budget"] } : {}),
              config: config as Prisma.InputJsonValue,
            },
          });

          const itemPayload =
            template.platform === "TIKTOK"
              ? {
                  campaignId: campaign.id,
                  advertiserId: account.externalId,
                  connectionId,
                  name,
                  objectiveType: config["objectiveType"] as string,
                  budgetMode: config["budgetMode"] as string,
                  budget: config["budget"] as number | undefined,
                }
              : {
                  campaignId: campaign.id,
                  accountId: account.externalId,
                  connectionId,
                  name,
                  objective: config["objective"] as string,
                  budgetType: config["budgetType"] as string,
                  budget: config["budget"] as number | undefined,
                  status: (config["status"] as string) ?? "ACTIVE",
                };

          const item = await app.prisma.campaignJobItem.create({
            data: { jobId: job.id, status: "PENDING", payload: itemPayload as Prisma.InputJsonValue },
          });

          return { campaign, item };
        })
      );

      // Enqueue all items in parallel
      const queueEvent =
        template.platform === "TIKTOK"
          ? "tiktok.campaign.create"
          : "meta.campaign.create";

      await Promise.all(
        items.map(({ campaign, item }) =>
          getCampaignQueue(app.redis).add(
            queueEvent,
            {
              jobId: job.id,
              itemId: item.id,
              organizationId: request.organizationId,
              platform: template.platform,
            },
            { jobId: `campaign-${campaign.id}` }
          )
        )
      );

      await incrementQuota(request, "campaigns_per_day", count);

      return reply.status(202).send({
        success: true,
        data: {
          jobId: job.id,
          totalItems: count,
          platform: template.platform,
        },
      });
    }
  );
};

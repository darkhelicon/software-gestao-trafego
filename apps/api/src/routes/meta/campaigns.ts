import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Prisma } from "@helzo-scale/database";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
  requireQuota,
} from "../../middlewares/index.js";
import { incrementQuota } from "../../middlewares/require-quota.js";
import { createAuditLog } from "../../lib/audit.js";
import { getCampaignQueue } from "../../lib/queues.js";

const META_OBJECTIVES = [
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_APP_PROMOTION",
  "OUTCOME_SALES",
] as const;

const createCampaignSchema = z.object({
  advertiserAccountId: z.string(),
  name: z.string().min(1).max(255),
  objective: z.enum(META_OBJECTIVES),
  budgetType: z.enum(["daily", "lifetime"]),
  budget: z.number().positive().optional(),
  status: z.enum(["ACTIVE", "PAUSED"]).default("ACTIVE"),
});

const bulkCreateSchema = z.object({
  advertiserAccountId: z.string(),
  campaigns: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        objective: z.enum(META_OBJECTIVES),
        budgetType: z.enum(["daily", "lifetime"]),
        budget: z.number().positive().optional(),
        status: z.enum(["ACTIVE", "PAUSED"]).default("ACTIVE"),
      })
    )
    .min(1)
    .max(50),
});

const writePreHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission("campaigns:write"),
];

const readPreHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission("campaigns:read"),
];

export const metaCampaignRoutes: FastifyPluginAsync = async (app) => {
  // GET /meta/campaigns
  app.get("/", { preHandler: readPreHandler }, async (request, reply) => {
    const query = request.query as {
      advertiserAccountId?: string;
      status?: string;
      page?: string;
      pageSize?: string;
    };

    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const pageSize = Math.min(100, parseInt(query.pageSize ?? "20", 10));
    const skip = (page - 1) * pageSize;

    const where = {
      organizationId: request.organizationId,
      platform: "META" as const,
      ...(query.advertiserAccountId && {
        advertiserAccountId: query.advertiserAccountId,
      }),
      ...(query.status && {
        status: query.status as import("@helzo-scale/database").CampaignStatus,
      }),
    };

    const [campaigns, total] = await Promise.all([
      app.prisma.campaign.findMany({
        where,
        include: {
          advertiserAccount: {
            select: { id: true, name: true, externalId: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      app.prisma.campaign.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: {
        items: campaigns,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  });

  // POST /meta/campaigns
  app.post(
    "/",
    {
      preHandler: [
        ...writePreHandler,
        requireQuota("campaigns_per_day", 1),
      ],
    },
    async (request, reply) => {
      const body = createCampaignSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: body.error.flatten(),
        });
      }

      const account = await app.prisma.advertiserAccount.findFirst({
        where: {
          id: body.data.advertiserAccountId,
          organizationId: request.organizationId,
          platform: "META",
          isActive: true,
        },
        include: { metaConnection: true },
      });

      if (!account?.metaConnection) {
        return reply.status(404).send({
          success: false,
          error: "Advertiser account not found or Meta connection inactive",
        });
      }

      const campaign = await app.prisma.campaign.create({
        data: {
          organizationId: request.organizationId,
          advertiserAccountId: account.id,
          platform: "META",
          name: body.data.name,
          status: "PENDING",
          ...(body.data.budget !== undefined ? { budget: body.data.budget } : {}),
          config: {
            objective: body.data.objective,
            budgetType: body.data.budgetType,
            initialStatus: body.data.status,
          },
        },
      });

      const job = await app.prisma.campaignJob.create({
        data: {
          organizationId: request.organizationId,
          platform: "META",
          status: "PENDING",
          totalItems: 1,
          payload: { campaignId: campaign.id },
        },
      });

      const jobItem = await app.prisma.campaignJobItem.create({
        data: {
          jobId: job.id,
          status: "PENDING",
          payload: {
            campaignId: campaign.id,
            accountId: account.externalId,
            connectionId: account.metaConnection.id,
            name: body.data.name,
            objective: body.data.objective,
            budgetType: body.data.budgetType,
            budget: body.data.budget,
            status: body.data.status,
          },
        },
      });

      const bullJob = await getCampaignQueue(app.redis).add(
        "meta.campaign.create",
        {
          jobId: job.id,
          itemId: jobItem.id,
          organizationId: request.organizationId,
          platform: "META",
        },
        { jobId: `campaign-${campaign.id}` }
      );

      await app.prisma.campaignJob.update({
        where: { id: job.id },
        data: { bullJobId: bullJob.id ?? null },
      });

      await incrementQuota(request, "campaigns_per_day");

      await createAuditLog({
        prisma: app.prisma,
        organizationId: request.organizationId,
        userId: request.userId,
        action: "CAMPAIGN_CREATE",
        resource: "campaign",
        resourceId: campaign.id,
        metadata: { name: campaign.name, platform: "META" },
        ipAddress: request.ip,
      });

      return reply.status(202).send({
        success: true,
        data: { campaign, jobId: job.id },
      });
    }
  );

  // POST /meta/campaigns/bulk — multiple campaigns via single job
  app.post(
    "/bulk",
    { preHandler: writePreHandler },
    async (request, reply) => {
      const body = bulkCreateSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: body.error.flatten(),
        });
      }

      const count = body.data.campaigns.length;

      const { getQuotaLimit, getQuotaUsed } = await import("../../lib/quota.js");
      const [limit, used] = await Promise.all([
        getQuotaLimit(app.prisma, request.planSlug, "campaigns_per_day"),
        getQuotaUsed(app.prisma, app.redis, request.organizationId, "campaigns_per_day"),
      ]);

      if (limit !== -1 && used + count > limit) {
        return reply.status(429).send({
          success: false,
          error: "Bulk creation would exceed daily campaign quota",
          code: "QUOTA_EXCEEDED",
          limit,
          used,
          requested: count,
        });
      }

      const account = await app.prisma.advertiserAccount.findFirst({
        where: {
          id: body.data.advertiserAccountId,
          organizationId: request.organizationId,
          platform: "META",
          isActive: true,
        },
        include: { metaConnection: true },
      });

      if (!account?.metaConnection) {
        return reply.status(404).send({
          success: false,
          error: "Advertiser account not found or Meta connection inactive",
        });
      }

      const job = await app.prisma.campaignJob.create({
        data: {
          organizationId: request.organizationId,
          platform: "META",
          status: "PENDING",
          totalItems: count,
        },
      });

      const items = await Promise.all(
        body.data.campaigns.map(async (c) => {
          const campaign = await app.prisma.campaign.create({
            data: {
              organizationId: request.organizationId,
              advertiserAccountId: account.id,
              platform: "META",
              name: c.name,
              status: "PENDING",
              ...(c.budget !== undefined ? { budget: c.budget } : {}),
              config: {
                objective: c.objective,
                budgetType: c.budgetType,
                initialStatus: c.status,
              },
            },
          });

          const item = await app.prisma.campaignJobItem.create({
            data: {
              jobId: job.id,
              status: "PENDING",
              payload: {
                campaignId: campaign.id,
                accountId: account.externalId,
                connectionId: account.metaConnection!.id,
                name: c.name,
                objective: c.objective,
                budgetType: c.budgetType,
                budget: c.budget,
                status: c.status,
              },
            },
          });

          return { campaign, item };
        })
      );

      await Promise.all(
        items.map(({ campaign, item }) =>
          getCampaignQueue(app.redis).add(
            "meta.campaign.create",
            {
              jobId: job.id,
              itemId: item.id,
              organizationId: request.organizationId,
              platform: "META",
            },
            { jobId: `campaign-${campaign.id}` }
          )
        )
      );

      await incrementQuota(request, "campaigns_per_day", count);

      return reply.status(202).send({
        success: true,
        data: { jobId: job.id, totalItems: count },
      });
    }
  );

  // GET /meta/campaigns/jobs/:jobId
  app.get(
    "/jobs/:jobId",
    { preHandler: readPreHandler },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };

      const job = await app.prisma.campaignJob.findFirst({
        where: { id: jobId, organizationId: request.organizationId },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });

      if (!job) {
        return reply
          .status(404)
          .send({ success: false, error: "Job not found" });
      }

      return reply.send({ success: true, data: job });
    }
  );

  // PATCH /meta/campaigns/:id/pause
  app.patch(
    "/:id/pause",
    { preHandler: writePreHandler },
    async (request, reply) => {
      return updateMetaCampaignStatus(app, request, reply, "PAUSED");
    }
  );

  // PATCH /meta/campaigns/:id/resume
  app.patch(
    "/:id/resume",
    { preHandler: writePreHandler },
    async (request, reply) => {
      return updateMetaCampaignStatus(app, request, reply, "ACTIVE");
    }
  );

  // POST /meta/campaigns/:id/duplicate
  app.post(
    "/:id/duplicate",
    {
      preHandler: [
        ...writePreHandler,
        requireQuota("campaigns_per_day", 1),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { name?: string };

      const source = await app.prisma.campaign.findFirst({
        where: { id, organizationId: request.organizationId, platform: "META" },
        include: {
          advertiserAccount: { include: { metaConnection: true } },
        },
      });

      if (!source) {
        return reply
          .status(404)
          .send({ success: false, error: "Campaign not found" });
      }

      const newName = body.name ?? `${source.name} (cópia)`;
      const config = source.config as Record<string, unknown>;

      const duplicate = await app.prisma.campaign.create({
        data: {
          organizationId: request.organizationId,
          advertiserAccountId: source.advertiserAccountId,
          platform: "META",
          name: newName,
          status: "PENDING",
          budget: source.budget,
          config: source.config ?? Prisma.JsonNull,
        },
      });

      const job = await app.prisma.campaignJob.create({
        data: {
          organizationId: request.organizationId,
          platform: "META",
          status: "PENDING",
          totalItems: 1,
          payload: { campaignId: duplicate.id, duplicatedFrom: source.id },
        },
      });

      const jobItem = await app.prisma.campaignJobItem.create({
        data: {
          jobId: job.id,
          status: "PENDING",
          payload: {
            campaignId: duplicate.id,
            accountId: source.advertiserAccount.externalId,
            connectionId: source.advertiserAccount.metaConnection?.id,
            name: newName,
            objective: config["objective"],
            budgetType: config["budgetType"],
            budget: Number(source.budget),
            status: "ACTIVE",
          } as Prisma.InputJsonValue,
        },
      });

      await getCampaignQueue(app.redis).add(
        "meta.campaign.create",
        {
          jobId: job.id,
          itemId: jobItem.id,
          organizationId: request.organizationId,
          platform: "META",
        },
        { jobId: `campaign-${duplicate.id}` }
      );

      await incrementQuota(request, "campaigns_per_day");

      return reply.status(202).send({
        success: true,
        data: { campaign: duplicate, jobId: job.id },
      });
    }
  );
};

async function updateMetaCampaignStatus(
  app: import("fastify").FastifyInstance,
  request: import("fastify").FastifyRequest,
  reply: import("fastify").FastifyReply,
  metaStatus: "ACTIVE" | "PAUSED"
) {
  const { id } = request.params as { id: string };

  const campaign = await app.prisma.campaign.findFirst({
    where: { id, organizationId: request.organizationId, platform: "META" },
    include: {
      advertiserAccount: { include: { metaConnection: true } },
    },
  });

  if (!campaign) {
    return reply
      .status(404)
      .send({ success: false, error: "Campaign not found" });
  }

  if (!campaign.externalId) {
    return reply.status(400).send({
      success: false,
      error: "Campaign has not been created on Meta yet",
    });
  }

  const connection = campaign.advertiserAccount.metaConnection;
  if (!connection?.isActive) {
    return reply
      .status(400)
      .send({ success: false, error: "Meta connection is inactive" });
  }

  const { updateCampaignStatus: metaUpdate } = await import(
    "../../lib/meta-client.js"
  );

  try {
    await metaUpdate(
      connection.accessToken,
      campaign.externalId,
      metaStatus
    );
  } catch (err) {
    app.log.error({ err }, "Meta campaign status update failed");
    return reply.status(502).send({
      success: false,
      error: "Failed to update campaign status on Meta",
    });
  }

  const dbStatus = metaStatus === "ACTIVE" ? "ACTIVE" : "PAUSED";

  const updated = await app.prisma.campaign.update({
    where: { id },
    data: { status: dbStatus },
  });

  await createAuditLog({
    prisma: app.prisma,
    organizationId: request.organizationId,
    userId: (request as import("fastify").FastifyRequest & { userId: string })
      .userId,
    action: metaStatus === "ACTIVE" ? "CAMPAIGN_RESUME" : "CAMPAIGN_PAUSE",
    resource: "campaign",
    resourceId: id,
    ipAddress: request.ip,
  });

  return reply.send({ success: true, data: updated });
}

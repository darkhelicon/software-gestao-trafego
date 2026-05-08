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

const createCampaignSchema = z.object({
  advertiserAccountId: z.string(),
  name: z.string().min(1).max(255),
  objectiveType: z.string(),
  budgetMode: z.enum(["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL", "BUDGET_MODE_INFINITE"]),
  budget: z.number().positive().optional(),
});

const bulkCreateSchema = z.object({
  advertiserAccountId: z.string(),
  campaigns: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        objectiveType: z.string(),
        budgetMode: z.enum(["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL", "BUDGET_MODE_INFINITE"]),
        budget: z.number().positive().optional(),
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

export const tiktokCampaignRoutes: FastifyPluginAsync = async (app) => {
  // GET /tiktok/campaigns
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
      platform: "TIKTOK" as const,
      ...(query.advertiserAccountId && {
        advertiserAccountId: query.advertiserAccountId,
      }),
      ...(query.status && { status: query.status as import("@helzo-scale/database").CampaignStatus }),
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

  // POST /tiktok/campaigns — single campaign via queue
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
          platform: "TIKTOK",
          isActive: true,
        },
        include: { tiktokConnection: true },
      });

      if (!account?.tiktokConnection) {
        return reply.status(404).send({
          success: false,
          error: "Advertiser account not found or TikTok connection inactive",
        });
      }

      // Create campaign record in PENDING state
      const campaign = await app.prisma.campaign.create({
        data: {
          organizationId: request.organizationId,
          advertiserAccountId: account.id,
          platform: "TIKTOK",
          name: body.data.name,
          status: "PENDING",
          ...(body.data.budget !== undefined ? { budget: body.data.budget } : {}),
          config: {
            objectiveType: body.data.objectiveType,
            budgetMode: body.data.budgetMode,
          },
        },
      });

      // Create job record
      const job = await app.prisma.campaignJob.create({
        data: {
          organizationId: request.organizationId,
          platform: "TIKTOK",
          status: "PENDING",
          totalItems: 1,
          payload: { campaignId: campaign.id },
        },
      });

      // Create job item
      const jobItem = await app.prisma.campaignJobItem.create({
        data: {
          jobId: job.id,
          status: "PENDING",
          payload: {
            campaignId: campaign.id,
            advertiserId: account.externalId,
            connectionId: account.tiktokConnection.id,
            name: body.data.name,
            objectiveType: body.data.objectiveType,
            budgetMode: body.data.budgetMode,
            budget: body.data.budget,
          },
        },
      });

      // Enqueue
      const bullJob = await getCampaignQueue(app.redis).add(
        "tiktok.campaign.create",
        {
          jobId: job.id,
          itemId: jobItem.id,
          organizationId: request.organizationId,
          platform: "TIKTOK",
        },
        { jobId: `campaign-${campaign.id}` }
      );

      // Store BullMQ job ID
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
        metadata: { name: campaign.name, platform: "TIKTOK" },
        ipAddress: request.ip,
        ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}),
      });

      return reply.status(202).send({
        success: true,
        data: { campaign, jobId: job.id },
      });
    }
  );

  // POST /tiktok/campaigns/bulk — multiple campaigns via single job
  app.post(
    "/bulk",
    {
      preHandler: writePreHandler,
    },
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

      // Validate quota for all campaigns at once
      const { getQuotaLimit, getQuotaUsed } = await import("../../lib/quota.js");
      const [limit, used] = await Promise.all([
        getQuotaLimit(app.prisma, request.planSlug, "campaigns_per_day"),
        getQuotaUsed(app.prisma, app.redis, request.organizationId, "campaigns_per_day"),
      ]);

      if (limit !== -1 && used + count > limit) {
        return reply.status(429).send({
          success: false,
          error: `Bulk creation would exceed daily campaign quota`,
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
          platform: "TIKTOK",
          isActive: true,
        },
        include: { tiktokConnection: true },
      });

      if (!account?.tiktokConnection) {
        return reply.status(404).send({
          success: false,
          error: "Advertiser account not found or TikTok connection inactive",
        });
      }

      // Create job + all campaigns + all items atomically
      const { job, items } = await app.prisma.$transaction(async (tx) => {
        const job = await tx.campaignJob.create({
          data: {
            organizationId: request.organizationId,
            platform: "TIKTOK",
            status: "PENDING",
            totalItems: count,
          },
        });

        const items = await Promise.all(
          body.data.campaigns.map(async (c) => {
            const campaign = await tx.campaign.create({
              data: {
                organizationId: request.organizationId,
                advertiserAccountId: account.id,
                platform: "TIKTOK",
                name: c.name,
                status: "PENDING",
                ...(c.budget !== undefined ? { budget: c.budget } : {}),
                config: {
                  objectiveType: c.objectiveType,
                  budgetMode: c.budgetMode,
                },
              },
            });

            const item = await tx.campaignJobItem.create({
              data: {
                jobId: job.id,
                status: "PENDING",
                payload: {
                  campaignId: campaign.id,
                  advertiserId: account.externalId,
                  connectionId: account.tiktokConnection!.id,
                  name: c.name,
                  objectiveType: c.objectiveType,
                  budgetMode: c.budgetMode,
                  budget: c.budget,
                },
              },
            });

            return { campaign, item };
          })
        );

        return { job, items };
      });

      // Enqueue one BullMQ job per item (parallel processing)
      await Promise.all(
        items.map(({ campaign, item }) =>
          getCampaignQueue(app.redis).add(
            "tiktok.campaign.create",
            {
              jobId: job.id,
              itemId: item.id,
              organizationId: request.organizationId,
              platform: "TIKTOK",
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

  // GET /tiktok/campaigns/jobs/:jobId — poll job status
  app.get(
    "/jobs/:jobId",
    { preHandler: readPreHandler },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };

      const job = await app.prisma.campaignJob.findFirst({
        where: { id: jobId, organizationId: request.organizationId },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!job) {
        return reply
          .status(404)
          .send({ success: false, error: "Job not found" });
      }

      return reply.send({ success: true, data: job });
    }
  );

  // PATCH /tiktok/campaigns/:id/pause
  app.patch(
    "/:id/pause",
    { preHandler: writePreHandler },
    async (request, reply) => {
      return updateCampaignStatus(app, request, reply, "DISABLE");
    }
  );

  // PATCH /tiktok/campaigns/:id/resume
  app.patch(
    "/:id/resume",
    { preHandler: writePreHandler },
    async (request, reply) => {
      return updateCampaignStatus(app, request, reply, "ENABLE");
    }
  );

  // POST /tiktok/campaigns/:id/duplicate
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
        where: { id, organizationId: request.organizationId, platform: "TIKTOK" },
        include: {
          advertiserAccount: { include: { tiktokConnection: true } },
        },
      });

      if (!source) {
        return reply
          .status(404)
          .send({ success: false, error: "Campaign not found" });
      }

      const newName = body.name ?? `${source.name} (cópia)`;

      const duplicate = await app.prisma.campaign.create({
        data: {
          organizationId: request.organizationId,
          advertiserAccountId: source.advertiserAccountId,
          platform: "TIKTOK",
          name: newName,
          status: "PENDING",
          budget: source.budget,
          config: source.config ?? Prisma.JsonNull,
        },
      });

      const job = await app.prisma.campaignJob.create({
        data: {
          organizationId: request.organizationId,
          platform: "TIKTOK",
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
            advertiserId: source.advertiserAccount.externalId,
            connectionId: source.advertiserAccount.tiktokConnection?.id,
            name: newName,
            ...(source.config as Record<string, unknown>),
            budget: Number(source.budget),
          } as Prisma.InputJsonValue,
        },
      });

      const bullJob = await getCampaignQueue(app.redis).add(
        "tiktok.campaign.create",
        {
          jobId: job.id,
          itemId: jobItem.id,
          organizationId: request.organizationId,
          platform: "TIKTOK",
        },
        { jobId: `campaign-${duplicate.id}` }
      );

      await app.prisma.campaignJob.update({
        where: { id: job.id },
        data: { bullJobId: bullJob.id ?? null },
      });

      await incrementQuota(request, "campaigns_per_day");

      return reply.status(202).send({
        success: true,
        data: { campaign: duplicate, jobId: job.id },
      });
    }
  );
};

async function updateCampaignStatus(
  app: import("fastify").FastifyInstance,
  request: import("fastify").FastifyRequest,
  reply: import("fastify").FastifyReply,
  tiktokStatus: "ENABLE" | "DISABLE"
) {
  const { id } = request.params as { id: string };

  const campaign = await app.prisma.campaign.findFirst({
    where: { id, organizationId: request.organizationId, platform: "TIKTOK" },
    include: {
      advertiserAccount: { include: { tiktokConnection: true } },
    },
  });

  if (!campaign) {
    return reply.status(404).send({ success: false, error: "Campaign not found" });
  }

  if (!campaign.externalId) {
    return reply.status(400).send({
      success: false,
      error: "Campaign has not been created on TikTok yet",
    });
  }

  const connection = campaign.advertiserAccount.tiktokConnection;
  if (!connection?.isActive) {
    return reply.status(400).send({
      success: false,
      error: "TikTok connection is inactive",
    });
  }

  const { updateCampaignStatus: tikTokUpdate } = await import(
    "../../lib/tiktok-client.js"
  );

  try {
    await tikTokUpdate(
      connection.accessToken,
      campaign.advertiserAccount.externalId,
      campaign.externalId,
      tiktokStatus
    );
  } catch (err) {
    app.log.error({ err }, "TikTok campaign status update failed");
    return reply.status(502).send({
      success: false,
      error: "Failed to update campaign status on TikTok",
    });
  }

  const newStatus =
    tiktokStatus === "ENABLE" ? "ACTIVE" : "PAUSED";

  const updated = await app.prisma.campaign.update({
    where: { id },
    data: { status: newStatus },
  });

  await createAuditLog({
    prisma: app.prisma,
    organizationId: request.organizationId,
    userId: (request as import("fastify").FastifyRequest & { userId: string }).userId,
    action: tiktokStatus === "ENABLE" ? "CAMPAIGN_RESUME" : "CAMPAIGN_PAUSE",
    resource: "campaign",
    resourceId: id,
    ipAddress: request.ip,
    ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}),
  });

  return reply.send({ success: true, data: updated });
}

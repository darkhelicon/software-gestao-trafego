import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platform: z.enum(["TIKTOK", "META"]).optional(),
});

const readHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission("campaigns:read"),
];

// ========================
// Helper: aggregate ReportDaily rows into summary metrics
// ========================
function aggregateRows(rows: Array<{
  impressions: bigint;
  clicks: bigint;
  spend: unknown;
  conversions: number;
  revenue: unknown;
}>) {
  const impressions = rows.reduce((s, r) => s + Number(r.impressions), 0);
  const clicks = rows.reduce((s, r) => s + Number(r.clicks), 0);
  const spend = rows.reduce((s, r) => s + Number(r.spend), 0);
  const conversions = rows.reduce((s, r) => s + r.conversions, 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue), 0);

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const roas = spend > 0 ? revenue / spend : 0;

  return {
    impressions,
    clicks,
    spend: +spend.toFixed(2),
    conversions,
    revenue: +revenue.toFixed(2),
    ctr: +ctr.toFixed(4),
    cpc: +cpc.toFixed(4),
    cpm: +cpm.toFixed(4),
    cpa: +cpa.toFixed(4),
    roas: +roas.toFixed(4),
  };
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  // GET /reports/summary
  app.get("/summary", { preHandler: readHandler }, async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid date range" });
    }
    const { startDate, endDate, platform } = parsed.data;

    const rows = await app.prisma.reportDaily.findMany({
      where: {
        organizationId: request.organizationId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
        ...(platform && { platform }),
      },
      select: { impressions: true, clicks: true, spend: true, conversions: true, revenue: true },
    });

    return reply.send({ success: true, data: aggregateRows(rows) });
  });

  // GET /reports/daily — time series for chart
  app.get("/daily", { preHandler: readHandler }, async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid date range" });
    }
    const { startDate, endDate, platform } = parsed.data;

    const rows = await app.prisma.reportDaily.groupBy({
      by: ["date"],
      where: {
        organizationId: request.organizationId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
        ...(platform && { platform }),
      },
      _sum: {
        impressions: true,
        clicks: true,
        spend: true,
        conversions: true,
        revenue: true,
      },
      orderBy: { date: "asc" },
    });

    const data = rows.map((r) => ({
      date: r.date.toISOString().split("T")[0],
      impressions: Number(r._sum.impressions ?? 0),
      clicks: Number(r._sum.clicks ?? 0),
      spend: +Number(r._sum.spend ?? 0).toFixed(2),
      conversions: r._sum.conversions ?? 0,
      revenue: +Number(r._sum.revenue ?? 0).toFixed(2),
    }));

    return reply.send({ success: true, data });
  });

  // GET /reports/by-platform
  app.get("/by-platform", { preHandler: readHandler }, async (request, reply) => {
    const parsed = dateRangeSchema.omit({ platform: true }).safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid date range" });
    }
    const { startDate, endDate } = parsed.data;

    const rows = await app.prisma.reportDaily.groupBy({
      by: ["platform"],
      where: {
        organizationId: request.organizationId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      _sum: {
        impressions: true,
        clicks: true,
        spend: true,
        conversions: true,
        revenue: true,
      },
    });

    const data = rows.map((r) => {
      const spend = Number(r._sum.spend ?? 0);
      const clicks = Number(r._sum.clicks ?? 0);
      const impressions = Number(r._sum.impressions ?? 0);
      const conversions = r._sum.conversions ?? 0;
      const revenue = Number(r._sum.revenue ?? 0);

      return {
        platform: r.platform,
        spend: +spend.toFixed(2),
        impressions,
        clicks,
        conversions,
        revenue: +revenue.toFixed(2),
        ctr: impressions > 0 ? +((clicks / impressions) * 100).toFixed(4) : 0,
        cpa: conversions > 0 ? +(spend / conversions).toFixed(4) : 0,
        roas: spend > 0 ? +(revenue / spend).toFixed(4) : 0,
      };
    });

    return reply.send({ success: true, data });
  });

  // GET /reports/by-account
  app.get("/by-account", { preHandler: readHandler }, async (request, reply) => {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid date range" });
    }
    const { startDate, endDate, platform } = parsed.data;

    const rows = await app.prisma.reportDaily.groupBy({
      by: ["advertiserAccountId"],
      where: {
        organizationId: request.organizationId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
        ...(platform && { platform }),
      },
      _sum: {
        impressions: true,
        clicks: true,
        spend: true,
        conversions: true,
        revenue: true,
      },
      orderBy: { _sum: { spend: "desc" } },
    });

    // Fetch account names in one query
    const accountIds = rows.map((r) => r.advertiserAccountId);
    const accounts = await app.prisma.advertiserAccount.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, name: true, platform: true },
    });
    const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

    const data = rows.map((r) => {
      const spend = Number(r._sum.spend ?? 0);
      const clicks = Number(r._sum.clicks ?? 0);
      const impressions = Number(r._sum.impressions ?? 0);
      const conversions = r._sum.conversions ?? 0;
      const revenue = Number(r._sum.revenue ?? 0);
      const acct = accountMap[r.advertiserAccountId];

      return {
        accountId: r.advertiserAccountId,
        accountName: acct?.name ?? "—",
        platform: acct?.platform ?? "—",
        spend: +spend.toFixed(2),
        impressions,
        clicks,
        conversions,
        cpa: conversions > 0 ? +(spend / conversions).toFixed(4) : 0,
        roas: spend > 0 ? +(revenue / spend).toFixed(4) : 0,
      };
    });

    return reply.send({ success: true, data });
  });

  // GET /reports/by-campaign
  app.get("/by-campaign", { preHandler: readHandler }, async (request, reply) => {
    const query = request.query as {
      startDate?: string;
      endDate?: string;
      platform?: string;
      page?: string;
    };
    const parsed = dateRangeSchema.safeParse(query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid date range" });
    }
    const { startDate, endDate, platform } = parsed.data;
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const pageSize = 20;

    const rows = await app.prisma.reportDaily.groupBy({
      by: ["campaignId"],
      where: {
        organizationId: request.organizationId,
        campaignId: { not: null },
        date: { gte: new Date(startDate), lte: new Date(endDate) },
        ...(platform && { platform: platform as "TIKTOK" | "META" }),
      },
      _sum: {
        impressions: true,
        clicks: true,
        spend: true,
        conversions: true,
        revenue: true,
      },
      orderBy: { _sum: { spend: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const campaignIds = rows.map((r) => r.campaignId!);
    const campaigns = await app.prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, name: true, platform: true, status: true },
    });
    const campaignMap = Object.fromEntries(campaigns.map((c) => [c.id, c]));

    const data = rows.map((r) => {
      const spend = Number(r._sum.spend ?? 0);
      const clicks = Number(r._sum.clicks ?? 0);
      const impressions = Number(r._sum.impressions ?? 0);
      const conversions = r._sum.conversions ?? 0;
      const revenue = Number(r._sum.revenue ?? 0);
      const campaign = campaignMap[r.campaignId!];

      return {
        campaignId: r.campaignId,
        campaignName: campaign?.name ?? "—",
        platform: campaign?.platform ?? "—",
        status: campaign?.status ?? "—",
        spend: +spend.toFixed(2),
        impressions,
        clicks,
        conversions,
        ctr: impressions > 0 ? +((clicks / impressions) * 100).toFixed(4) : 0,
        cpa: conversions > 0 ? +(spend / conversions).toFixed(4) : 0,
        roas: spend > 0 ? +(revenue / spend).toFixed(4) : 0,
      };
    });

    return reply.send({ success: true, data: { items: data, page, pageSize } });
  });

  // POST /reports/sync — trigger manual metrics sync for all active accounts
  app.post(
    "/sync",
    {
      preHandler: [
        authenticate,
        requireOrg,
        requireSubscription,
        requirePermission("campaigns:write"),
      ],
    },
    async (request, reply) => {
      const accounts = await app.prisma.advertiserAccount.findMany({
        where: { organizationId: request.organizationId, isActive: true },
        select: { id: true, platform: true },
      });

      if (!accounts.length) {
        return reply.send({ success: true, data: { enqueued: 0 } });
      }

      const { Queue } = await import("bullmq");
      const metricsQueue = new Queue("metrics.sync", { connection: app.redis });

      const end = new Date().toISOString().split("T")[0]!;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const start = startDate.toISOString().split("T")[0]!;

      try {
        await Promise.all(
          accounts.map((acct) =>
            metricsQueue.add(
              "sync",
              {
                organizationId: request.organizationId,
                advertiserAccountId: acct.id,
                platform: acct.platform,
                startDate: start,
                endDate: end,
              },
              { removeOnComplete: 50, removeOnFail: 20 }
            )
          )
        );
      } finally {
        await metricsQueue.close();
      }

      return reply.send({
        success: true,
        data: { enqueued: accounts.length, startDate: start, endDate: end },
      });
    }
  );
};

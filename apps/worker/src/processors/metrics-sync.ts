import type { Job } from "bullmq";
import { prisma } from "@helzo-scale/database";
import {
  tiktokGetDailyReport,
  metaGetAccountInsights,
} from "@helzo-scale/integrations";

interface MetricsSyncPayload {
  organizationId: string;
  advertiserAccountId: string;
  platform: "TIKTOK" | "META";
  startDate: string;
  endDate: string;
}

export async function processMetricsSync(job: Job<MetricsSyncPayload>) {
  const { organizationId, advertiserAccountId, platform, startDate, endDate } =
    job.data;

  const account = await prisma.advertiserAccount.findUnique({
    where: { id: advertiserAccountId },
    include: {
      tiktokConnection: true,
      metaConnection: true,
    },
  });

  if (!account || !account.isActive) {
    console.log(`[metrics-sync] Account ${advertiserAccountId} not found or inactive — skipping`);
    return;
  }

  if (platform === "TIKTOK") {
    await syncTikTok({ account, organizationId, startDate, endDate });
  } else {
    await syncMeta({ account, organizationId, startDate, endDate });
  }
}

// ========================
// TikTok
// ========================

async function syncTikTok({
  account,
  organizationId,
  startDate,
  endDate,
}: {
  account: Awaited<ReturnType<typeof prisma.advertiserAccount.findUnique>> & {
    tiktokConnection: { accessToken: string } | null;
  };
  organizationId: string;
  startDate: string;
  endDate: string;
}) {
  if (!account!.tiktokConnection) {
    console.warn(`[metrics-sync] TikTok account ${account!.id} has no connection`);
    return;
  }

  const rows = await tiktokGetDailyReport(
    account!.tiktokConnection.accessToken,
    account!.externalId,
    startDate,
    endDate
  );

  if (!rows.length) return;

  // Resolve campaign external_id → internal DB id
  const externalIds = [...new Set(rows.map((r) => r.campaign_id))];
  const campaigns = await prisma.campaign.findMany({
    where: { advertiserAccountId: account!.id, externalId: { in: externalIds } },
    select: { id: true, externalId: true },
  });
  const campaignMap = Object.fromEntries(
    campaigns.map((c) => [c.externalId!, c.id])
  );

  const upserts = rows
    .filter((row) => campaignMap[row.campaign_id])
    .map((row) => {
      const campaignId = campaignMap[row.campaign_id]!;
      const date = new Date(row.stat_time_day.substring(0, 10));
      const spend = row.spend;
      const impressions = row.impressions;
      const clicks = row.clicks;
      const conversions = row.conversion;

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      return prisma.reportDaily.upsert({
        where: {
          advertiserAccountId_campaignId_date: {
            advertiserAccountId: account!.id,
            campaignId,
            date,
          },
        },
        update: { impressions: BigInt(impressions), clicks: BigInt(clicks), spend, conversions, revenue: 0, ctr, cpc, cpm, cpa, roas: 0 },
        create: {
          organizationId,
          advertiserAccountId: account!.id,
          campaignId,
          platform: "TIKTOK",
          date,
          impressions: BigInt(impressions),
          clicks: BigInt(clicks),
          spend,
          conversions,
          revenue: 0,
          ctr,
          cpc,
          cpm,
          cpa,
          roas: 0,
        },
      });
    });

  await prisma.$transaction(upserts);
  console.log(`[metrics-sync] TikTok: upserted ${upserts.length} rows for account ${account!.id}`);
}

// ========================
// Meta
// ========================

async function syncMeta({
  account,
  organizationId,
  startDate,
  endDate,
}: {
  account: Awaited<ReturnType<typeof prisma.advertiserAccount.findUnique>> & {
    metaConnection: { accessToken: string } | null;
  };
  organizationId: string;
  startDate: string;
  endDate: string;
}) {
  if (!account!.metaConnection) {
    console.warn(`[metrics-sync] Meta account ${account!.id} has no connection`);
    return;
  }

  const rows = await metaGetAccountInsights(
    account!.metaConnection.accessToken,
    account!.externalId,
    startDate,
    endDate
  );

  if (!rows.length) return;

  const externalIds = [...new Set(rows.map((r) => r.campaign_id))];
  const campaigns = await prisma.campaign.findMany({
    where: { advertiserAccountId: account!.id, externalId: { in: externalIds } },
    select: { id: true, externalId: true },
  });
  const campaignMap = Object.fromEntries(
    campaigns.map((c) => [c.externalId!, c.id])
  );

  const upserts = rows
    .filter((row) => campaignMap[row.campaign_id])
    .map((row) => {
      const campaignId = campaignMap[row.campaign_id]!;
      const date = new Date(row.date_start);
      const spend = row.spend;
      const impressions = row.impressions;
      const clicks = row.clicks;
      const conversions = row.conversions;

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      return prisma.reportDaily.upsert({
        where: {
          advertiserAccountId_campaignId_date: {
            advertiserAccountId: account!.id,
            campaignId,
            date,
          },
        },
        update: { impressions: BigInt(impressions), clicks: BigInt(clicks), spend, conversions, revenue: 0, ctr, cpc, cpm, cpa, roas: 0 },
        create: {
          organizationId,
          advertiserAccountId: account!.id,
          campaignId,
          platform: "META",
          date,
          impressions: BigInt(impressions),
          clicks: BigInt(clicks),
          spend,
          conversions,
          revenue: 0,
          ctr,
          cpc,
          cpm,
          cpa,
          roas: 0,
        },
      });
    });

  await prisma.$transaction(upserts);
  console.log(`[metrics-sync] Meta: upserted ${upserts.length} rows for account ${account!.id}`);
}

import type { Job } from "bullmq";
import { prisma } from "@helzo-scale/database";
import {
  tiktokCreateCampaign,
  refreshTikTokToken,
  metaCreateCampaign,
  refreshMetaToken,
  encrypt,
} from "@helzo-scale/integrations";

interface CampaignCreateJobData {
  jobId: string;
  itemId: string;
  organizationId: string;
  platform: "TIKTOK" | "META";
}

interface TikTokItemPayload {
  campaignId: string;
  advertiserId: string;
  connectionId: string;
  name: string;
  objectiveType: string;
  budgetMode: "BUDGET_MODE_DAY" | "BUDGET_MODE_TOTAL" | "BUDGET_MODE_INFINITE";
  budget?: number;
}

interface MetaItemPayload {
  campaignId: string;
  accountId: string; // "act_123456789"
  connectionId: string;
  name: string;
  objective: string;
  budgetType: "daily" | "lifetime";
  budget?: number;
  status: "ACTIVE" | "PAUSED";
}

export async function processCampaignCreate(
  job: Job<CampaignCreateJobData>
): Promise<void> {
  const { jobId, itemId, organizationId, platform } = job.data;

  // Mark job as processing on first attempt
  await prisma.campaignJob.updateMany({
    where: { id: jobId, status: "PENDING" },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  await prisma.campaignJobItem.update({
    where: { id: itemId },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });

  const item = await prisma.campaignJobItem.findUnique({
    where: { id: itemId },
    select: { payload: true },
  });

  if (!item) throw new Error(`Job item ${itemId} not found`);

  if (platform === "TIKTOK") {
    await processTikTokCampaign(
      jobId,
      itemId,
      item.payload as unknown as TikTokItemPayload,
      organizationId
    );
  } else if (platform === "META") {
    await processMetaCampaign(
      jobId,
      itemId,
      item.payload as unknown as MetaItemPayload,
      organizationId
    );
  }

  await syncJobCounters(jobId);
}

// ========================
// TikTok
// ========================

async function processTikTokCampaign(
  jobId: string,
  itemId: string,
  payload: TikTokItemPayload,
  organizationId: string
): Promise<void> {
  const connection = await prisma.tiktokConnection.findFirst({
    where: { id: payload.connectionId, organizationId, isActive: true },
  });

  if (!connection) {
    await markItemFailed(itemId, payload.campaignId, "TikTok connection not found");
    return;
  }

  // Proactive token refresh if expiring within 1 hour
  let accessToken = connection.accessToken;
  const expiresInMs = connection.tokenExpiresAt.getTime() - Date.now();

  if (expiresInMs < 3_600_000) {
    try {
      const refreshed = await refreshTikTokToken(connection.refreshToken);
      const newEncAccess = encrypt(refreshed.accessToken);
      const newEncRefresh = encrypt(refreshed.refreshToken);

      await prisma.tiktokConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: newEncAccess,
          refreshToken: newEncRefresh,
          tokenExpiresAt: refreshed.expiresAt,
        },
      });

      accessToken = newEncAccess;
    } catch (err) {
      console.error(`[worker] TikTok token refresh failed for ${connection.id}:`, err);
      await markItemFailed(itemId, payload.campaignId, "Token refresh failed");
      return;
    }
  }

  try {
    const result = await tiktokCreateCampaign(accessToken, {
      advertiser_id: payload.advertiserId,
      campaign_name: payload.name,
      objective_type: payload.objectiveType,
      budget_mode: payload.budgetMode,
      ...(payload.budget !== undefined ? { budget: payload.budget } : {}),
      operation_status: "ENABLE",
    });

    await prisma.campaign.update({
      where: { id: payload.campaignId },
      data: { externalId: result.campaign_id, status: "ACTIVE" },
    });

    await prisma.campaignJobItem.update({
      where: { id: itemId },
      data: {
        status: "COMPLETED",
        result: { campaign_id: result.campaign_id },
        processedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markItemFailed(itemId, payload.campaignId, message);
    throw err; // Re-throw → BullMQ retries
  }
}

// ========================
// Meta
// ========================

async function processMetaCampaign(
  jobId: string,
  itemId: string,
  payload: MetaItemPayload,
  organizationId: string
): Promise<void> {
  const connection = await prisma.metaConnection.findFirst({
    where: { id: payload.connectionId, organizationId, isActive: true },
  });

  if (!connection) {
    await markItemFailed(itemId, payload.campaignId, "Meta connection not found");
    return;
  }

  // Proactive token refresh if expiring within 7 days (Meta tokens = 60 days)
  let accessToken = connection.accessToken;
  if (connection.tokenExpiresAt) {
    const expiresInMs = connection.tokenExpiresAt.getTime() - Date.now();
    if (expiresInMs < 7 * 24 * 3_600_000) {
      try {
        const refreshed = await refreshMetaToken(connection.accessToken);
        const newEncToken = encrypt(refreshed.accessToken);

        await prisma.metaConnection.update({
          where: { id: connection.id },
          data: {
            accessToken: newEncToken,
            tokenExpiresAt: refreshed.expiresAt,
          },
        });

        accessToken = newEncToken;
      } catch (err) {
        console.error(`[worker] Meta token refresh failed for ${connection.id}:`, err);
        // Non-fatal: attempt the campaign creation with the existing token
      }
    }
  }

  try {
    const result = await metaCreateCampaign(accessToken, payload.accountId, {
      name: payload.name,
      objective: payload.objective,
      status: payload.status,
      ...(payload.budgetType === "daily" && payload.budget !== undefined
        ? { dailyBudget: payload.budget }
        : payload.budget !== undefined
        ? { lifetimeBudget: payload.budget }
        : {}),
    });

    await prisma.campaign.update({
      where: { id: payload.campaignId },
      data: {
        externalId: result.id,
        status: payload.status === "ACTIVE" ? "ACTIVE" : "PAUSED",
      },
    });

    await prisma.campaignJobItem.update({
      where: { id: itemId },
      data: {
        status: "COMPLETED",
        result: { campaign_id: result.id },
        processedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markItemFailed(itemId, payload.campaignId, message);
    throw err;
  }
}

// ========================
// Shared helpers
// ========================

async function markItemFailed(
  itemId: string,
  campaignId: string,
  error: string
): Promise<void> {
  await Promise.all([
    prisma.campaignJobItem.update({
      where: { id: itemId },
      data: { status: "FAILED", error, processedAt: new Date() },
    }),
    prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "FAILED" },
    }),
  ]);
}

async function syncJobCounters(jobId: string): Promise<void> {
  const [completed, failed, total] = await Promise.all([
    prisma.campaignJobItem.count({ where: { jobId, status: "COMPLETED" } }),
    prisma.campaignJobItem.count({ where: { jobId, status: "FAILED" } }),
    prisma.campaignJobItem.count({ where: { jobId } }),
  ]);

  const allDone = completed + failed === total;
  const finalStatus = !allDone
    ? "PROCESSING"
    : failed === 0
    ? "COMPLETED"
    : "PARTIALLY_FAILED";

  await prisma.campaignJob.update({
    where: { id: jobId },
    data: {
      completedItems: completed,
      failedItems: failed,
      status: finalStatus,
      ...(allDone && { completedAt: new Date() }),
    },
  });
}

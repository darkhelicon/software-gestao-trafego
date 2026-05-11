import type { Job } from "bullmq";
import { prisma, Prisma } from "@helzo-scale/database";
import {
  tiktokUpdateCampaignStatus,
  tiktokUpdateCampaignBudget,
  tiktokGetAdvertiserBalance,
  tiktokGetRejectedCampaigns,
  metaUpdateCampaignStatus,
  metaUpdateCampaignBudget,
  metaGetAdAccountBalance,
  metaGetRejectedCampaigns,
} from "@helzo-scale/integrations";

interface EvaluatePayload {
  ruleId: string;
}

interface CampaignMetrics {
  campaignId: string;
  platform: string;
  spend: number;
  conversions: number;
  revenue: number;
  clicks: number;
  impressions: number;
  cpa: number;
  roas: number;
  ctr: number;
}

type AutomationRule = Awaited<ReturnType<typeof prisma.automationRule.findUnique>>;
type CampaignWithAccount = Awaited<ReturnType<typeof prisma.campaign.findMany>>[0] & {
  advertiserAccount: {
    externalId: string;
    tiktokConnection: { accessToken: string } | null;
    metaConnection: { accessToken: string } | null;
  };
};

export async function processAutomationEvaluate(job: Job<EvaluatePayload>) {
  const { ruleId } = job.data;

  const rule = await prisma.automationRule.findUnique({
    where: { id: ruleId },
    include: { organization: { select: { id: true } } },
  });

  if (!rule || !rule.isActive) {
    console.log(`[automation] Rule ${ruleId} not found or inactive — skipping`);
    return;
  }

  // Route to the appropriate evaluation strategy based on condition
  if (rule.condition === "BALANCE_BELOW") {
    await evaluateBalanceBelow(rule);
  } else if (rule.condition === "REJECTED") {
    await evaluateRejected(rule);
  } else {
    await evaluateMetricsCondition(rule);
  }

  await prisma.automationRule.update({ where: { id: ruleId }, data: { lastRunAt: new Date() } });
}

// ========================
// BALANCE_BELOW — real-time account balance check
// ========================

async function evaluateBalanceBelow(rule: NonNullable<AutomationRule>): Promise<void> {
  const threshold = Number(rule.conditionValue);

  const accounts = await prisma.advertiserAccount.findMany({
    where: {
      organizationId: rule.organizationId,
      isActive: true,
      ...(rule.platform ? { platform: rule.platform } : {}),
    },
    include: {
      tiktokConnection: { select: { accessToken: true } },
      metaConnection: { select: { accessToken: true } },
    },
  });

  for (const account of accounts) {
    let balance = 0;

    try {
      if (account.platform === "TIKTOK" && account.tiktokConnection) {
        balance = await tiktokGetAdvertiserBalance(
          account.tiktokConnection.accessToken,
          account.externalId
        );
      } else if (account.platform === "META" && account.metaConnection) {
        balance = await metaGetAdAccountBalance(
          account.metaConnection.accessToken,
          account.externalId
        );
      }
    } catch (err) {
      console.warn(`[automation] BALANCE_BELOW: failed to get balance for account ${account.id}:`, err);
      continue;
    }

    if (balance >= threshold) continue;

    // Cooldown: skip if already actioned in last 6h for this account
    const recentLog = await prisma.automationLog.findFirst({
      where: {
        ruleId: rule.id,
        createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
        detail: { path: ["advertiserAccountId"], equals: account.id },
      },
    });
    if (recentLog) continue;

    // For BALANCE_BELOW, trigger SEND_ALERT or PAUSE all campaigns on that account
    let success = false;
    if (rule.action === "SEND_ALERT") {
      const { notificationQueue } = await import("../queues/index.js");
      await notificationQueue.add(
        "alert",
        {
          organizationId: rule.organizationId,
          title: `Alerta: ${rule.name}`,
          body: `Conta "${account.name}" com saldo baixo: ${balance.toFixed(2)} (limite: ${threshold.toFixed(2)})`,
          ruleId: rule.id,
        },
        { removeOnComplete: 30, removeOnFail: 10 }
      );
      success = true;
    } else if (rule.action === "PAUSE_CAMPAIGN") {
      // Pause all active campaigns on this account
      const campaigns = await prisma.campaign.findMany({
        where: { advertiserAccountId: account.id, status: "ACTIVE" },
        select: { id: true, externalId: true },
      });
      for (const campaign of campaigns) {
        try {
          await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });
          if (account.platform === "TIKTOK" && account.tiktokConnection && campaign.externalId) {
            await tiktokUpdateCampaignStatus(
              account.tiktokConnection.accessToken,
              account.externalId,
              campaign.externalId,
              "DISABLE"
            );
          } else if (account.platform === "META" && account.metaConnection && campaign.externalId) {
            await metaUpdateCampaignStatus(
              account.metaConnection.accessToken,
              campaign.externalId,
              "PAUSED"
            );
          }
          success = true;
        } catch (err) {
          console.error(`[automation] BALANCE_BELOW PAUSE failed for campaign ${campaign.id}:`, err);
        }
      }
    }

    await prisma.automationLog.create({
      data: {
        ruleId: rule.id,
        triggered: true,
        detail: {
          advertiserAccountId: account.id,
          accountName: account.name,
          balance,
          threshold,
          action: rule.action,
          success,
        },
      },
    });
  }
}

// ========================
// REJECTED — real-time campaign status check
// ========================

async function evaluateRejected(rule: NonNullable<AutomationRule>): Promise<void> {
  const accounts = await prisma.advertiserAccount.findMany({
    where: {
      organizationId: rule.organizationId,
      isActive: true,
      ...(rule.platform ? { platform: rule.platform } : {}),
    },
    include: {
      tiktokConnection: { select: { accessToken: true } },
      metaConnection: { select: { accessToken: true } },
    },
  });

  for (const account of accounts) {
    let rejectedExternalIds: string[] = [];

    try {
      if (account.platform === "TIKTOK" && account.tiktokConnection) {
        rejectedExternalIds = await tiktokGetRejectedCampaigns(
          account.tiktokConnection.accessToken,
          account.externalId
        );
      } else if (account.platform === "META" && account.metaConnection) {
        rejectedExternalIds = await metaGetRejectedCampaigns(
          account.metaConnection.accessToken,
          account.externalId
        );
      }
    } catch (err) {
      console.warn(`[automation] REJECTED: failed to fetch rejected campaigns for account ${account.id}:`, err);
      continue;
    }

    if (!rejectedExternalIds.length) continue;

    // Resolve external IDs to internal DB IDs
    const campaigns = await prisma.campaign.findMany({
      where: {
        advertiserAccountId: account.id,
        externalId: { in: rejectedExternalIds },
      },
      select: { id: true, externalId: true, name: true },
    });

    for (const campaign of campaigns) {
      // Cooldown: skip if already actioned in last 6h
      const recentLog = await prisma.automationLog.findFirst({
        where: {
          ruleId: rule.id,
          createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
          detail: { path: ["campaignId"], equals: campaign.id },
        },
      });
      if (recentLog) continue;

      let success = false;
      if (rule.action === "SEND_ALERT") {
        const { notificationQueue } = await import("../queues/index.js");
        await notificationQueue.add(
          "alert",
          {
            organizationId: rule.organizationId,
            title: `Alerta: ${rule.name}`,
            body: `Campanha "${campaign.name}" foi reprovada/rejeitada pela plataforma.`,
            ruleId: rule.id,
            campaignId: campaign.id,
          },
          { removeOnComplete: 30, removeOnFail: 10 }
        );
        success = true;
      }

      await prisma.automationLog.create({
        data: {
          ruleId: rule.id,
          triggered: true,
          detail: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            externalId: campaign.externalId,
            action: rule.action,
            success,
          },
        },
      });
    }
  }
}

// ========================
// Metrics-based conditions (CPA, ROAS, CTR, SPEND)
// ========================

async function evaluateMetricsCondition(rule: NonNullable<AutomationRule>): Promise<void> {
  const since = new Date();
  since.setDate(since.getDate() - 3);

  const rows = await prisma.reportDaily.groupBy({
    by: ["campaignId"],
    where: {
      organizationId: rule.organizationId,
      campaignId: { not: null },
      date: { gte: since },
      ...(rule.platform ? { platform: rule.platform } : {}),
    },
    _sum: {
      spend: true,
      conversions: true,
      revenue: true,
      clicks: true,
      impressions: true,
    },
  });

  if (!rows.length) {
    await prisma.automationLog.create({
      data: {
        ruleId: rule.id,
        triggered: false,
        detail: { evaluated: 0, triggered: 0, reason: "no_report_data" },
      },
    });
    return;
  }

  const campaignIds = rows.map((r) => r.campaignId!);
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds }, status: { in: ["ACTIVE", "PAUSED"] } },
    include: {
      advertiserAccount: {
        include: { tiktokConnection: true, metaConnection: true },
      },
    },
  });
  const campaignMap = Object.fromEntries(campaigns.map((c) => [c.id, c]));

  const threshold = Number(rule.conditionValue);

  const metrics: CampaignMetrics[] = rows
    .filter((r) => campaignMap[r.campaignId!])
    .map((r) => {
      const spend = Number(r._sum.spend ?? 0);
      const conversions = r._sum.conversions ?? 0;
      const revenue = Number(r._sum.revenue ?? 0);
      const clicks = Number(r._sum.clicks ?? 0);
      const impressions = Number(r._sum.impressions ?? 0);
      const campaign = campaignMap[r.campaignId!]!;

      return {
        campaignId: r.campaignId!,
        platform: campaign.platform,
        spend,
        conversions,
        revenue,
        clicks,
        impressions,
        cpa: conversions > 0 ? spend / conversions : 0,
        roas: spend > 0 ? revenue / spend : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      };
    });

  const triggered = metrics.filter((m) => conditionMet(rule.condition, threshold, m));

  let actioned = 0;

  for (const m of triggered) {
    const campaign = campaignMap[m.campaignId]!;

    const recentLog = await prisma.automationLog.findFirst({
      where: {
        ruleId: rule.id,
        createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
        detail: { path: ["campaignId"], equals: m.campaignId },
      },
    });
    if (recentLog) continue;

    const success = await executeAction(rule, campaign, m);

    await prisma.automationLog.create({
      data: {
        ruleId: rule.id,
        triggered: true,
        detail: {
          campaignId: m.campaignId,
          campaignName: campaign.name,
          action: rule.action,
          condition: rule.condition,
          value: conditionValue(rule.condition, m),
          threshold,
          success,
        },
      },
    });

    if (success) actioned++;
  }

  if (!triggered.length) {
    await prisma.automationLog.create({
      data: {
        ruleId: rule.id,
        triggered: false,
        detail: { evaluated: metrics.length, triggered: 0 },
      },
    });
  }

  console.log(`[automation] Rule ${rule.id}: evaluated ${metrics.length} campaigns, actioned ${actioned}`);
}

// ========================
// Condition evaluation
// ========================

function conditionMet(
  condition: string,
  threshold: number,
  m: CampaignMetrics
): boolean {
  switch (condition) {
    case "CPA_ABOVE":   return m.cpa > 0 && m.cpa > threshold;
    case "CPA_BELOW":   return m.cpa > 0 && m.cpa < threshold;
    case "ROAS_ABOVE":  return m.roas > threshold;
    case "ROAS_BELOW":  return m.spend > 0 && m.roas < threshold;
    case "CTR_BELOW":   return m.impressions > 0 && m.ctr < threshold;
    case "SPEND_ABOVE": return m.spend > threshold;
    default:
      console.warn(`[automation] Unknown condition: ${condition}`);
      return false;
  }
}

function conditionValue(condition: string, m: CampaignMetrics): number {
  switch (condition) {
    case "CPA_ABOVE":
    case "CPA_BELOW":   return m.cpa;
    case "ROAS_ABOVE":
    case "ROAS_BELOW":  return m.roas;
    case "CTR_BELOW":   return m.ctr;
    case "SPEND_ABOVE": return m.spend;
    default:            return 0;
  }
}

// ========================
// Action execution
// ========================

async function executeAction(
  rule: NonNullable<AutomationRule>,
  campaign: CampaignWithAccount,
  metrics: CampaignMetrics
): Promise<boolean> {
  if (!campaign.externalId) return false;

  const platform = campaign.platform;
  const externalId = campaign.externalId;
  const acct = campaign.advertiserAccount;

  try {
    switch (rule.action) {
      case "PAUSE_CAMPAIGN": {
        if (campaign.status !== "ACTIVE") return false;

        await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED" } });

        if (platform === "TIKTOK" && acct.tiktokConnection) {
          await tiktokUpdateCampaignStatus(
            acct.tiktokConnection.accessToken,
            acct.externalId,
            externalId,
            "DISABLE"
          );
        } else if (platform === "META" && acct.metaConnection) {
          await metaUpdateCampaignStatus(acct.metaConnection.accessToken, externalId, "PAUSED");
        }
        return true;
      }

      case "RESUME_CAMPAIGN": {
        if (campaign.status !== "PAUSED") return false;

        await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } });

        if (platform === "TIKTOK" && acct.tiktokConnection) {
          await tiktokUpdateCampaignStatus(
            acct.tiktokConnection.accessToken,
            acct.externalId,
            externalId,
            "ENABLE"
          );
        } else if (platform === "META" && acct.metaConnection) {
          await metaUpdateCampaignStatus(acct.metaConnection.accessToken, externalId, "ACTIVE");
        }
        return true;
      }

      case "SCALE_BUDGET":
      case "REDUCE_BUDGET": {
        if (!campaign.budget) return false;

        const pct = Number(rule.actionValue ?? 20) / 100;
        const multiplier = rule.action === "SCALE_BUDGET" ? 1 + pct : 1 - pct;
        const newBudget = Math.max(1, Number(campaign.budget) * multiplier);

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { budget: newBudget },
        });

        const config = campaign.config as { budgetMode?: string; budgetType?: string } | null;

        if (platform === "TIKTOK" && acct.tiktokConnection) {
          const budgetMode = (config?.budgetMode ?? "BUDGET_MODE_DAY") as
            | "BUDGET_MODE_DAY"
            | "BUDGET_MODE_TOTAL";
          await tiktokUpdateCampaignBudget(
            acct.tiktokConnection.accessToken,
            acct.externalId,
            externalId,
            budgetMode,
            newBudget
          );
        } else if (platform === "META" && acct.metaConnection) {
          const budgetType = (config?.budgetType ?? "daily") as "daily" | "lifetime";
          await metaUpdateCampaignBudget(
            acct.metaConnection.accessToken,
            externalId,
            budgetType,
            newBudget
          );
        }
        return true;
      }

      case "SEND_ALERT": {
        const { notificationQueue } = await import("../queues/index.js");
        await notificationQueue.add(
          "alert",
          {
            organizationId: rule.organizationId,
            title: `Alerta: ${rule.name}`,
            body: buildAlertBody(rule.condition, campaign.name, metrics),
            ruleId: rule.id,
            campaignId: campaign.id,
          },
          { removeOnComplete: 30, removeOnFail: 10 }
        );
        return true;
      }

      case "DUPLICATE_CAMPAIGN": {
        return await duplicateCampaign(rule, campaign);
      }

      default:
        return false;
    }
  } catch (err) {
    console.error(`[automation] Action ${rule.action} failed for campaign ${campaign.id}:`, err);
    return false;
  }
}

// ========================
// DUPLICATE_CAMPAIGN — creates a copy via the campaign.create queue
// ========================

async function duplicateCampaign(
  rule: NonNullable<AutomationRule>,
  campaign: CampaignWithAccount
): Promise<boolean> {
  const { campaignQueue } = await import("../queues/index.js");
  const config = campaign.config as Record<string, unknown> | null;
  const acct = campaign.advertiserAccount;

  // Fetch connection IDs from the AdvertiserAccount (not exposed on CampaignWithAccount type)
  const accountDetails = await prisma.advertiserAccount.findUnique({
    where: { id: campaign.advertiserAccountId },
    select: { tiktokConnectionId: true, metaConnectionId: true },
  });
  if (!accountDetails) return false;

  const connectionId =
    campaign.platform === "TIKTOK"
      ? accountDetails.tiktokConnectionId
      : accountDetails.metaConnectionId;

  if (!connectionId) return false;

  // Create the new Campaign DB record (DRAFT) — the worker fills in externalId after creation
  const newCampaign = await prisma.campaign.create({
    data: {
      organizationId: rule.organizationId,
      advertiserAccountId: campaign.advertiserAccountId,
      platform: campaign.platform,
      name: `${campaign.name} (Cópia)`,
      status: "DRAFT",
      budget: campaign.budget,
      config: campaign.config !== null
        ? (campaign.config as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });

  // Build the platform-specific payload for the campaign.create worker
  let itemPayload: Prisma.InputJsonValue;

  if (campaign.platform === "TIKTOK") {
    const tiktokPayload: Record<string, unknown> = {
      campaignId: newCampaign.id,
      advertiserId: acct.externalId,
      connectionId,
      name: newCampaign.name,
      objectiveType: (config?.["objectiveType"] as string | undefined) ?? "TRAFFIC",
      budgetMode: (config?.["budgetMode"] as string | undefined) ?? "BUDGET_MODE_DAY",
    };
    if (campaign.budget) tiktokPayload["budget"] = Number(campaign.budget);
    itemPayload = tiktokPayload as Prisma.InputJsonValue;
  } else {
    const metaPayload: Record<string, unknown> = {
      campaignId: newCampaign.id,
      accountId: acct.externalId,
      connectionId,
      name: newCampaign.name,
      objective: (config?.["objective"] as string | undefined) ?? "OUTCOME_TRAFFIC",
      budgetType: (config?.["budgetType"] as string | undefined) ?? "daily",
      status: "PAUSED", // duplicates start paused for review
    };
    if (campaign.budget) metaPayload["budget"] = Number(campaign.budget);
    itemPayload = metaPayload as Prisma.InputJsonValue;
  }

  // Create the CampaignJob envelope in DB
  const campaignJob = await prisma.campaignJob.create({
    data: {
      organizationId: rule.organizationId,
      platform: campaign.platform,
      status: "PENDING",
      totalItems: 1,
    },
  });

  const jobItem = await prisma.campaignJobItem.create({
    data: {
      jobId: campaignJob.id,
      status: "PENDING",
      payload: itemPayload,
    },
  });

  // Enqueue to BullMQ
  const bullJob = await campaignQueue.add(
    "create",
    {
      jobId: campaignJob.id,
      itemId: jobItem.id,
      organizationId: rule.organizationId,
      platform: campaign.platform,
    },
    { removeOnComplete: 30, removeOnFail: 20 }
  );

  // Record the BullMQ job ID for traceability
  await prisma.campaignJob.update({
    where: { id: campaignJob.id },
    data: { bullJobId: bullJob.id ?? null },
  });

  console.log(
    `[automation] DUPLICATE_CAMPAIGN: enqueued job ${bullJob.id} for campaign ${campaign.id} → new campaign ${newCampaign.id}`
  );
  return true;
}

function buildAlertBody(condition: string, campaignName: string, m: CampaignMetrics): string {
  const labels: Record<string, string> = {
    CPA_ABOVE:  `CPA alto: R$ ${m.cpa.toFixed(2)}`,
    CPA_BELOW:  `CPA baixo: R$ ${m.cpa.toFixed(2)}`,
    ROAS_ABOVE: `ROAS alto: ${m.roas.toFixed(2)}x`,
    ROAS_BELOW: `ROAS baixo: ${m.roas.toFixed(2)}x`,
    CTR_BELOW:  `CTR baixo: ${m.ctr.toFixed(2)}%`,
    SPEND_ABOVE: `Gasto elevado: R$ ${m.spend.toFixed(2)}`,
  };
  return `Campanha "${campaignName}": ${labels[condition] ?? condition}`;
}

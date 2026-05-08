import type { Job } from "bullmq";
import { prisma } from "@helzo-scale/database";
import {
  tiktokUpdateCampaignStatus,
  tiktokUpdateCampaignBudget,
  metaUpdateCampaignStatus,
  metaUpdateCampaignBudget,
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

  // Aggregate last 3 days of ReportDaily per campaign
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
    await prisma.automationRule.update({ where: { id: ruleId }, data: { lastRunAt: new Date() } });
    return;
  }

  // Get campaign details
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

  // Filter campaigns that meet the condition
  const triggered = metrics.filter((m) => conditionMet(rule.condition, threshold, m));

  let actioned = 0;

  for (const m of triggered) {
    const campaign = campaignMap[m.campaignId]!;

    // Cooldown: skip if actioned by this rule in last 6h
    const recentLog = await prisma.automationLog.findFirst({
      where: {
        ruleId,
        createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
        detail: { path: ["campaignId"], equals: m.campaignId },
      },
    });
    if (recentLog) continue;

    const success = await executeAction(rule, campaign, m);

    await prisma.automationLog.create({
      data: {
        ruleId,
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

  // Log evaluation even when nothing triggered (for visibility)
  if (!triggered.length) {
    await prisma.automationLog.create({
      data: {
        ruleId,
        triggered: false,
        detail: { evaluated: metrics.length, triggered: 0 },
      },
    });
  }

  await prisma.automationRule.update({ where: { id: ruleId }, data: { lastRunAt: new Date() } });

  console.log(`[automation] Rule ${ruleId}: evaluated ${metrics.length} campaigns, actioned ${actioned}`);
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
    case "CPA_ABOVE":    return m.cpa > 0 && m.cpa > threshold;
    case "CPA_BELOW":    return m.cpa > 0 && m.cpa < threshold;
    case "ROAS_ABOVE":   return m.roas > threshold;
    case "ROAS_BELOW":   return m.spend > 0 && m.roas < threshold;
    case "CTR_BELOW":    return m.impressions > 0 && m.ctr < threshold;
    case "SPEND_ABOVE":  return m.spend > threshold;
    // BALANCE_BELOW and REJECTED require real-time platform API calls (not in ReportDaily).
    // These are evaluated by a dedicated polling processor (future phase).
    case "BALANCE_BELOW":
    case "REJECTED":
      return false;
    default:
      console.warn(`[automation] Unknown condition: ${condition}`);
      return false;
  }
}

function conditionValue(condition: string, m: CampaignMetrics): number {
  switch (condition) {
    case "CPA_ABOVE":
    case "CPA_BELOW":    return m.cpa;
    case "ROAS_ABOVE":
    case "ROAS_BELOW":   return m.roas;
    case "CTR_BELOW":    return m.ctr;
    case "SPEND_ABOVE":  return m.spend;
    default:             return 0;
  }
}

// ========================
// Action execution
// ========================

async function executeAction(
  rule: Awaited<ReturnType<typeof prisma.automationRule.findUnique>>,
  campaign: Awaited<ReturnType<typeof prisma.campaign.findMany>>[0] & {
    advertiserAccount: {
      externalId: string;
      tiktokConnection: { accessToken: string } | null;
      metaConnection: { accessToken: string } | null;
    };
  },
  metrics: CampaignMetrics
): Promise<boolean> {
  if (!rule || !campaign.externalId) return false;

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

      case "DUPLICATE_CAMPAIGN":
        console.log(`[automation] DUPLICATE_CAMPAIGN for ${campaign.id} — Phase 9`);
        return false;

      default:
        return false;
    }
  } catch (err) {
    console.error(`[automation] Action ${rule.action} failed for campaign ${campaign.id}:`, err);
    return false;
  }
}

function buildAlertBody(condition: string, campaignName: string, m: CampaignMetrics): string {
  const labels: Record<string, string> = {
    CPA_ABOVE: `CPA alto: R$ ${m.cpa.toFixed(2)}`,
    CPA_BELOW: `CPA baixo: R$ ${m.cpa.toFixed(2)}`,
    ROAS_ABOVE: `ROAS alto: ${m.roas.toFixed(2)}x`,
    ROAS_BELOW: `ROAS baixo: ${m.roas.toFixed(2)}x`,
    CTR_BELOW: `CTR baixo: ${m.ctr.toFixed(2)}%`,
    SPEND_ABOVE: `Gasto elevado: R$ ${m.spend.toFixed(2)}`,
  };
  return `Campanha "${campaignName}": ${labels[condition] ?? condition}`;
}

import type { PrismaClient } from "@adflow/database";
import * as fx from "./fixtures.js";

type AnyArgs = Record<string, unknown>;

function model(list: unknown[], single: unknown = list[0] ?? null) {
  return {
    findMany: async (_args?: AnyArgs) => list,
    findUnique: async (_args?: AnyArgs) => single,
    findFirst: async (_args?: AnyArgs) => single,
    count: async (_args?: AnyArgs) => list.length,
    create: async ({ data }: { data: AnyArgs }) => ({ ...single as object, ...data }),
    update: async ({ data }: { data: AnyArgs }) => ({ ...single as object, ...data }),
    upsert: async ({ update: u }: { update: AnyArgs }) => ({ ...single as object, ...u }),
    delete: async (_args?: AnyArgs) => single,
    deleteMany: async (_args?: AnyArgs) => ({ count: list.length }),
    updateMany: async (_args?: AnyArgs) => ({ count: list.length }),
    aggregate: async (_args?: AnyArgs) => ({ _count: { _all: list.length }, _sum: {}, _avg: {}, _min: {}, _max: {} }),
    groupBy: async (_args?: AnyArgs) => [],
  };
}

// Pipeline mock: chain calls, exec resolves to empty results
function makePipeline() {
  const self = {
    get: (..._: unknown[]) => self,
    set: (..._: unknown[]) => self,
    del: (..._: unknown[]) => self,
    incr: (..._: unknown[]) => self,
    expire: (..._: unknown[]) => self,
    hset: (..._: unknown[]) => self,
    hget: (..._: unknown[]) => self,
    exec: async () => [],
  };
  return self;
}

export const mockPrismaClient = {
  // Connection lifecycle — no-ops in demo mode
  $connect: async () => {},
  $disconnect: async () => {},
  $queryRaw: async (..._: unknown[]) => [{ "?column?": 1 }],
  $executeRaw: async (..._: unknown[]) => 0,
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrismaClient),

  // Models
  user: model([fx.user], fx.user),
  organization: model([fx.organization], fx.organization),
  organizationUser: model(fx.members, fx.organizationUser),
  subscription: model([fx.subscription], fx.subscription),
  plan: {
    ...model(fx.plans, fx.plans[2]),
    findUnique: async (args?: AnyArgs) => {
      const a = args as { select?: { quotaLimits?: { where?: { resource: string } } } } | undefined;
      const resourceFilter = a?.select?.quotaLimits?.where?.resource;
      const plan = { ...fx.plans[2]! } as AnyArgs;
      if (resourceFilter && Array.isArray(plan["quotaLimits"])) {
        plan["quotaLimits"] = (plan["quotaLimits"] as Array<{ resource: string }>).filter(
          (q) => q.resource === resourceFilter
        );
      }
      return plan;
    },
  },
  tiktokConnection: model(fx.tiktokConnections, fx.tiktokConnections[0]),
  tiktokAccount: model(fx.tiktokAccounts, fx.tiktokAccounts[0]),
  metaConnection: model(fx.metaConnections, fx.metaConnections[0]),
  metaAccount: model(fx.metaAccounts, fx.metaAccounts[0]),
  campaign: model(fx.campaigns, fx.campaigns[0]),
  campaignTemplate: model(fx.campaignTemplates, fx.campaignTemplates[0]),
  template: model(fx.templates, fx.templates[0]),
  automationRule: model(fx.automationRules, fx.automationRules[0]),
  automationLog: model([], null),
  automationConfig: model([], null),
  orgFeatureFlag: { ...model([], null), findFirst: async () => null },
  notification: model(fx.notifications, fx.notifications[0]),
  auditLog: model([], null),
  billingEvent: model([], null),
  usageRecord: model([], null),
  usageTracking: { ...model([], null), findUnique: async () => null },
  invite: model([], null),
  report: model([], null),
  advertiserAccount: model(fx.advertiserAccounts, fx.advertiserAccounts[0]),
  reportDaily: {
    ...model(fx.reportDailyRows, fx.reportDailyRows[0]),
    groupBy: async (args?: AnyArgs) => {
      const by = (args as { by?: string[] })?.by;
      if (!by) return [];
      if (by[0] === "date") return fx.reportDailyByDate;
      if (by[0] === "platform") return fx.reportDailyByPlatform;
      if (by[0] === "advertiserAccountId") return fx.reportDailyByAccount;
      if (by[0] === "campaignId") return fx.reportDailyByCampaign;
      return [];
    },
  },
} as unknown as PrismaClient;

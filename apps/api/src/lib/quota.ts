import type { PrismaClient } from "@helzo-scale/database";
import type { Redis } from "ioredis";
import type { QuotaResource } from "@helzo-scale/types";

const TTL_SECONDS = 3600; // 1 hour cache per day bucket

function redisKey(orgId: string, resource: QuotaResource, date: string): string {
  return `quota:${orgId}:${resource}:${date}`;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function getQuotaLimit(
  prisma: PrismaClient,
  planSlug: string,
  resource: QuotaResource
): Promise<number> {
  const plan = await prisma.plan.findUnique({
    where: { slug: planSlug as import("@helzo-scale/database").PlanSlug },
    select: {
      quotaLimits: {
        where: { resource },
        select: { limit: true },
      },
    },
  });

  return plan?.quotaLimits[0]?.limit ?? 0;
}

export async function getQuotaUsed(
  prisma: PrismaClient,
  redis: Redis,
  organizationId: string,
  resource: QuotaResource
): Promise<number> {
  const date = todayUTC();
  const key = redisKey(organizationId, resource, date);

  const cached = await redis.get(key);
  if (cached !== null) return parseInt(cached, 10);

  // Fallback to DB
  const today = new Date(`${date}T00:00:00.000Z`);
  const row = await prisma.usageTracking.findUnique({
    where: {
      organizationId_resource_periodDate: {
        organizationId,
        resource,
        periodDate: today,
      },
    },
    select: { used: true },
  });

  const used = row?.used ?? 0;

  // Warm the cache (expire at next UTC midnight)
  const now = new Date();
  const midnight = new Date(`${date}T23:59:59.999Z`);
  const ttl = Math.max(
    Math.floor((midnight.getTime() - now.getTime()) / 1000),
    1
  );
  await redis.setex(key, ttl, used.toString());

  return used;
}

export async function incrementQuotaUsed(
  prisma: PrismaClient,
  redis: Redis,
  organizationId: string,
  resource: QuotaResource,
  amount = 1
): Promise<void> {
  const date = todayUTC();
  const today = new Date(`${date}T00:00:00.000Z`);

  // DB upsert
  await prisma.usageTracking.upsert({
    where: {
      organizationId_resource_periodDate: {
        organizationId,
        resource,
        periodDate: today,
      },
    },
    create: { organizationId, resource, periodDate: today, used: amount },
    update: { used: { increment: amount } },
  });

  // Increment Redis counter directly (no re-read needed)
  const key = redisKey(organizationId, resource, date);
  const midnight = new Date(`${date}T23:59:59.999Z`);
  const ttl = Math.max(
    Math.floor((midnight.getTime() - Date.now()) / 1000),
    1
  );
  const exists = await redis.exists(key);
  if (exists) {
    await redis.incrby(key, amount);
  } else {
    await redis.setex(key, ttl, amount.toString());
  }
}

export async function getAllQuotaUsage(
  prisma: PrismaClient,
  redis: Redis,
  organizationId: string
): Promise<Record<QuotaResource, number>> {
  const resources: QuotaResource[] = [
    "campaigns_per_day",
    "ads_per_day",
    "business_centers",
    "advertiser_accounts",
  ];

  const entries = await Promise.all(
    resources.map(async (r) => [
      r,
      await getQuotaUsed(prisma, redis, organizationId, r),
    ])
  );

  return Object.fromEntries(entries) as Record<QuotaResource, number>;
}

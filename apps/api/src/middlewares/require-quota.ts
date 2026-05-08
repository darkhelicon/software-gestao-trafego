import type { FastifyRequest, FastifyReply } from "fastify";
import type { QuotaResource } from "@helzo-scale/types";
import {
  getQuotaLimit,
  getQuotaUsed,
  incrementQuotaUsed,
} from "../lib/quota.js";

export function requireQuota(resource: QuotaResource, amount = 1) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { prisma, redis } = request.server;

    const [limit, used] = await Promise.all([
      getQuotaLimit(prisma, request.planSlug, resource),
      getQuotaUsed(prisma, redis, request.organizationId, resource),
    ]);

    // -1 = unlimited
    if (limit === -1) return;

    if (limit === 0) {
      return reply.status(403).send({
        success: false,
        error: `Resource '${resource}' is not available on your plan`,
        code: "QUOTA_NOT_AVAILABLE",
      });
    }

    if (used + amount > limit) {
      return reply.status(429).send({
        success: false,
        error: `Daily quota exceeded for '${resource}'`,
        code: "QUOTA_EXCEEDED",
        limit,
        used,
      });
    }
  };
}

export async function incrementQuota(
  request: FastifyRequest,
  resource: QuotaResource,
  amount = 1
): Promise<void> {
  await incrementQuotaUsed(
    request.server.prisma,
    request.server.redis,
    request.organizationId,
    resource,
    amount
  );
}

import type { PrismaClient, PlanSlug } from "@adflow/database";
import { PLAN_FEATURES } from "@adflow/types";

export async function hasFeature(
  prisma: PrismaClient,
  organizationId: string,
  planSlug: PlanSlug,
  feature: string
): Promise<boolean> {
  // Check plan-level feature first (fast, no DB call)
  const planFeatures = PLAN_FEATURES[planSlug] ?? [];
  if (!planFeatures.includes(feature)) return false;

  // Check org-level override (can enable or disable per org)
  const orgFlag = await prisma.orgFeatureFlag.findFirst({
    where: {
      organizationId,
      flag: { key: feature },
    },
    select: { enabled: true },
  });

  // If an org override exists, respect it; otherwise trust the plan
  if (orgFlag !== null) return orgFlag.enabled;
  return true;
}

export function requireFeatureMiddleware(feature: string) {
  return async function (
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply
  ): Promise<void> {
    const allowed = await hasFeature(
      request.server.prisma,
      request.organizationId,
      request.planSlug,
      feature
    );

    if (!allowed) {
      return reply.status(403).send({
        success: false,
        error: `Feature '${feature}' is not available on your plan`,
        code: "FEATURE_NOT_AVAILABLE",
      });
    }
  };
}

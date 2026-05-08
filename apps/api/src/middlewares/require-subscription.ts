import type { FastifyRequest, FastifyReply } from "fastify";
import type { PlanSlug, SubscriptionStatus } from "@adflow/database";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE"];

declare module "fastify" {
  interface FastifyRequest {
    planSlug: PlanSlug;
    subscriptionStatus: SubscriptionStatus;
  }
}

export async function requireSubscription(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const subscription =
    await request.server.prisma.subscription.findUnique({
      where: { organizationId: request.organizationId },
      select: {
        status: true,
        plan: { select: { slug: true } },
      },
    });

  if (
    !subscription ||
    !ACTIVE_STATUSES.includes(subscription.status)
  ) {
    return reply.status(402).send({
      success: false,
      error: "Active subscription required",
      code: "SUBSCRIPTION_REQUIRED",
    });
  }

  request.planSlug = subscription.plan.slug;
  request.subscriptionStatus = subscription.status;
}

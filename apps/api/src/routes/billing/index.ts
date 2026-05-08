import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { stripe, STRIPE_PRICES } from "../../lib/stripe.js";
import {
  authenticate,
  requireOrg,
  requireSubscription,
} from "../../middlewares/index.js";

const checkoutSchema = z.object({
  planSlug: z.enum(["START", "GROWTH", "SCALE", "ENTERPRISE"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const billingRoutes: FastifyPluginAsync = async (app) => {
  // GET /billing/plans — public, returns all plans with features
  app.get("/plans", async (_request, reply) => {
    const plans = await app.prisma.plan.findMany({
      where: { isActive: true },
      include: {
        features: true,
        quotaLimits: true,
      },
      orderBy: { priceMonthly: "asc" },
    });

    return reply.send({ success: true, data: plans });
  });

  // GET /billing/subscription — current org subscription
  app.get(
    "/subscription",
    { preHandler: [authenticate, requireOrg] },
    async (request, reply) => {
      const subscription = await app.prisma.subscription.findUnique({
        where: { organizationId: request.organizationId },
        include: { plan: { include: { features: true, quotaLimits: true } } },
      });

      return reply.send({ success: true, data: subscription ?? null });
    }
  );

  // POST /billing/checkout — creates Stripe Checkout session
  app.post(
    "/checkout",
    { preHandler: [authenticate, requireOrg] },
    async (request, reply) => {
      const body = checkoutSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: body.error.flatten(),
        });
      }

      const { planSlug, successUrl, cancelUrl } = body.data;
      const priceId = STRIPE_PRICES[planSlug];

      if (!priceId) {
        return reply.status(400).send({
          success: false,
          error: `No Stripe price configured for plan ${planSlug}`,
        });
      }

      // Get or create Stripe customer
      const subscription = await app.prisma.subscription.findUnique({
        where: { organizationId: request.organizationId },
        select: { stripeCustomerId: true },
      });

      let customerId = subscription?.stripeCustomerId ?? undefined;

      if (!customerId) {
        const org = await app.prisma.organization.findUnique({
          where: { id: request.organizationId },
          select: { name: true },
        });

        const customer = await stripe.customers.create({
          email: request.userEmail,
          ...(org?.name ? { name: org.name } : {}),
          metadata: {
            organizationId: request.organizationId,
            userId: request.userId,
          },
        });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            organizationId: request.organizationId,
            planSlug,
          },
        },
        metadata: {
          organizationId: request.organizationId,
          planSlug,
        },
      });

      return reply.send({ success: true, data: { url: session.url } });
    }
  );

  // POST /billing/portal — creates Stripe Customer Portal session
  app.post(
    "/portal",
    { preHandler: [authenticate, requireOrg, requireSubscription] },
    async (request, reply) => {
      const returnUrlSchema = z.object({ returnUrl: z.string().url() });
      const body = returnUrlSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: "returnUrl is required",
        });
      }

      const subscription = await app.prisma.subscription.findUnique({
        where: { organizationId: request.organizationId },
        select: { stripeCustomerId: true },
      });

      if (!subscription?.stripeCustomerId) {
        return reply.status(400).send({
          success: false,
          error: "No billing account found",
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: body.data.returnUrl,
      });

      return reply.send({ success: true, data: { url: session.url } });
    }
  );
};

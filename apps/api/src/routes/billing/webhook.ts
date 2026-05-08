import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient, PlanSlug, SubscriptionStatus } from "@helzo-scale/database";
import { Prisma } from "@helzo-scale/database";
import type Stripe from "stripe";
import { stripe } from "../../lib/stripe.js";

const WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";

export const stripeWebhookRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/webhook",
    { config: { rawBody: true } },
    async (request, reply) => {
      const sig = request.headers["stripe-signature"];

      if (!sig) {
        return reply.status(400).send({ success: false, error: "Missing stripe-signature" });
      }

      let event: Stripe.Event;
      try {
        const raw = (request as unknown as { rawBody: Buffer }).rawBody;
        event = stripe.webhooks.constructEvent(raw, sig, WEBHOOK_SECRET);
      } catch {
        return reply.status(400).send({ success: false, error: "Signature verification failed" });
      }

      // Idempotency guard
      const orgId = extractOrgId(event);
      if (!orgId) {
        return reply.send({ received: true });
      }

      const alreadyProcessed = await app.prisma.billingEvent.findUnique({
        where: { stripeEventId: event.id },
      });
      if (alreadyProcessed) {
        return reply.send({ received: true });
      }

      try {
        await handleEvent(app.prisma, event, orgId);
        await app.prisma.billingEvent.create({
          data: {
            stripeEventId: event.id,
            eventType: event.type,
            payload: event.data.object as unknown as Prisma.InputJsonValue,
            organizationId: orgId,
          },
        });
      } catch (err) {
        app.log.error({ err, eventType: event.type }, "Stripe webhook error");
        return reply.status(500).send({ success: false, error: "Handler failed" });
      }

      return reply.send({ received: true });
    }
  );
};

function extractOrgId(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>;
  const meta = obj["metadata"] as Record<string, string> | undefined;
  return meta?.["organizationId"] ?? null;
}

async function handleEvent(
  prisma: PrismaClient,
  event: Stripe.Event,
  orgId: string
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const planSlug = session.metadata?.["planSlug"] as PlanSlug | undefined;
      if (!planSlug) return;

      const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
      if (!plan) return;

      await prisma.subscription.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          planId: plan.id,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          status: "ACTIVE",
        },
        update: {
          planId: plan.id,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
        },
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const planSlug = sub.metadata?.["planSlug"] as PlanSlug | undefined;

      const updateData: Parameters<typeof prisma.subscription.updateMany>[0]["data"] = {
        status: mapStripeStatus(sub.status),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      };

      if (planSlug) {
        const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
        if (plan) updateData.planId = plan.id;
      }

      await prisma.subscription.updateMany({
        where: { organizationId: orgId },
        data: updateData,
      });
      break;
    }

    case "customer.subscription.deleted": {
      await prisma.subscription.updateMany({
        where: { organizationId: orgId },
        data: { status: "CANCELED" },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;

      if (subId) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: "PAST_DUE" },
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;

      if (subId) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: "ACTIVE" },
        });
      }
      break;
    }

    default:
      break;
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    paused: "PAUSED",
    incomplete: "PAST_DUE",
    incomplete_expired: "CANCELED",
  };
  return map[status] ?? "CANCELED";
}

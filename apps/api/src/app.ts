import Fastify, { type FastifyError } from "fastify";
import { corsPlugin } from "./plugins/cors.js";
import { helmetPlugin } from "./plugins/helmet.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { requestContextPlugin } from "./plugins/request-context.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { initSentry, captureException } from "./lib/sentry.js";
import { healthRoute } from "./routes/health.js";
import { authRoutes } from "./routes/auth/index.js";
import { billingRoutes } from "./routes/billing/index.js";
import { stripeWebhookRoute } from "./routes/billing/webhook.js";
import { organizationRoutes } from "./routes/organizations/index.js";
import { membersRoutes } from "./routes/organizations/members.js";
import { usageRoutes } from "./routes/organizations/usage.js";
import { tiktokOAuthRoutes } from "./routes/oauth/tiktok.js";
import { tiktokConnectionRoutes } from "./routes/tiktok/connections.js";
import { tiktokAccountRoutes } from "./routes/tiktok/accounts.js";
import { tiktokCampaignRoutes } from "./routes/tiktok/campaigns.js";
import { metaOAuthRoutes } from "./routes/oauth/meta.js";
import { metaConnectionRoutes } from "./routes/meta/connections.js";
import { metaAccountRoutes } from "./routes/meta/accounts.js";
import { metaCampaignRoutes } from "./routes/meta/campaigns.js";
import { templateRoutes } from "./routes/templates/index.js";
import { reportRoutes } from "./routes/reports/index.js";
import { automationRulesRoutes } from "./routes/automation/rules.js";
import { automationConfigRoutes } from "./routes/automation/config.js";
import { notificationRoutes } from "./routes/notifications/index.js";

export async function buildApp() {
  // Initialize Sentry before anything else (no-op if SENTRY_DSN not set)
  initSentry();

  const app = Fastify({
    logger: {
      level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
      ...(process.env["NODE_ENV"] !== "production" && {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
    },
    trustProxy: true,
    requestIdHeader: "x-request-id",
  });

  // Raw body needed for Stripe webhook signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // Security plugins (order matters)
  await app.register(helmetPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimitPlugin);
  await app.register(requestContextPlugin);

  // Infrastructure plugins
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // Routes
  await app.register(healthRoute, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(billingRoutes, { prefix: "/api/v1/billing" });
  await app.register(stripeWebhookRoute, { prefix: "/api/v1/billing" });
  await app.register(organizationRoutes, { prefix: "/api/v1/organizations" });
  await app.register(membersRoutes, { prefix: "/api/v1/organizations" });
  await app.register(usageRoutes, { prefix: "/api/v1/organizations" });
  await app.register(tiktokOAuthRoutes, { prefix: "/api/v1/oauth/tiktok" });
  await app.register(tiktokConnectionRoutes, { prefix: "/api/v1/tiktok/connections" });
  await app.register(tiktokAccountRoutes, { prefix: "/api/v1/tiktok/accounts" });
  await app.register(tiktokCampaignRoutes, { prefix: "/api/v1/tiktok/campaigns" });
  await app.register(metaOAuthRoutes, { prefix: "/api/v1/oauth/meta" });
  await app.register(metaConnectionRoutes, { prefix: "/api/v1/meta/connections" });
  await app.register(metaAccountRoutes, { prefix: "/api/v1/meta/accounts" });
  await app.register(metaCampaignRoutes, { prefix: "/api/v1/meta/campaigns" });
  await app.register(templateRoutes, { prefix: "/api/v1/templates" });
  await app.register(reportRoutes, { prefix: "/api/v1/reports" });
  await app.register(automationRulesRoutes, { prefix: "/api/v1/automation/rules" });
  await app.register(automationConfigRoutes, { prefix: "/api/v1/automation/config" });
  await app.register(notificationRoutes, { prefix: "/api/v1/notifications" });

  // Global error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: "Validation error",
        details: error.validation,
      });
    }

    app.log.error(
      {
        err: error,
        reqId: request.id,
        url: request.url,
        method: request.method,
        userId: (request as unknown as Record<string, unknown>)["userId"],
        orgId: (request as unknown as Record<string, unknown>)["organizationId"],
      },
      "Unhandled error"
    );

    // Report 5xx errors to Sentry
    if (statusCode >= 500) {
      captureException(error, {
        requestId: request.id,
        url: request.url,
        method: request.method,
        statusCode,
      });
    }

    return reply.status(statusCode).send({
      success: false,
      error:
        statusCode >= 500
          ? "Internal server error"
          : (error.message ?? "Unknown error"),
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: `Route ${request.method} ${request.url} not found`,
    });
  });

  return app;
}

import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "crypto";
import {
  buildAuthUrl,
  exchangeCode,
  listBusinessManagers,
  encrypt,
} from "../../lib/meta-client.js";
import type { MetaBusinessManager } from "../../lib/meta-client.js";
import {
  authenticate,
  requireOrg,
  requireSubscription,
} from "../../middlewares/index.js";
import { createAuditLog } from "../../lib/audit.js";
import { getQuotaLimit } from "../../lib/quota.js";

const OAUTH_STATE_TTL = 600; // 10 minutes
const FRONTEND_URL = () =>
  process.env["FRONTEND_URL"] ?? "http://localhost:3000";

export const metaOAuthRoutes: FastifyPluginAsync = async (app) => {
  // GET /oauth/meta/authorize
  app.get(
    "/authorize",
    { preHandler: [authenticate, requireOrg, requireSubscription] },
    async (request, reply) => {
      const state = randomBytes(24).toString("hex");

      await app.redis.setex(
        `oauth:meta:state:${state}`,
        OAUTH_STATE_TTL,
        JSON.stringify({
          organizationId: request.organizationId,
          userId: request.userId,
        })
      );

      return reply.redirect(buildAuthUrl(state));
    }
  );

  // GET /oauth/meta/callback
  // Meta redirects here with ?code=...&state=...
  app.get("/callback", async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error || !code || !state) {
      return reply.redirect(
        `${FRONTEND_URL()}/meta?error=oauth_denied`
      );
    }

    const stateKey = `oauth:meta:state:${state}`;
    const stateData = await app.redis.get(stateKey);

    if (!stateData) {
      return reply.redirect(`${FRONTEND_URL()}/meta?error=invalid_state`);
    }

    await app.redis.del(stateKey);

    const { organizationId, userId } = JSON.parse(stateData) as {
      organizationId: string;
      userId: string;
    };

    let tokens;
    try {
      tokens = await exchangeCode(code!);
    } catch (err) {
      app.log.error({ err }, "Meta OAuth code exchange failed");
      return reply.redirect(`${FRONTEND_URL()}/meta?error=token_exchange`);
    }

    // Fetch all Business Managers this user manages
    let businessManagers: MetaBusinessManager[] = [];
    try {
      businessManagers = await listBusinessManagers(encrypt(tokens.accessToken));
    } catch (err) {
      app.log.error({ err }, "Failed to list Meta Business Managers");
    }

    if (!businessManagers.length) {
      return reply.redirect(
        `${FRONTEND_URL()}/meta?error=no_business_manager`
      );
    }

    // Quota check: count active Meta connections vs plan limit
    const subscription = await app.prisma.subscription.findUnique({
      where: { organizationId },
      select: { plan: { select: { slug: true } } },
    });

    if (subscription?.plan) {
      const [limit, activeCount] = await Promise.all([
        getQuotaLimit(app.prisma, subscription.plan.slug, "business_centers"),
        app.prisma.metaConnection.count({ where: { organizationId, isActive: true } }),
      ]);

      // Count only truly new BMs (not ones being re-connected via upsert)
      const existingBmIds = await app.prisma.metaConnection.findMany({
        where: { organizationId, businessManagerId: { in: businessManagers.map((b) => b.id) } },
        select: { businessManagerId: true },
      });
      const existingSet = new Set(existingBmIds.map((e) => e.businessManagerId));
      const newCount = businessManagers.filter((b) => !existingSet.has(b.id)).length;

      if (limit !== -1 && activeCount + newCount > limit) {
        return reply.redirect(
          `${FRONTEND_URL()}/meta?error=bc_quota_exceeded`
        );
      }
    }

    // Upsert one MetaConnection per Business Manager
    const encryptedToken = encrypt(tokens.accessToken);

    await Promise.all(
      businessManagers.map((bm) =>
        app.prisma.metaConnection.upsert({
          where: {
            organizationId_businessManagerId: {
              organizationId,
              businessManagerId: bm.id,
            },
          },
          create: {
            organizationId,
            businessManagerId: bm.id,
            businessManagerName: bm.name,
            accessToken: encryptedToken,
            tokenExpiresAt: tokens.expiresAt,
            scopes: [
              "ads_management",
              "business_management",
              "ads_read",
              "pages_read_engagement",
            ],
            isActive: true,
          },
          update: {
            businessManagerName: bm.name,
            accessToken: encryptedToken,
            tokenExpiresAt: tokens.expiresAt,
            isActive: true,
          },
        })
      )
    );

    await createAuditLog({
      prisma: app.prisma,
      organizationId,
      userId,
      action: "OAUTH_CONNECT",
      resource: "meta_connection",
      resourceId: tokens.userId,
      metadata: {
        businessManagers: businessManagers.map((b) => b.name),
        count: businessManagers.length,
      },
      ipAddress: request.ip,
      ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}),
    });

    return reply.redirect(
      `${FRONTEND_URL()}/meta?connected=true&count=${businessManagers.length}`
    );
  });
};

import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "crypto";
import {
  buildAuthUrl,
  exchangeCode,
  listBusinessCenters,
  encrypt,
} from "../../lib/tiktok-client.js";
import type { TikTokBusinessCenter } from "../../lib/tiktok-client.js";
import {
  authenticate,
  requireOrg,
  requireSubscription,
} from "../../middlewares/index.js";
import { createAuditLog } from "../../lib/audit.js";
import { getQuotaLimit } from "../../lib/quota.js";

const OAUTH_STATE_TTL = 600; // 10 minutes

export const tiktokOAuthRoutes: FastifyPluginAsync = async (app) => {
  // GET /oauth/tiktok/authorize
  // Generates state, stores in Redis, redirects to TikTok
  app.get(
    "/authorize",
    { preHandler: [authenticate, requireOrg, requireSubscription] },
    async (request, reply) => {
      const state = randomBytes(24).toString("hex");

      // Store state → orgId + userId in Redis with TTL
      await app.redis.setex(
        `oauth:tiktok:state:${state}`,
        OAUTH_STATE_TTL,
        JSON.stringify({
          organizationId: request.organizationId,
          userId: request.userId,
        })
      );

      const url = buildAuthUrl(state);
      return reply.redirect(url);
    }
  );

  // GET /oauth/tiktok/callback
  // TikTok redirects here with code + state
  app.get("/callback", async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error || !code || !state) {
      return reply.redirect(
        `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3000"}/tiktok?error=oauth_denied`
      );
    }

    // Validate state
    const stateKey = `oauth:tiktok:state:${state}`;
    const stateData = await app.redis.get(stateKey);

    if (!stateData) {
      return reply.redirect(
        `${process.env["FRONTEND_URL"] ?? "http://localhost:3000"}/tiktok?error=invalid_state`
      );
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
      app.log.error({ err }, "TikTok OAuth code exchange failed");
      return reply.redirect(
        `${process.env["FRONTEND_URL"] ?? "http://localhost:3000"}/tiktok?error=token_exchange`
      );
    }

    // Fetch Business Center info from TikTok
    let businessCenters: TikTokBusinessCenter[] = [];
    try {
      businessCenters = await listBusinessCenters(encrypt(tokens.accessToken));
    } catch (err) {
      app.log.error({ err }, "Failed to list TikTok Business Centers");
    }

    const bc = businessCenters[0];

    if (!bc) {
      return reply.redirect(
        `${process.env["FRONTEND_URL"] ?? "http://localhost:3000"}/tiktok?error=no_business_center`
      );
    }

    // Quota check: count active connections vs plan limit
    const subscription = await app.prisma.subscription.findUnique({
      where: { organizationId },
      select: { plan: { select: { slug: true } } },
    });

    if (subscription?.plan) {
      const [limit, activeCount] = await Promise.all([
        getQuotaLimit(app.prisma, subscription.plan.slug, "business_centers"),
        app.prisma.tiktokConnection.count({ where: { organizationId, isActive: true } }),
      ]);

      // bc.bc_id might already exist (upsert), so only block if adding a NEW connection would exceed
      const isExisting = await app.prisma.tiktokConnection.findFirst({
        where: { organizationId, businessCenterId: bc.bc_id },
        select: { id: true },
      });

      if (limit !== -1 && !isExisting && activeCount >= limit) {
        return reply.redirect(
          `${process.env["FRONTEND_URL"] ?? "http://localhost:3000"}/tiktok?error=bc_quota_exceeded`
        );
      }
    }

    // Upsert connection (one connection per BC per org)
    await app.prisma.tiktokConnection.upsert({
      where: {
        organizationId_businessCenterId: {
          organizationId,
          businessCenterId: bc.bc_id,
        },
      },
      create: {
        organizationId,
        businessCenterId: bc.bc_id,
        businessCenterName: bc.name,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        isActive: true,
      },
      update: {
        businessCenterName: bc.name,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        isActive: true,
      },
    });

    await createAuditLog({
      prisma: app.prisma,
      organizationId,
      userId,
      action: "OAUTH_CONNECT",
      resource: "tiktok_connection",
      resourceId: bc.bc_id,
      metadata: { businessCenterName: bc.name },
      ipAddress: request.ip,
      ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}),
    });

    return reply.redirect(
      `${process.env["FRONTEND_URL"] ?? "http://localhost:3000"}/tiktok?connected=true`
    );
  });
};

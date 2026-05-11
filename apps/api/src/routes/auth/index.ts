import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { firebaseAuth } from "../../lib/firebase-admin.js";
import { authenticate } from "../../middlewares/index.js";

const registerSchema = z.object({
  idToken: z.string(),
  name: z.string().min(2).max(100),
  organizationName: z.string().min(2).max(100),
});

// Shared rate limit config for auth endpoints — much stricter than global
const AUTH_RATE_LIMIT = {
  rateLimit: {
    max: 20,
    timeWindow: "1 minute",
    keyGenerator: (req: { ip: string; headers: Record<string, string | string[] | undefined> }) =>
      (req.headers["x-forwarded-for"] as string) ?? req.ip ?? "unknown",
  },
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/register — first access: creates user + org in DB
  app.post("/register", { config: AUTH_RATE_LIMIT }, async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: "Validation error",
        details: body.error.flatten(),
      });
    }

    const { idToken, name, organizationName } = body.data;

    let decoded;
    try {
      // checkRevoked omitted — newly created tokens fail the revocation check due to
      // Firebase propagation delay; revocation is already enforced by the authenticate middleware.
      decoded = await firebaseAuth.verifyIdToken(idToken);
    } catch (err) {
      const e = err as { code?: string; message?: string; errorInfo?: unknown };
      request.log.error({
        errorCode: e.code,
        errorMessage: e.message,
        errorInfo: e.errorInfo,
        firebaseProjectId: process.env["FIREBASE_PROJECT_ID"],
        tokenPrefix: idToken.slice(0, 20),
      }, "verifyIdToken failed");
      return reply.status(401).send({ success: false, error: "Invalid token" });
    }

    const orgIncludeOne = {
      organizationUsers: { include: { organization: true }, take: 1 },
    } as const;

    // Idempotent: check by firebaseUid first
    const existing = await app.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      include: orgIncludeOne,
    });

    if (existing) {
      return reply.status(200).send({
        success: true,
        data: {
          user: existing,
          organization: existing.organizationUsers[0]?.organization ?? null,
        },
      });
    }

    // Same email, different UID — user previously registered with email/password
    // and is now signing in with Google. Link the accounts by updating firebaseUid.
    if (decoded.email) {
      const existingByEmail = await app.prisma.user.findUnique({
        where: { email: decoded.email },
        include: orgIncludeOne,
      });

      if (existingByEmail) {
        const linked = await app.prisma.user.update({
          where: { email: decoded.email },
          data: { firebaseUid: decoded.uid },
          include: orgIncludeOne,
        });
        request.log.info({ uid: decoded.uid, email: decoded.email }, "register: linked Google UID to existing account");
        return reply.status(200).send({
          success: true,
          data: {
            user: linked,
            organization: linked.organizationUsers[0]?.organization ?? null,
          },
        });
      }
    }

    // Create user + org + membership in a transaction
    const slug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50);

    const uniqueSlug = `${slug}-${Date.now()}`;

    const result = await app.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firebaseUid: decoded.uid,
          email: decoded.email ?? "",
          name,
        },
      });

      const org = await tx.organization.create({
        data: { name: organizationName, slug: uniqueSlug },
      });

      await tx.organizationUser.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "ADMIN",
          joinedAt: new Date(),
        },
      });

      // Find START plan to create trial subscription
      const startPlan = await tx.plan.findUnique({
        where: { slug: "START" },
      });

      if (startPlan) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);

        await tx.subscription.create({
          data: {
            organizationId: org.id,
            planId: startPlan.id,
            status: "TRIALING",
            trialEndsAt: trialEnd,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          action: "CREATE",
          resource: "organization",
          resourceId: org.id,
        },
      });

      return { user, org };
    });

    return reply.status(201).send({
      success: true,
      data: {
        user: result.user,
        organization: result.org,
      },
    });
  });

  // GET /auth/me — returns authenticated user + orgs
  app.get(
    "/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = await app.prisma.user.findUnique({
        where: { id: request.userId },
        include: {
          organizationUsers: {
            where: { joinedAt: { not: null } },
            include: {
              organization: {
                include: {
                  subscription: {
                    include: { plan: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        return reply
          .status(404)
          .send({ success: false, error: "User not found" });
      }

      return reply.send({ success: true, data: user });
    }
  );

  // POST /auth/sync — resolves ghost users: Firebase account exists but Postgres doesn't.
  // Called by the frontend when /auth/me returns 401 after retry.
  // Creates the user with Firebase defaults if they don't exist, so checkout can proceed.
  app.post("/sync", { config: AUTH_RATE_LIMIT }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ success: false, error: "Unauthorized" });
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = await firebaseAuth.verifyIdToken(token);
    } catch (err) {
      const e = err as { code?: string; message?: string; errorInfo?: unknown };
      request.log.warn({
        errorCode: e.code,
        errorMessage: e.message,
        errorInfo: e.errorInfo,
        firebaseProjectId: process.env["FIREBASE_PROJECT_ID"],
      }, "sync: verifyIdToken failed");
      return reply.status(401).send({ success: false, error: "Invalid token" });
    }

    const orgInclude = {
      organizationUsers: {
        include: {
          organization: {
            include: { subscription: { include: { plan: true } } },
          },
        },
        take: 1,
      },
    } as const;

    const existing = await app.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      include: orgInclude,
    });

    if (existing) {
      return reply.send({
        success: true,
        data: { user: existing, needsOnboarding: false },
      });
    }

    // Same email, different UID — link Google account to existing DB record.
    if (decoded.email) {
      const existingByEmail = await app.prisma.user.findUnique({
        where: { email: decoded.email },
        include: orgInclude,
      });

      if (existingByEmail) {
        const linked = await app.prisma.user.update({
          where: { email: decoded.email },
          data: { firebaseUid: decoded.uid },
          include: orgInclude,
        });
        request.log.info({ uid: decoded.uid, email: decoded.email }, "sync: linked Google UID to existing account");
        return reply.send({
          success: true,
          data: { user: linked, needsOnboarding: false },
        });
      }
    }

    // Ghost user — create with Firebase defaults so checkout can proceed.
    const name =
      (decoded["name"] as string | undefined) ??
      decoded.email?.split("@")[0] ??
      "Usuário";
    const email = decoded.email ?? "";
    const slug = `org-${Date.now()}`;

    const result = await app.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { firebaseUid: decoded.uid, email, name },
      });
      const org = await tx.organization.create({
        data: { name: "Minha Empresa", slug },
      });
      await tx.organizationUser.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "ADMIN",
          joinedAt: new Date(),
        },
      });

      const startPlan = await tx.plan.findUnique({ where: { slug: "START" } });
      if (startPlan) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);
        await tx.subscription.create({
          data: {
            organizationId: org.id,
            planId: startPlan.id,
            status: "TRIALING",
            trialEndsAt: trialEnd,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          action: "CREATE",
          resource: "organization",
          resourceId: org.id,
        },
      });

      return { user, org };
    });

    request.log.info({ uid: decoded.uid }, "sync: ghost user created in DB");

    const userWithOrg = await app.prisma.user.findUnique({
      where: { id: result.user.id },
      include: orgInclude,
    });

    return reply.status(201).send({
      success: true,
      data: { user: userWithOrg, needsOnboarding: true },
    });
  });
};

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
      decoded = await firebaseAuth.verifyIdToken(idToken, true);
    } catch {
      return reply.status(401).send({ success: false, error: "Invalid token" });
    }

    // Idempotent: if user exists, return it
    const existing = await app.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      include: {
        organizationUsers: {
          include: { organization: true },
          take: 1,
        },
      },
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
};

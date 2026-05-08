import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";
import { createAuditLog } from "../../lib/audit.js";

const patchOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional().nullable(),
});

const preHandler = [authenticate, requireOrg, requireSubscription];

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  // GET /organizations/:id
  app.get(
    "/:id",
    { preHandler },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (id !== request.organizationId) {
        return reply.status(403).send({ success: false, error: "Forbidden" });
      }

      const org = await app.prisma.organization.findUnique({
        where: { id },
        include: {
          subscription: {
            include: {
              plan: {
                include: { features: true, quotaLimits: true },
              },
            },
          },
        },
      });

      if (!org) {
        return reply
          .status(404)
          .send({ success: false, error: "Organization not found" });
      }

      return reply.send({ success: true, data: org });
    }
  );

  // PATCH /organizations/:id
  app.patch(
    "/:id",
    {
      preHandler: [
        ...preHandler,
        requirePermission("settings:write"),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (id !== request.organizationId) {
        return reply.status(403).send({ success: false, error: "Forbidden" });
      }

      const body = patchOrgSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: body.error.flatten(),
        });
      }

      const updated = await app.prisma.organization.update({
        where: { id },
        data: {
          ...(body.data.name && { name: body.data.name }),
          ...(body.data.logoUrl !== undefined && {
            logoUrl: body.data.logoUrl,
          }),
        },
      });

      await createAuditLog({
        prisma: app.prisma,
        organizationId: id,
        userId: request.userId,
        action: "UPDATE",
        resource: "organization",
        resourceId: id,
        metadata: body.data,
        ipAddress: request.ip,
      });

      return reply.send({ success: true, data: updated });
    }
  );
};

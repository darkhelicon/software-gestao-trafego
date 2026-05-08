import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";
import { createAuditLog } from "../../lib/audit.js";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "VIEWER"]).default("OPERATOR"),
});

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "VIEWER"]),
});

const preHandler = [authenticate, requireOrg, requireSubscription];

export const membersRoutes: FastifyPluginAsync = async (app) => {
  // GET /organizations/:id/members
  app.get(
    "/:id/members",
    {
      preHandler: [...preHandler, requirePermission("members:read")],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (id !== request.organizationId) {
        return reply.status(403).send({ success: false, error: "Forbidden" });
      }

      const members = await app.prisma.organizationUser.findMany({
        where: { organizationId: id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              createdAt: true,
            },
          },
        },
        orderBy: { invitedAt: "asc" },
      });

      return reply.send({ success: true, data: members });
    }
  );

  // POST /organizations/:id/members — invite by email
  app.post(
    "/:id/members",
    {
      preHandler: [...preHandler, requirePermission("members:write")],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (id !== request.organizationId) {
        return reply.status(403).send({ success: false, error: "Forbidden" });
      }

      const body = inviteSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: body.error.flatten(),
        });
      }

      const { email, role } = body.data;

      // Only ADMIN can invite other ADMINs
      if (role === "ADMIN" && request.orgRole !== "ADMIN") {
        return reply.status(403).send({
          success: false,
          error: "Only admins can invite other admins",
        });
      }

      // Find user by email
      const user = await app.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "User not found. They must create an account first.",
          code: "USER_NOT_FOUND",
        });
      }

      // Check if already a member
      const existing = await app.prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: {
            organizationId: id,
            userId: user.id,
          },
        },
      });

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: "User is already a member of this organization",
        });
      }

      const membership = await app.prisma.organizationUser.create({
        data: {
          organizationId: id,
          userId: user.id,
          role,
          invitedAt: new Date(),
          joinedAt: new Date(), // Auto-join (invite link flow can be added later)
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      await createAuditLog({
        prisma: app.prisma,
        organizationId: id,
        userId: request.userId,
        action: "CREATE",
        resource: "member",
        resourceId: user.id,
        metadata: { email, role },
        ipAddress: request.ip,
      });

      return reply.status(201).send({ success: true, data: membership });
    }
  );

  // PATCH /organizations/:id/members/:userId — update role
  app.patch(
    "/:id/members/:userId",
    {
      preHandler: [...preHandler, requirePermission("members:write")],
    },
    async (request, reply) => {
      const { id, userId } = request.params as {
        id: string;
        userId: string;
      };

      if (id !== request.organizationId) {
        return reply.status(403).send({ success: false, error: "Forbidden" });
      }

      // Prevent self-demotion
      if (userId === request.userId) {
        return reply.status(400).send({
          success: false,
          error: "You cannot change your own role",
        });
      }

      const body = updateRoleSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: body.error.flatten(),
        });
      }

      // Only ADMIN can assign ADMIN role
      if (body.data.role === "ADMIN" && request.orgRole !== "ADMIN") {
        return reply.status(403).send({
          success: false,
          error: "Only admins can promote to admin",
        });
      }

      const membership = await app.prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId: id, userId } },
      });

      if (!membership) {
        return reply
          .status(404)
          .send({ success: false, error: "Member not found" });
      }

      const updated = await app.prisma.organizationUser.update({
        where: { organizationId_userId: { organizationId: id, userId } },
        data: { role: body.data.role },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      await createAuditLog({
        prisma: app.prisma,
        organizationId: id,
        userId: request.userId,
        action: "UPDATE",
        resource: "member",
        resourceId: userId,
        metadata: { newRole: body.data.role },
        ipAddress: request.ip,
      });

      return reply.send({ success: true, data: updated });
    }
  );

  // DELETE /organizations/:id/members/:userId — remove member
  app.delete(
    "/:id/members/:userId",
    {
      preHandler: [...preHandler, requirePermission("members:delete")],
    },
    async (request, reply) => {
      const { id, userId } = request.params as {
        id: string;
        userId: string;
      };

      if (id !== request.organizationId) {
        return reply.status(403).send({ success: false, error: "Forbidden" });
      }

      if (userId === request.userId) {
        return reply.status(400).send({
          success: false,
          error: "You cannot remove yourself from the organization",
        });
      }

      const membership = await app.prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId: id, userId } },
      });

      if (!membership) {
        return reply
          .status(404)
          .send({ success: false, error: "Member not found" });
      }

      // ADMIN can only be removed by another ADMIN
      if (
        membership.role === "ADMIN" &&
        request.orgRole !== "ADMIN"
      ) {
        return reply.status(403).send({
          success: false,
          error: "Only admins can remove other admins",
        });
      }

      await app.prisma.organizationUser.delete({
        where: { organizationId_userId: { organizationId: id, userId } },
      });

      await createAuditLog({
        prisma: app.prisma,
        organizationId: id,
        userId: request.userId,
        action: "DELETE",
        resource: "member",
        resourceId: userId,
        ipAddress: request.ip,
      });

      return reply.status(204).send();
    }
  );
};

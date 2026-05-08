import type { FastifyPluginAsync } from "fastify";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";
import { createAuditLog } from "../../lib/audit.js";

const preHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission("accounts:read"),
];

export const tiktokConnectionRoutes: FastifyPluginAsync = async (app) => {
  // GET /tiktok/connections
  app.get("/", { preHandler }, async (request, reply) => {
    const connections = await app.prisma.tiktokConnection.findMany({
      where: { organizationId: request.organizationId, isActive: true },
      select: {
        id: true,
        businessCenterId: true,
        businessCenterName: true,
        tokenExpiresAt: true,
        scopes: true,
        createdAt: true,
        updatedAt: true,
        // Never expose raw tokens
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ success: true, data: connections });
  });

  // DELETE /tiktok/connections/:id — disconnect a Business Center
  app.delete(
    "/:id",
    {
      preHandler: [
        authenticate,
        requireOrg,
        requireSubscription,
        requirePermission("accounts:delete"),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const connection = await app.prisma.tiktokConnection.findFirst({
        where: { id, organizationId: request.organizationId },
      });

      if (!connection) {
        return reply
          .status(404)
          .send({ success: false, error: "Connection not found" });
      }

      // Soft delete: mark as inactive (keeps audit trail)
      await app.prisma.tiktokConnection.update({
        where: { id },
        data: { isActive: false },
      });

      await createAuditLog({
        prisma: app.prisma,
        organizationId: request.organizationId,
        userId: request.userId,
        action: "OAUTH_DISCONNECT",
        resource: "tiktok_connection",
        resourceId: id,
        metadata: { businessCenterId: connection.businessCenterId },
        ipAddress: request.ip,
      });

      return reply.status(204).send();
    }
  );
};

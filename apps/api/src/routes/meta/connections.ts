import type { FastifyPluginAsync } from "fastify";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";
import { createAuditLog } from "../../lib/audit.js";

const readHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission("accounts:read"),
];

export const metaConnectionRoutes: FastifyPluginAsync = async (app) => {
  // GET /meta/connections
  app.get("/", { preHandler: readHandler }, async (request, reply) => {
    const connections = await app.prisma.metaConnection.findMany({
      where: { organizationId: request.organizationId, isActive: true },
      select: {
        id: true,
        businessManagerId: true,
        businessManagerName: true,
        tokenExpiresAt: true,
        scopes: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ success: true, data: connections });
  });

  // DELETE /meta/connections/:id
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

      const connection = await app.prisma.metaConnection.findFirst({
        where: { id, organizationId: request.organizationId },
      });

      if (!connection) {
        return reply
          .status(404)
          .send({ success: false, error: "Connection not found" });
      }

      await app.prisma.metaConnection.update({
        where: { id },
        data: { isActive: false },
      });

      await createAuditLog({
        prisma: app.prisma,
        organizationId: request.organizationId,
        userId: request.userId,
        action: "OAUTH_DISCONNECT",
        resource: "meta_connection",
        resourceId: id,
        metadata: { businessManagerId: connection.businessManagerId },
        ipAddress: request.ip,
      });

      return reply.status(204).send();
    }
  );
};

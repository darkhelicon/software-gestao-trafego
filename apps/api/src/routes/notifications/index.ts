import type { FastifyPluginAsync } from "fastify";
import {
  authenticate,
  requireOrg,
  requireSubscription,
} from "../../middlewares/index.js";

const authHandler = [authenticate, requireOrg, requireSubscription];

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  // GET /notifications?page=1
  app.get("/", { preHandler: authHandler }, async (request, reply) => {
    const query = request.query as { page?: string; unreadOnly?: string };
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const pageSize = 30;
    const unreadOnly = query.unreadOnly === "true";

    const [items, total] = await Promise.all([
      app.prisma.notification.findMany({
        where: {
          organizationId: request.organizationId,
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      app.prisma.notification.count({
        where: {
          organizationId: request.organizationId,
          ...(unreadOnly ? { readAt: null } : {}),
        },
      }),
    ]);

    return reply.send({
      success: true,
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  });

  // GET /notifications/unread-count
  app.get("/unread-count", { preHandler: authHandler }, async (request, reply) => {
    const count = await app.prisma.notification.count({
      where: { organizationId: request.organizationId, readAt: null },
    });

    return reply.send({ success: true, data: { count } });
  });

  // PATCH /notifications/:id/read
  app.patch("/:id/read", { preHandler: authHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const notification = await app.prisma.notification.findFirst({
      where: { id, organizationId: request.organizationId },
    });
    if (!notification) {
      return reply.status(404).send({ success: false, error: "Notification not found" });
    }

    await app.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return reply.send({ success: true });
  });

  // POST /notifications/mark-all-read
  app.post("/mark-all-read", { preHandler: authHandler }, async (request, reply) => {
    await app.prisma.notification.updateMany({
      where: { organizationId: request.organizationId, readAt: null },
      data: { readAt: new Date() },
    });

    return reply.send({ success: true });
  });
};

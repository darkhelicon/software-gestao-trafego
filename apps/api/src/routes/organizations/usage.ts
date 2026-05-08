import type { FastifyPluginAsync } from "fastify";
import {
  authenticate,
  requireOrg,
  requireSubscription,
} from "../../middlewares/index.js";
import { getAllQuotaUsage, getQuotaLimit } from "../../lib/quota.js";
import type { QuotaResource } from "@adflow/types";

const RESOURCES: QuotaResource[] = [
  "campaigns_per_day",
  "ads_per_day",
  "business_centers",
  "advertiser_accounts",
];

export const usageRoutes: FastifyPluginAsync = async (app) => {
  // GET /organizations/:id/usage
  app.get(
    "/:id/usage",
    { preHandler: [authenticate, requireOrg, requireSubscription] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (id !== request.organizationId) {
        return reply.status(403).send({ success: false, error: "Forbidden" });
      }

      const [used, ...limits] = await Promise.all([
        getAllQuotaUsage(app.prisma, app.redis, id),
        ...RESOURCES.map((r) =>
          getQuotaLimit(app.prisma, request.planSlug, r)
        ),
      ]);

      const limitMap = Object.fromEntries(
        RESOURCES.map((r, i) => [r, limits[i]])
      ) as Record<QuotaResource, number>;

      const summary = RESOURCES.map((resource) => ({
        resource,
        used: (used as Record<QuotaResource, number>)[resource] ?? 0,
        limit: limitMap[resource] ?? 0,
        unlimited: limitMap[resource] === -1,
      }));

      return reply.send({ success: true, data: summary });
    }
  );

  // GET /organizations/:id/audit-logs
  app.get(
    "/:id/audit-logs",
    { preHandler: [authenticate, requireOrg, requireSubscription] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (id !== request.organizationId) {
        return reply.status(403).send({ success: false, error: "Forbidden" });
      }

      const query = request.query as {
        page?: string;
        pageSize?: string;
      };
      const page = Math.max(1, parseInt(query.page ?? "1", 10));
      const pageSize = Math.min(100, parseInt(query.pageSize ?? "20", 10));
      const skip = (page - 1) * pageSize;

      const [logs, total] = await Promise.all([
        app.prisma.auditLog.findMany({
          where: { organizationId: id },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        app.prisma.auditLog.count({ where: { organizationId: id } }),
      ]);

      return reply.send({
        success: true,
        data: {
          items: logs,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    }
  );
};

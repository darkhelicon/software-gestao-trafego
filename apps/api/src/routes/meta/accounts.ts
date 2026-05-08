import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { listAdAccounts } from "../../lib/meta-client.js";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";

const syncSchema = z.object({ connectionId: z.string() });

const readHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission("accounts:read"),
];

export const metaAccountRoutes: FastifyPluginAsync = async (app) => {
  // GET /meta/accounts
  app.get("/", { preHandler: readHandler }, async (request, reply) => {
    const accounts = await app.prisma.advertiserAccount.findMany({
      where: {
        organizationId: request.organizationId,
        platform: "META",
        isActive: true,
      },
      include: {
        metaConnection: {
          select: {
            id: true,
            businessManagerName: true,
            businessManagerId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ success: true, data: accounts });
  });

  // POST /meta/accounts/sync
  app.post(
    "/sync",
    {
      preHandler: [
        authenticate,
        requireOrg,
        requireSubscription,
        requirePermission("accounts:write"),
      ],
    },
    async (request, reply) => {
      const body = syncSchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          success: false,
          error: "Validation error",
          details: body.error.flatten(),
        });
      }

      const connection = await app.prisma.metaConnection.findFirst({
        where: {
          id: body.data.connectionId,
          organizationId: request.organizationId,
          isActive: true,
        },
      });

      if (!connection) {
        return reply
          .status(404)
          .send({ success: false, error: "Connection not found" });
      }

      let adAccounts;
      try {
        adAccounts = await listAdAccounts(
          connection.accessToken,
          connection.businessManagerId
        );
      } catch (err) {
        app.log.error({ err }, "Failed to sync Meta ad accounts");
        return reply.status(502).send({
          success: false,
          error: "Failed to fetch ad accounts from Meta API",
        });
      }

      const upserted = await Promise.all(
        adAccounts.map((acc) =>
          app.prisma.advertiserAccount.upsert({
            where: {
              organizationId_platform_externalId: {
                organizationId: request.organizationId,
                platform: "META",
                externalId: acc.id,
              },
            },
            create: {
              organizationId: request.organizationId,
              platform: "META",
              externalId: acc.id,
              name: acc.name,
              currency: acc.currency,
              timezone: acc.timezone_name,
              metaConnectionId: connection.id,
              isActive: true,
            },
            update: {
              name: acc.name,
              currency: acc.currency,
              timezone: acc.timezone_name,
              isActive: true,
            },
          })
        )
      );

      return reply.send({
        success: true,
        data: { synced: upserted.length, accounts: upserted },
      });
    }
  );
};

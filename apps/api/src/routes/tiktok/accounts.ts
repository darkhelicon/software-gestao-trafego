import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { listAdvertiserAccounts } from "../../lib/tiktok-client.js";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";

const syncSchema = z.object({
  connectionId: z.string(),
});

const preHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission("accounts:read"),
];

export const tiktokAccountRoutes: FastifyPluginAsync = async (app) => {
  // GET /tiktok/accounts
  app.get("/", { preHandler }, async (request, reply) => {
    const accounts = await app.prisma.advertiserAccount.findMany({
      where: {
        organizationId: request.organizationId,
        platform: "TIKTOK",
        isActive: true,
      },
      include: {
        tiktokConnection: {
          select: {
            id: true,
            businessCenterName: true,
            businessCenterId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ success: true, data: accounts });
  });

  // POST /tiktok/accounts/sync
  // Fetches advertiser accounts from TikTok API and upserts them in DB
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

      const connection = await app.prisma.tiktokConnection.findFirst({
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

      let advertisers;
      try {
        advertisers = await listAdvertiserAccounts(
          connection.accessToken,
          connection.businessCenterId
        );
      } catch (err) {
        app.log.error({ err }, "Failed to sync TikTok advertiser accounts");
        return reply.status(502).send({
          success: false,
          error: "Failed to fetch accounts from TikTok API",
        });
      }

      // Upsert all accounts
      const upserted = await Promise.all(
        advertisers.map((adv) =>
          app.prisma.advertiserAccount.upsert({
            where: {
              organizationId_platform_externalId: {
                organizationId: request.organizationId,
                platform: "TIKTOK",
                externalId: adv.advertiser_id,
              },
            },
            create: {
              organizationId: request.organizationId,
              platform: "TIKTOK",
              externalId: adv.advertiser_id,
              name: adv.advertiser_name,
              currency: adv.currency,
              timezone: adv.timezone,
              tiktokConnectionId: connection.id,
              isActive: true,
            },
            update: {
              name: adv.advertiser_name,
              currency: adv.currency,
              timezone: adv.timezone,
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

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";
import { assertSafeUrl } from "../../lib/ssrf-guard.js";
import { requireFeatureMiddleware } from "../../lib/feature-flags.js";

const writeHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requireFeatureMiddleware("automation_rules"),
  requirePermission("automations:write"),
];

const readHandler = [
  authenticate,
  requireOrg,
  requireSubscription,
  requireFeatureMiddleware("automation_rules"),
  requirePermission("automations:read"),
];

const configSchema = z.object({
  discordWebhook: z.string().url().optional().nullable(),
  telegramBotToken: z.string().optional().nullable(),
  telegramChatId: z.string().optional().nullable(),
  webhookUrl: z.string().url().optional().nullable(),
  webhookSecret: z.string().max(256).optional().nullable(),
});

export const automationConfigRoutes: FastifyPluginAsync = async (app) => {
  // GET /automation/config
  app.get("/", { preHandler: readHandler }, async (request, reply) => {
    const config = await app.prisma.notificationConfig.findUnique({
      where: { organizationId: request.organizationId },
    });

    return reply.send({ success: true, data: config ?? null });
  });

  // PUT /automation/config
  app.put("/", { preHandler: writeHandler }, async (request, reply) => {
    const parsed = configSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
    }

    // SSRF guard — validate URLs before persisting
    const urlsToCheck: Array<[string, string | null | undefined]> = [
      ["discordWebhook", parsed.data.discordWebhook],
      ["webhookUrl", parsed.data.webhookUrl],
    ];

    for (const [field, url] of urlsToCheck) {
      if (!url) continue;
      try {
        await assertSafeUrl(url);
      } catch (err) {
        return reply.status(400).send({
          success: false,
          error: `URL inválida para o campo '${field}': ${(err as Error).message}`,
        });
      }
    }

    const config = await app.prisma.notificationConfig.upsert({
      where: { organizationId: request.organizationId },
      update: {
        discordWebhook: parsed.data.discordWebhook ?? null,
        telegramBotToken: parsed.data.telegramBotToken ?? null,
        telegramChatId: parsed.data.telegramChatId ?? null,
        webhookUrl: parsed.data.webhookUrl ?? null,
        webhookSecret: parsed.data.webhookSecret ?? null,
      },
      create: {
        organizationId: request.organizationId,
        discordWebhook: parsed.data.discordWebhook ?? null,
        telegramBotToken: parsed.data.telegramBotToken ?? null,
        telegramChatId: parsed.data.telegramChatId ?? null,
        webhookUrl: parsed.data.webhookUrl ?? null,
        webhookSecret: parsed.data.webhookSecret ?? null,
      },
    });

    return reply.send({ success: true, data: config });
  });
};

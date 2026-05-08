import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  authenticate,
  requireOrg,
  requireSubscription,
  requirePermission,
} from "../../middlewares/index.js";

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

const ruleSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.enum(["TIKTOK", "META"]).optional(),
  condition: z.enum([
    "CPA_ABOVE",
    "CPA_BELOW",
    "ROAS_ABOVE",
    "ROAS_BELOW",
    "CTR_BELOW",
    "SPEND_ABOVE",
    "BALANCE_BELOW",
    "REJECTED",
  ]),
  conditionValue: z.number().min(0),
  action: z.enum([
    "PAUSE_CAMPAIGN",
    "RESUME_CAMPAIGN",
    "SCALE_BUDGET",
    "REDUCE_BUDGET",
    "DUPLICATE_CAMPAIGN",
    "SEND_ALERT",
  ]),
  actionValue: z.number().min(0).optional(),
  checkInterval: z.number().int().min(15).max(1440).default(60),
});

export const automationRulesRoutes: FastifyPluginAsync = async (app) => {
  // GET /automation/rules
  app.get("/", { preHandler: readHandler }, async (request, reply) => {
    const rules = await app.prisma.automationRule.findMany({
      where: { organizationId: request.organizationId },
      include: {
        logs: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { id: true, triggered: true, detail: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ success: true, data: rules });
  });

  // POST /automation/rules
  app.post("/", { preHandler: writeHandler }, async (request, reply) => {
    const parsed = ruleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid payload", details: parsed.error.flatten() });
    }

    const rule = await app.prisma.automationRule.create({
      data: {
        organizationId: request.organizationId,
        name: parsed.data.name,
        platform: parsed.data.platform ?? null,
        condition: parsed.data.condition,
        conditionValue: parsed.data.conditionValue,
        action: parsed.data.action,
        actionValue: parsed.data.actionValue ?? null,
        checkInterval: parsed.data.checkInterval,
      },
    });

    return reply.status(201).send({ success: true, data: rule });
  });

  // PUT /automation/rules/:id
  app.put("/:id", { preHandler: writeHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ruleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Invalid payload", details: parsed.error.flatten() });
    }

    const existing = await app.prisma.automationRule.findFirst({
      where: { id, organizationId: request.organizationId },
    });
    if (!existing) {
      return reply.status(404).send({ success: false, error: "Rule not found" });
    }

    const rule = await app.prisma.automationRule.update({
      where: { id },
      data: {
        name: parsed.data.name,
        platform: parsed.data.platform ?? null,
        condition: parsed.data.condition,
        conditionValue: parsed.data.conditionValue,
        action: parsed.data.action,
        actionValue: parsed.data.actionValue ?? null,
        checkInterval: parsed.data.checkInterval,
      },
    });

    return reply.send({ success: true, data: rule });
  });

  // PATCH /automation/rules/:id/toggle
  app.patch("/:id/toggle", { preHandler: writeHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await app.prisma.automationRule.findFirst({
      where: { id, organizationId: request.organizationId },
    });
    if (!existing) {
      return reply.status(404).send({ success: false, error: "Rule not found" });
    }

    const rule = await app.prisma.automationRule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return reply.send({ success: true, data: rule });
  });

  // DELETE /automation/rules/:id
  app.delete("/:id", { preHandler: writeHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await app.prisma.automationRule.findFirst({
      where: { id, organizationId: request.organizationId },
    });
    if (!existing) {
      return reply.status(404).send({ success: false, error: "Rule not found" });
    }

    await app.prisma.automationRule.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // GET /automation/rules/:id/logs
  app.get("/:id/logs", { preHandler: readHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await app.prisma.automationRule.findFirst({
      where: { id, organizationId: request.organizationId },
    });
    if (!existing) {
      return reply.status(404).send({ success: false, error: "Rule not found" });
    }

    const logs = await app.prisma.automationLog.findMany({
      where: { ruleId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return reply.send({ success: true, data: logs });
  });
};

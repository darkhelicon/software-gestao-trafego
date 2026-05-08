import type { FastifyPluginAsync } from "fastify";
import { Queue } from "bullmq";
import { isDemoMode } from "../lib/demo-mode.js";

const VERSION = process.env["npm_package_version"] ?? "0.0.0";
const STARTED_AT = Date.now();

const QUEUE_NAMES = [
  "campaign.create",
  "metrics.sync",
  "automation.evaluate",
  "notification.send",
] as const;

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get("/health", { logLevel: "silent" }, async (_request, reply) => {
    const [dbResult, redisResult] = await Promise.allSettled([
      app.prisma.$queryRaw`SELECT 1`,
      app.redis.ping(),
    ]);

    const dbOk = dbResult.status === "fulfilled";
    const redisOk = redisResult.status === "fulfilled";

    // Queue stats — best-effort, don't fail health check if unavailable
    let queues: Record<string, { waiting: number; active: number; failed: number }> = {};
    if (redisOk && !isDemoMode()) {
      const results = await Promise.allSettled(
        QUEUE_NAMES.map(async (name) => {
          const q = new Queue(name, { connection: app.redis });
          const counts = await q.getJobCounts("waiting", "active", "failed");
          await q.close();
          return { name, counts };
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          queues[r.value.name] = r.value.counts as { waiting: number; active: number; failed: number };
        }
      }
    }

    const healthy = dbOk && redisOk;
    const uptimeSeconds = Math.floor((Date.now() - STARTED_AT) / 1000);

    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      version: VERSION,
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? "ok" : "error",
        redis: redisOk ? "ok" : "error",
      },
      queues,
    });
  });
};

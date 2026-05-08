import { Worker } from "bullmq";
import { redisConnection } from "./queues/index.js";
import { prisma } from "@helzo-scale/database";
import { initSentry, captureJobException, flushSentry } from "./lib/sentry.js";

initSentry();
import { processCampaignCreate } from "./processors/campaign-create.js";
import { processMetricsSync } from "./processors/metrics-sync.js";
import { processAutomationEvaluate } from "./processors/automation-evaluate.js";
import { processNotificationSend } from "./processors/notification-send.js";
import { refreshExpiringTokens } from "./processors/token-refresh.js";

// Cloud Run requires the container to respond to HTTP requests.
// We expose a minimal health endpoint so Cloud Run keeps the worker alive.
import { createServer } from "http";

const PORT = parseInt(process.env["PORT"] ?? "8080", 10);
createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "worker" }));
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
}).listen(PORT, () => {
  console.log(`[worker] Health server listening on :${PORT}`);
});

console.log("[worker] Starting...");

// ========================
// Campaign creation worker
// ========================
const campaignWorker = new Worker(
  "campaign.create",
  processCampaignCreate,
  {
    connection: redisConnection,
    concurrency: 10,
    limiter: { max: 50, duration: 1000 }, // 50 jobs/sec max (TikTok rate limit)
  }
);

// ========================
// Metrics sync
// ========================
const metricsWorker = new Worker(
  "metrics.sync",
  processMetricsSync,
  { connection: redisConnection, concurrency: 5 }
);

// ========================
// Automation engine
// ========================
const automationWorker = new Worker(
  "automation.evaluate",
  processAutomationEvaluate,
  { connection: redisConnection, concurrency: 3 }
);

// ========================
// Notifications
// ========================
const notificationWorker = new Worker(
  "notification.send",
  processNotificationSend,
  { connection: redisConnection, concurrency: 5 }
);

const workers = [
  campaignWorker,
  metricsWorker,
  automationWorker,
  notificationWorker,
];

for (const worker of workers) {
  worker.on("completed", (job) => {
    console.log(`[${worker.name}] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[${worker.name}] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
    captureJobException(err, {
      queue: worker.name,
      ...(job?.id !== undefined ? { jobId: job.id } : {}),
      ...(job?.data !== undefined ? { jobData: job.data } : {}),
    });
  });

  worker.on("error", (err) => {
    console.error(`[${worker.name}] Worker error:`, err);
    captureJobException(err, { queue: worker.name });
  });
}

// ========================
// Token refresh cron (hourly)
// ========================
async function startTokenRefreshCron() {
  const ONE_HOUR = 60 * 60 * 1000;

  async function tick() {
    try {
      await refreshExpiringTokens();
    } catch (err) {
      console.error("[token-refresh] Cron tick error:", err);
    }
  }

  await tick(); // Run immediately on boot
  setInterval(tick, ONE_HOUR);
}

startTokenRefreshCron().catch(console.error);

// ========================
// Metrics sync cron (every 6 hours)
// ========================
async function startMetricsSyncCron() {
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  async function tick() {
    try {
      // Re-use the pre-created queue from queues/index.ts — no new instance per tick
      const { metricsQueue } = await import("./queues/index.js");

      const accounts = await prisma.advertiserAccount.findMany({
        where: { isActive: true },
        select: { id: true, organizationId: true, platform: true },
      });

      const end = new Date().toISOString().split("T")[0]!;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 2);
      const start = startDate.toISOString().split("T")[0]!;

      await Promise.all(
        accounts.map((acct) =>
          metricsQueue.add(
            "sync",
            {
              organizationId: acct.organizationId,
              advertiserAccountId: acct.id,
              platform: acct.platform,
              startDate: start,
              endDate: end,
            },
            { removeOnComplete: 20, removeOnFail: 10 }
          )
        )
      );

      console.log(`[metrics-cron] Enqueued ${accounts.length} sync jobs`);
    } catch (err) {
      console.error("[metrics-cron] Cron tick error:", err);
    }
  }

  setInterval(tick, SIX_HOURS);
}

startMetricsSyncCron().catch(console.error);

// ========================
// Automation evaluation cron (every 15 minutes)
// ========================
async function startAutomationCron() {
  const FIFTEEN_MIN = 15 * 60 * 1000;

  async function tick() {
    try {
      const { automationQueue } = await import("./queues/index.js");

      const now = new Date();
      const rules = await prisma.automationRule.findMany({
        where: { isActive: true },
        select: { id: true, checkInterval: true, lastRunAt: true },
      });

      const due = rules.filter((rule) => {
        if (!rule.lastRunAt) return true;
        const nextRun = new Date(rule.lastRunAt.getTime() + rule.checkInterval * 60 * 1000);
        return nextRun <= now;
      });

      await Promise.all(
        due.map((rule) =>
          automationQueue.add(
            "evaluate",
            { ruleId: rule.id },
            { removeOnComplete: 20, removeOnFail: 10 }
          )
        )
      );

      if (due.length) {
        console.log(`[automation-cron] Enqueued ${due.length} rule evaluations`);
      }
    } catch (err) {
      console.error("[automation-cron] Tick error:", err);
    }
  }

  await tick(); // Run immediately on boot
  setInterval(tick, FIFTEEN_MIN);
}

startAutomationCron().catch(console.error);

// ========================
// Graceful shutdown
// ========================
async function shutdown() {
  console.log("[worker] Shutting down...");
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  await flushSentry();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[worker] Ready. Listening for jobs...");

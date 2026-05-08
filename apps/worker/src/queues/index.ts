import { Queue } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis(
  process.env["REDIS_URL"] ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export const campaignQueue = new Queue("campaign.create", {
  connection,
  defaultJobOptions,
});

export const metricsQueue = new Queue("metrics.sync", {
  connection,
  defaultJobOptions,
});

export const automationQueue = new Queue("automation.evaluate", {
  connection,
  defaultJobOptions,
});

export const notificationQueue = new Queue("notification.send", {
  connection,
  defaultJobOptions,
});

export { connection as redisConnection };

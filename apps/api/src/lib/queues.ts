import { Queue } from "bullmq";
import type { Redis } from "ioredis";

let _campaignQueue: Queue | null = null;

export function getCampaignQueue(redis: Redis): Queue {
  if (!_campaignQueue) {
    _campaignQueue = new Queue("campaign.create", {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return _campaignQueue;
}

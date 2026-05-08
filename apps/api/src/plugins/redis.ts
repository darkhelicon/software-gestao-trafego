import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { isDemoMode } from "../lib/demo-mode.js";
import { mockRedisClient } from "../mocks/redis.mock.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export const redisPlugin = fp(async (app) => {
  if (isDemoMode()) {
    app.decorate("redis", mockRedisClient);
    return;
  }

  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redis.connect();

  redis.on("error", (err: Error) => {
    app.log.error({ err }, "Redis connection error");
  });

  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    await redis.quit();
  });
});

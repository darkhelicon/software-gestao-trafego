import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

export const rateLimitPlugin = fp(async (app) => {
  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
    keyGenerator: (request) =>
      (request.headers["x-forwarded-for"] as string) ??
      request.ip ??
      "unknown",
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: "Too many requests",
      retryAfter: context.after,
    }),
  });
});

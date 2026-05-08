import fp from "fastify-plugin";

const SLOW_THRESHOLD_MS = 1000;

export const requestContextPlugin = fp(async (app) => {
  // Attach X-Request-Id to every response
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Request-Id", request.id);
    return payload;
  });

  // Warn on slow requests and log completion with auth context
  app.addHook("onResponse", async (request, reply) => {
    const duration = Math.round(reply.elapsedTime);
    const ctx = {
      requestId: request.id,
      method: request.method,
      url: request.routeOptions?.url ?? request.url,
      statusCode: reply.statusCode,
      duration,
      ip: request.ip,
      userId: (request as unknown as Record<string, unknown>)["userId"] as string | undefined,
      orgId: (request as unknown as Record<string, unknown>)["organizationId"] as string | undefined,
    };

    if (duration >= SLOW_THRESHOLD_MS) {
      request.log.warn(ctx, "Slow request detected");
    }
  });
});

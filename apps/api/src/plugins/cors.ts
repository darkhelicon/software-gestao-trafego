import fp from "fastify-plugin";
import cors from "@fastify/cors";

// Cloud Run generates new URL hashes on each deploy when using `gcloud run services replace`.
// We allow any Cloud Run URL that belongs to our web service rather than hardcoding a single hash.
const CLOUD_RUN_WEB_PATTERN = /^https:\/\/helzo-scale-web-[a-z0-9]+-[a-z0-9]+\.run\.app$/;

export const corsPlugin = fp(async (app) => {
  const allowedOrigins =
    process.env["NODE_ENV"] === "production"
      ? (process.env["ALLOWED_ORIGINS"] ?? "").split(",").filter(Boolean)
      : ["http://localhost:3000", "http://localhost:3001"];

  app.log.info({ allowedOrigins }, "CORS: configured origins");

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        // Server-to-server or same-origin — allow
        cb(null, true);
        return;
      }

      // Exact match against configured origins
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }

      // Cloud Run URL pattern: helzo-scale-web-<hash>-<region>.run.app
      // This handles URL changes after `gcloud run services replace` without
      // needing a secret update on every deploy.
      if (CLOUD_RUN_WEB_PATTERN.test(origin)) {
        cb(null, true);
        return;
      }

      app.log.warn({ origin, allowedOrigins }, "CORS: rejected origin");
      cb(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Organization-Id",
      "X-Request-Id",
    ],
    credentials: true,
    maxAge: 86400,
  });
});

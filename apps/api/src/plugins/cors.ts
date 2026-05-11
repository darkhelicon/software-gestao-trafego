import fp from "fastify-plugin";
import cors from "@fastify/cors";

// Cloud Run exposes two URL formats for each service:
//   1. Hash format:          helzo-scale-web-{hash}-{region-short}.a.run.app
//   2. Project-number format: helzo-scale-web-{project-number}.{region}.run.app
// Both must be accepted so CORS preflight works regardless of which URL the user opens.
const CLOUD_RUN_WEB_PATTERN =
  /^https:\/\/helzo-scale-web-[a-z0-9]+(?:-[a-z0-9]+)?\.(?:[a-z0-9-]+\.)?run\.app$/;

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

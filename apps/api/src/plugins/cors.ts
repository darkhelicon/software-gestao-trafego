import fp from "fastify-plugin";
import cors from "@fastify/cors";

export const corsPlugin = fp(async (app) => {
  const allowedOrigins =
    process.env["NODE_ENV"] === "production"
      ? (process.env["ALLOWED_ORIGINS"] ?? "").split(",").filter(Boolean)
      : ["http://localhost:3000"];

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false); // reject without throwing — prevents @fastify/cors from propagating as 500
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

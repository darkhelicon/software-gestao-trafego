import fp from "fastify-plugin";
import helmet from "@fastify/helmet";

const isProd = process.env["NODE_ENV"] === "production";

export const helmetPlugin = fp(async (app) => {
  await app.register(helmet, {
    // HSTS: 1 year, include subdomains, allow preload list submission
    hsts: isProd
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,

    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        // Explicitly block framing — stronger than the default SAMEORIGIN
        frameAncestors: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },

    // Restrict browser features
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },

    // Prevent MIME sniffing
    noSniff: true,

    // Hide server identity
    hidePoweredBy: true,

    // Disable XSS filter (deprecated, but prevent browser quirks)
    xssFilter: false,

    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });

  // Permissions-Policy header (not yet in @fastify/helmet, added manually)
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    );
    return payload;
  });
});

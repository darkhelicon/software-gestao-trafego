import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: process.env["NODE_ENV"] ?? "development",
    // Sample 10% of traces in production to control cost
    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.1 : 0,
    // Don't send PII by default
    sendDefaultPii: false,
  });

  initialized = true;
}

export function captureException(
  err: unknown,
  context?: Record<string, unknown>
): void {
  if (!initialized) return;
  Sentry.withScope((scope: Sentry.Scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized) return;
  await Sentry.close(timeoutMs);
}

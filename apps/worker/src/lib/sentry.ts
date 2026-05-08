import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: process.env["NODE_ENV"] ?? "development",
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });

  initialized = true;
  console.log("[sentry] Initialized for worker");
}

export function captureJobException(
  err: unknown,
  context: { queue: string; jobId?: string; jobData?: unknown }
): void {
  if (!initialized) {
    console.error(`[${context.queue}] Job error:`, err);
    return;
  }
  Sentry.withScope((scope: Sentry.Scope) => {
    scope.setTag("queue", context.queue);
    if (context.jobId) scope.setTag("jobId", context.jobId);
    if (context.jobData) scope.setExtra("jobData", context.jobData);
    Sentry.captureException(err);
  });
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized) return;
  await Sentry.close(timeoutMs);
}

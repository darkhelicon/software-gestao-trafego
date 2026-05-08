// Demo/Staging mode — never runs in production.
// Activate with DEMO_MODE=true (+ NODE_ENV != production).
export const isDemoMode = (): boolean =>
  process.env["DEMO_MODE"] === "true" && process.env["NODE_ENV"] !== "production";

export const DEMO_USER_ID = "demo-user-id";
export const DEMO_FIREBASE_UID = "demo-firebase-uid";
export const DEMO_USER_EMAIL = "demo@adflow.com";
export const DEMO_ORG_ID = "demo-org-id";
export const DEMO_ORG_ROLE = "ADMIN" as const;
export const DEMO_PLAN_SLUG = "GROWTH" as const;
export const DEMO_SUBSCRIPTION_STATUS = "ACTIVE" as const;

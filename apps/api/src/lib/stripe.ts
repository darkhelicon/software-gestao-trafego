import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env["STRIPE_SECRET_KEY"] ?? "";

// stripe is initialized lazily — it will error at runtime if STRIPE_SECRET_KEY is not set,
// but does not prevent the process from starting (so health checks and non-billing routes work).
export const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    })
  : (null as unknown as Stripe);

export const STRIPE_PRICES: Record<string, string> = {
  START: process.env["STRIPE_PRICE_START"] ?? "",
  GROWTH: process.env["STRIPE_PRICE_GROWTH"] ?? "",
  SCALE: process.env["STRIPE_PRICE_SCALE"] ?? "",
  ENTERPRISE: process.env["STRIPE_PRICE_ENTERPRISE"] ?? "",
};

import type { OrgContext } from "@/store/auth";

export const DEMO_MODE = process.env["NEXT_PUBLIC_DEMO_MODE"] === "true";

// Injected into Zustand store when NEXT_PUBLIC_DEMO_MODE=true.
// Shape must match OrgContext in store/auth.ts.
export const DEMO_ORG: OrgContext = {
  id: "demo-org-id",
  name: "Demo Agency",
  slug: "demo-agency",
  role: "ADMIN",
  subscription: {
    status: "ACTIVE",
    plan: { slug: "GROWTH", name: "Growth" },
  },
};

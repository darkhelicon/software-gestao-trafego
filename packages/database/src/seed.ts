import { prisma } from "./index.js";
import type { PlanSlug } from "@prisma/client";

const plans: Array<{
  slug: PlanSlug;
  name: string;
  description: string;
  priceMonthly: number;
  features: string[];
  quotas: Record<string, number>;
}> = [
  {
    slug: "START",
    name: "Start",
    description: "Entrada para quem está começando a operar campanhas.",
    priceMonthly: 197,
    features: ["dashboard_basic", "mass_appeal"],
    quotas: {
      campaigns_per_day: 20,
      ads_per_day: 60,
      business_centers: 3,
      advertiser_accounts: -1,
    },
  },
  {
    slug: "GROWTH",
    name: "Growth",
    description: "Para quem já possui operação com maior volume.",
    priceMonthly: 497,
    features: [
      "dashboard_basic",
      "mass_appeal",
      "campaign_templates",
      "mass_creation_queue",
      "reports_per_account",
    ],
    quotas: {
      campaigns_per_day: 40,
      ads_per_day: 120,
      business_centers: 6,
      advertiser_accounts: -1,
    },
  },
  {
    slug: "SCALE",
    name: "Scale",
    description: "Para operações de alta performance.",
    priceMonthly: 697,
    features: [
      "dashboard_basic",
      "mass_appeal",
      "campaign_templates",
      "mass_creation_queue",
      "reports_per_account",
      "automation_rules",
      "performance_alerts",
      "advanced_metrics_sync",
    ],
    quotas: {
      campaigns_per_day: 80,
      ads_per_day: 240,
      business_centers: 12,
      advertiser_accounts: -1,
    },
  },
  {
    slug: "ENTERPRISE",
    name: "Enterprise",
    description: "Para agências e operações grandes.",
    priceMonthly: 1397,
    features: [
      "dashboard_basic",
      "mass_appeal",
      "campaign_templates",
      "mass_creation_queue",
      "reports_per_account",
      "automation_rules",
      "performance_alerts",
      "advanced_metrics_sync",
      "priority_support",
      "custom_limits",
      "webhooks",
      "advanced_integrations",
    ],
    quotas: {
      campaigns_per_day: -1,
      ads_per_day: -1,
      business_centers: -1,
      advertiser_accounts: -1,
    },
  },
];

async function seed() {
  console.log("Seeding plans...");

  for (const plan of plans) {
    const created = await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        features: {
          create: plan.features.map((f) => ({ feature: f, enabled: true })),
        },
        quotaLimits: {
          create: Object.entries(plan.quotas).map(([resource, limit]) => ({
            resource,
            limit,
          })),
        },
      },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
      },
    });
    console.log(`  Upserted plan: ${created.slug}`);
  }

  console.log("Seed complete.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

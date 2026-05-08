"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PlanCard } from "@/components/billing/plan-card";

interface Plan {
  id: string;
  slug: "START" | "GROWTH" | "SCALE" | "ENTERPRISE";
  name: string;
  priceMonthly: number;
  description: string;
  features: Array<{ feature: string; enabled: boolean }>;
}

const PLAN_PRICES: Record<string, number> = {
  START: 197,
  GROWTH: 497,
  SCALE: 697,
  ENTERPRISE: 1397,
};

export default function BillingPage() {
  const { currentOrg, isLoading } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [fetchingPlans, setFetchingPlans] = useState(true);

  useEffect(() => {
    fetch(`${process.env["NEXT_PUBLIC_API_URL"]}/api/v1/billing/plans`)
      .then((r) => r.json())
      .then((json: { success: boolean; data: Plan[] }) => {
        if (json.success) setPlans(json.data);
      })
      .catch(console.error)
      .finally(() => setFetchingPlans(false));
  }, []);

  if (isLoading || fetchingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Carregando planos...</div>
      </div>
    );
  }

  const currentPlanSlug = currentOrg?.subscription?.plan.slug;
  const hasActiveSubscription =
    currentOrg?.subscription &&
    ["TRIALING", "ACTIVE"].includes(currentOrg.subscription.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">
            Escolha seu plano
          </h1>
          {!hasActiveSubscription && (
            <p className="mt-3 text-gray-600">
              Você precisa de uma assinatura ativa para acessar a plataforma.
            </p>
          )}
          {hasActiveSubscription && (
            <p className="mt-3 text-gray-600">
              Gerencie ou faça upgrade do seu plano atual.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              slug={plan.slug}
              name={plan.name}
              price={PLAN_PRICES[plan.slug] ?? Number(plan.priceMonthly)}
              description={plan.description ?? ""}
              features={plan.features
                .filter((f) => f.enabled)
                .map((f) => f.feature)}
              isPopular={plan.slug === "SCALE"}
              isCurrent={currentPlanSlug === plan.slug}
            />
          ))}
        </div>

        {hasActiveSubscription && (
          <div className="text-center mt-10">
            <a
              href="/dashboard"
              className="text-sm text-blue-600 hover:underline"
            >
              Voltar ao dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

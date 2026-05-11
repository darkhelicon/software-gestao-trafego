"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
    fetch(`${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001"}/api/v1/billing/plans`)
      .then((r) => r.json())
      .then((json: { success: boolean; data: Plan[] }) => {
        if (json.success) setPlans(json.data);
      })
      .catch(console.error)
      .finally(() => setFetchingPlans(false));
  }, []);

  const subscriptionStatus = currentOrg?.subscription?.status;
  // Only mark a plan as "current" when paid — TRIALING users haven't paid yet
  // and must be able to click "Assinar agora" on any plan (including START).
  const currentPlanSlug =
    subscriptionStatus === "ACTIVE" ? currentOrg?.subscription?.plan.slug : undefined;
  const isTrialing = subscriptionStatus === "TRIALING";
  const hasActiveSubscription =
    currentOrg?.subscription &&
    ["TRIALING", "ACTIVE"].includes(subscriptionStatus ?? "");

  if (isLoading || fetchingPlans) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Carregando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-400/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Image src="/helzo-scale-logo.png" alt="Helzo Scale" width={140} height={45} className="h-8 w-auto" />
          </Link>
          {hasActiveSubscription && (
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              ← Voltar ao dashboard
            </Link>
          )}
        </div>
      </header>

      <div className="relative max-w-6xl mx-auto px-4 py-16">
        {/* Heading */}
        <div className="text-center mb-14">
          {subscriptionStatus === "ACTIVE" ? (
            <>
              <h1 className="text-4xl font-extrabold text-white mb-3">
                Gerencie sua assinatura
              </h1>
              <p className="text-gray-400 max-w-md mx-auto">
                Faça upgrade, downgrade ou cancele a qualquer momento.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-extrabold text-white mb-3">
                Escolha seu plano
              </h1>
              <p className="text-gray-400 max-w-md mx-auto">
                Você precisa de uma assinatura ativa para acessar a plataforma.
                Cancele a qualquer momento, sem fidelidade.
              </p>
            </>
          )}
        </div>

        {/* Trial banner */}
        {isTrialing && (
          <div className="mb-8 text-center bg-brand-400/10 border border-brand-400/20 rounded-xl px-6 py-4">
            <p className="text-brand-400 font-medium text-sm">
              Você está no período de teste gratuito de 7 dias do plano Start.
              Escolha um plano abaixo para continuar após o trial.
            </p>
          </div>
        )}

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.length > 0 ? (
            plans.map((plan) => (
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
            ))
          ) : (
            // Fallback: static plans if API fails
            [
              { slug: "START" as const, name: "Start", price: 197, description: "Para quem está começando.", features: ["3 Business Centers", "20 campanhas/dia", "Dashboard básico"] },
              { slug: "GROWTH" as const, name: "Growth", price: 497, description: "Para operações em crescimento.", features: ["6 Business Centers", "40 campanhas/dia", "Templates", "Relatórios"] },
              { slug: "SCALE" as const, name: "Scale", price: 697, description: "Para alta performance.", features: ["12 Business Centers", "80 campanhas/dia", "Automações", "Alertas"] },
              { slug: "ENTERPRISE" as const, name: "Enterprise", price: 1397, description: "Para agências e grandes operações.", features: ["Business Centers ilimitados", "Campanhas ilimitadas", "Suporte prioritário"] },
            ].map((plan) => (
              <PlanCard
                key={plan.slug}
                slug={plan.slug}
                name={plan.name}
                price={plan.price}
                description={plan.description}
                features={plan.features}
                isPopular={plan.slug === "SCALE"}
                isCurrent={currentPlanSlug === plan.slug}
              />
            ))
          )}
        </div>

        {/* Trust signals */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Pagamento seguro via Stripe
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Cancele a qualquer momento
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Sem fidelidade
          </span>
        </div>
      </div>
    </div>
  );
}

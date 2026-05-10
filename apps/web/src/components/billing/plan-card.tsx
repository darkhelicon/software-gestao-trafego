"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface PlanCardProps {
  slug: "START" | "GROWTH" | "SCALE" | "ENTERPRISE";
  name: string;
  price: number;
  description: string;
  features: string[];
  isPopular?: boolean;
  isCurrent?: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  dashboard_basic: "Dashboard básico",
  mass_appeal: "Apelação em massa",
  campaign_templates: "Templates de campanha",
  mass_creation_queue: "Fila de criação em massa",
  reports_per_account: "Relatórios por conta",
  automation_rules: "Automações de regras",
  performance_alerts: "Alertas de performance",
  advanced_metrics_sync: "Métricas avançadas",
  priority_support: "Suporte prioritário",
  custom_limits: "Limites personalizados",
  webhooks: "Webhooks",
  advanced_integrations: "Integrações avançadas",
};

export function PlanCard({
  slug,
  name,
  price,
  description,
  features,
  isPopular,
  isCurrent,
}: PlanCardProps) {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSelect() {
    setErrorMsg(null);

    if (!currentOrg?.id) {
      // Check if Firebase user exists — authenticated but no org means incomplete registration
      if (firebaseUser) {
        window.location.href = "/register";
      } else {
        window.location.href = "/login";
      }
      return;
    }

    setIsLoading(true);
    try {
      const data = await api.post<{ url: string }>(
        "/api/v1/billing/checkout",
        {
          planSlug: slug,
          successUrl: `${window.location.origin}/dashboard?subscribed=true`,
          cancelUrl: `${window.location.origin}/billing`,
        },
        { organizationId: currentOrg.id }
      );
      window.location.href = data.url;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao iniciar checkout.";
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
        isPopular
          ? "border-brand-400 bg-brand-400/5 shadow-lg shadow-brand-400/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="text-xs font-bold text-black bg-brand-400 px-3 py-1 rounded-full whitespace-nowrap">
            Mais popular
          </span>
        </div>
      )}

      {isCurrent && (
        <div className="absolute -top-3 right-4">
          <span className="text-xs font-bold text-brand-400 bg-brand-400/10 border border-brand-400/30 px-3 py-1 rounded-full whitespace-nowrap">
            Plano atual
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
        <p className="text-gray-500 text-sm mb-4">{description}</p>
        <p className="text-4xl font-extrabold text-white">
          R$ {price.toLocaleString("pt-BR")}
          <span className="text-base font-normal text-gray-500">/mês</span>
        </p>
      </div>

      <ul className="space-y-2.5 flex-1 mb-8">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
            <svg
              className="w-4 h-4 text-brand-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {FEATURE_LABELS[f] ?? f}
          </li>
        ))}
      </ul>

      {errorMsg && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 mb-3 border border-red-400/20">
          {errorMsg}
        </p>
      )}

      <button
        disabled={isCurrent || isLoading}
        onClick={handleSelect}
        className={`w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center transition-colors disabled:opacity-50 disabled:pointer-events-none ${
          isPopular
            ? "bg-brand-400 text-black hover:bg-brand-500"
            : "border border-white/10 text-white hover:border-white/25 hover:bg-white/5"
        }`}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processando...
          </span>
        ) : isCurrent ? (
          "Plano atual"
        ) : (
          "Assinar agora"
        )}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  advanced_metrics_sync: "Sincronização avançada de métricas",
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
  const [isLoading, setIsLoading] = useState(false);

  async function handleSelect() {
    setIsLoading(true);
    try {
      const data = await api.post<{ url: string }>(
        "/api/v1/billing/checkout",
        {
          planSlug: slug,
          successUrl: `${window.location.origin}/dashboard?subscribed=true`,
          cancelUrl: `${window.location.origin}/billing`,
        },
        { organizationId: currentOrg?.id }
      );
      window.location.href = data.url;
    } catch {
      alert("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card highlight={isPopular ?? false} className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between mb-1">
          <CardTitle>{name}</CardTitle>
          {isPopular && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Mais popular
            </span>
          )}
          {isCurrent && (
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              Plano atual
            </span>
          )}
        </div>
        <p className="text-3xl font-bold text-gray-900">
          R$ {price.toLocaleString("pt-BR")}
          <span className="text-sm font-normal text-gray-500">/mês</span>
        </p>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </CardHeader>

      <CardContent className="flex-1">
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
              <svg
                className="w-4 h-4 text-green-500 shrink-0"
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
      </CardContent>

      <div className="mt-6">
        <Button
          className="w-full"
          variant={isPopular ? "primary" : "secondary"}
          size="lg"
          isLoading={isLoading}
          disabled={isCurrent}
          onClick={handleSelect}
        >
          {isCurrent ? "Plano atual" : "Assinar agora"}
        </Button>
      </div>
    </Card>
  );
}

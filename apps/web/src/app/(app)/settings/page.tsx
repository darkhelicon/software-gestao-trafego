"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { OrgForm } from "@/components/settings/org-form";
import { UsageBar } from "@/components/settings/usage-bar";
import { useQuotaUsage } from "@/hooks/use-organization";
import { useAuthStore } from "@/store/auth";

export default function SettingsPage() {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const { data: usage, isLoading: usageLoading } = useQuotaUsage();

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 mt-1">
          Gerencie os dados da sua organização e acompanhe o uso do plano.
        </p>
      </div>

      {/* Org info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da organização</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1">Slug</p>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
              {currentOrg?.slug}
            </code>
          </div>
          <OrgForm />
        </CardContent>
      </Card>

      {/* Plano atual */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Plano atual</CardTitle>
            {currentOrg?.subscription && (
              <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                {currentOrg.subscription.plan.name}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                ["TRIALING", "ACTIVE"].includes(
                  currentOrg?.subscription?.status ?? ""
                )
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {currentOrg?.subscription?.status ?? "Sem assinatura"}
            </span>
          </div>

          <a
            href="/billing"
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Gerenciar assinatura →
          </a>
        </CardContent>
      </Card>

      {/* Uso de quotas */}
      <Card>
        <CardHeader>
          <CardTitle>Uso do plano hoje</CardTitle>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <p className="text-sm text-gray-400">Carregando...</p>
          ) : usage && Array.isArray(usage) ? (
            <div className="flex flex-col gap-4">
              {usage.map((item) => (
                <UsageBar
                  key={item.resource}
                  label={item.resource}
                  used={item.used}
                  limit={item.limit}
                  unlimited={item.unlimited}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sem dados de uso.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

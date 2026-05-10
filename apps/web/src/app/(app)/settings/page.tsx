"use client";

import { OrgForm } from "@/components/settings/org-form";
import { UsageBar } from "@/components/settings/usage-bar";
import { useQuotaUsage } from "@/hooks/use-organization";
import { useAuthStore } from "@/store/auth";
import Link from "next/link";

export default function SettingsPage() {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const { data: usage, isLoading: usageLoading } = useQuotaUsage();

  const isActive = ["TRIALING", "ACTIVE"].includes(currentOrg?.subscription?.status ?? "");

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-500 mt-1">Gerencie os dados da sua organização e acompanhe o uso do plano.</p>
      </div>

      {/* Org info */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-base font-semibold text-white mb-4">Informações da organização</h2>
        <div className="mb-5">
          <p className="text-xs text-gray-600 mb-1">Slug</p>
          <code className="text-sm bg-white/5 text-gray-300 px-2 py-1 rounded border border-white/10">
            {currentOrg?.slug}
          </code>
        </div>
        <OrgForm />
      </div>

      {/* Current plan */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Plano atual</h2>
          {currentOrg?.subscription && (
            <span className="text-xs font-semibold bg-brand-400/10 text-brand-400 px-2.5 py-1 rounded-full border border-brand-400/20">
              {currentOrg.subscription.plan.name}
            </span>
          )}
        </div>
        <div className="mb-4">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
            isActive ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
          }`}>
            {currentOrg?.subscription?.status ?? "Sem assinatura"}
          </span>
        </div>
        <Link href="/billing" className="text-sm text-brand-400 hover:text-brand-500 transition-colors font-medium">
          Gerenciar assinatura →
        </Link>
      </div>

      {/* Quota usage */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-base font-semibold text-white mb-4">Uso do plano hoje</h2>
        {usageLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-white/5 rounded-lg" />
            ))}
          </div>
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
          <p className="text-sm text-gray-600">Sem dados de uso.</p>
        )}
      </div>
    </div>
  );
}

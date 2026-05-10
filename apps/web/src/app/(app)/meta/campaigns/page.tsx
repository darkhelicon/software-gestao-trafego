"use client";

import { useState } from "react";
import Link from "next/link";
import { MetaCampaignForm } from "@/components/meta/campaign-form";
import { useMetaCampaigns } from "@/hooks/use-meta";
import { JobStatus } from "@/components/tiktok/job-status";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  FAILED: "Falhou",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-brand-400/10 text-brand-400",
  PROCESSING: "bg-blue-400/10 text-blue-400",
  ACTIVE: "bg-green-400/10 text-green-400",
  PAUSED: "bg-white/5 text-gray-500",
  FAILED: "bg-red-400/10 text-red-400",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_LEADS: "Leads",
  OUTCOME_APP_PROMOTION: "App",
  OUTCOME_SALES: "Vendas",
};

export default function MetaCampaignsPage() {
  const [showForm, setShowForm] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const { data: campaigns, isLoading } = useMetaCampaigns();

  function handleJobCreated(jobId: string) {
    setActiveJobId(jobId);
    setShowForm(false);
  }

  function handleJobDone() {
    setActiveJobId(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/meta" className="hover:text-white transition-colors">Meta Ads</Link>
            <span>/</span>
            <span className="text-gray-400">Campanhas</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Campanhas</h1>
        </div>
        {!showForm && !activeJobId && (
          <div className="flex items-center gap-2">
            <Link href="/meta/bulk">
              <Button variant="secondary" size="sm">Criação em massa</Button>
            </Link>
            <Button onClick={() => setShowForm(true)} size="sm">+ Nova campanha</Button>
          </div>
        )}
      </div>

      {activeJobId && (
        <div className="rounded-xl border border-brand-400/20 bg-brand-400/5 p-6">
          <h2 className="text-sm font-semibold text-brand-400 mb-4">Criando campanha Meta...</h2>
          <JobStatus jobId={activeJobId} platform="meta" onDone={handleJobDone} />
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Nova campanha Meta</h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-600 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
          <MetaCampaignForm onJobCreated={handleJobCreated} />
        </div>
      )}

      <section>
        <h2 className="text-base font-semibold text-white mb-4">Todas as campanhas</h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-white/5 rounded-lg" />
            ))}
          </div>
        ) : !campaigns?.items?.length ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-sm text-gray-500">Nenhuma campanha criada ainda.</p>
            <p className="text-xs text-gray-600 mt-1">Clique em &ldquo;Nova campanha&rdquo; para começar.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Objetivo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Orçamento</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Conta</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Criada</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.items.map((c) => {
                  const config = c.config as { objective?: string; budgetType?: string } | null;
                  return (
                    <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {OBJECTIVE_LABELS[config?.objective ?? ""] ?? config?.objective ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {c.budget != null
                          ? `R$ ${Number(c.budget).toFixed(2)}${config?.budgetType === "daily" ? "/dia" : ""}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-white/5 text-gray-500"}`}>
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.advertiserAccount.name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

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
  PENDING: "bg-yellow-100 text-yellow-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-gray-100 text-gray-600",
  FAILED: "bg-red-100 text-red-700",
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/meta" className="hover:text-gray-800">
              Meta Ads
            </Link>
            <span>/</span>
            <span>Campanhas</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
        </div>
        {!showForm && !activeJobId && (
          <div className="flex items-center gap-2">
            <Link href="/meta/bulk">
              <Button variant="secondary" size="sm">
                Criação em massa
              </Button>
            </Link>
            <Button onClick={() => setShowForm(true)} size="sm">
              + Nova campanha
            </Button>
          </div>
        )}
      </div>

      {activeJobId && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-sm font-semibold text-blue-800 mb-4">
            Criando campanha Meta...
          </h2>
          <JobStatus jobId={activeJobId} platform="meta" onDone={handleJobDone} />
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">
              Nova campanha Meta
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-400 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
          <MetaCampaignForm onJobCreated={handleJobCreated} />
        </div>
      )}

      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Todas as campanhas
        </h2>

        {isLoading ? (
          <div className="text-sm text-gray-400">Carregando...</div>
        ) : !campaigns?.items?.length ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <p className="text-sm text-gray-500">
              Nenhuma campanha criada ainda.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Clique em &ldquo;Nova campanha&rdquo; para começar.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Nome
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Objetivo
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Orçamento
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Conta
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Criada
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.items.map((c) => {
                  const config = c.config as {
                    objective?: string;
                    budgetType?: string;
                  } | null;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {OBJECTIVE_LABELS[config?.objective ?? ""] ??
                          config?.objective ??
                          "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.budget != null
                          ? `R$ ${Number(c.budget).toFixed(2)}${config?.budgetType === "daily" ? "/dia" : ""}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[c.status] ??
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {c.advertiserAccount.name}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
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

"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTikTokAccounts, useBulkCreateTikTokCampaigns } from "@/hooks/use-tiktok";
import { useMetaAccounts, useBulkCreateMetaCampaigns } from "@/hooks/use-meta";
import { useTemplates, useApplyTemplate } from "@/hooks/use-templates";
import type { CampaignTemplate } from "@/hooks/use-templates";

const selectClass =
  "h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

const TIKTOK_OBJECTIVES = [
  { value: "REACH", label: "Alcance" },
  { value: "TRAFFIC", label: "Tráfego" },
  { value: "VIDEO_VIEWS", label: "Visualizações de vídeo" },
  { value: "LEAD_GENERATION", label: "Geração de leads" },
  { value: "CONVERSIONS", label: "Conversões" },
  { value: "APP_PROMOTION", label: "Promoção de app" },
];

const TIKTOK_BUDGET_MODES = [
  { value: "BUDGET_MODE_DAY", label: "Diário" },
  { value: "BUDGET_MODE_TOTAL", label: "Total" },
  { value: "BUDGET_MODE_INFINITE", label: "Sem limite" },
];

const META_OBJECTIVES = [
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_APP_PROMOTION", label: "App" },
  { value: "OUTCOME_SALES", label: "Vendas" },
];

interface BulkCreateFormProps {
  platform: "TIKTOK" | "META";
  onJobCreated: (jobId: string) => void;
}

export function BulkCreateForm({ platform, onJobCreated }: BulkCreateFormProps) {
  const { data: tiktokAccounts } = useTikTokAccounts();
  const { data: metaAccounts } = useMetaAccounts();
  const { data: templates } = useTemplates(platform);
  const bulkTikTok = useBulkCreateTikTokCampaigns();
  const bulkMeta = useBulkCreateMetaCampaigns();
  const applyTemplate = useApplyTemplate();

  const accounts = platform === "TIKTOK" ? tiktokAccounts : metaAccounts;
  const isPending = platform === "TIKTOK" ? bulkTikTok.isPending : bulkMeta.isPending || applyTemplate.isPending;

  // Shared state
  const [advertiserAccountId, setAdvertiserAccountId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [namesInput, setNamesInput] = useState("");

  // TikTok config
  const [tikObjective, setTikObjective] = useState("TRAFFIC");
  const [tikBudgetMode, setTikBudgetMode] = useState("BUDGET_MODE_DAY");
  const [tikBudget, setTikBudget] = useState("");

  // Meta config
  const [metaObjective, setMetaObjective] = useState("OUTCOME_TRAFFIC");
  const [metaBudgetType, setMetaBudgetType] = useState<"daily" | "lifetime">("daily");
  const [metaBudget, setMetaBudget] = useState("");
  const [metaStatus, setMetaStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");

  const [error, setError] = useState<string | null>(null);

  // Auto-fill config from selected template
  useEffect(() => {
    if (!selectedTemplateId || !templates) return;
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;

    if (platform === "TIKTOK") {
      setTikObjective((tpl.config["objectiveType"] as string) ?? "TRAFFIC");
      setTikBudgetMode((tpl.config["budgetMode"] as string) ?? "BUDGET_MODE_DAY");
      setTikBudget(tpl.config["budget"] != null ? String(tpl.config["budget"]) : "");
    } else {
      setMetaObjective((tpl.config["objective"] as string) ?? "OUTCOME_TRAFFIC");
      setMetaBudgetType((tpl.config["budgetType"] as "daily" | "lifetime") ?? "daily");
      setMetaBudget(tpl.config["budget"] != null ? String(tpl.config["budget"]) : "");
      setMetaStatus((tpl.config["status"] as "ACTIVE" | "PAUSED") ?? "ACTIVE");
    }
  }, [selectedTemplateId, templates, platform]);

  function parseNames(): string[] {
    return namesInput
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const names = parseNames();
    if (!names.length) {
      setError("Adicione pelo menos um nome de campanha.");
      return;
    }
    if (names.length > 50) {
      setError("Máximo de 50 campanhas por vez.");
      return;
    }
    if (!advertiserAccountId) {
      setError("Selecione uma conta.");
      return;
    }

    try {
      // If template selected, use apply endpoint (keeps config in sync with template)
      if (selectedTemplateId) {
        const result = await applyTemplate.mutateAsync({
          templateId: selectedTemplateId,
          advertiserAccountId,
          names,
        });
        onJobCreated(result.jobId);
        return;
      }

      // Otherwise, use platform-specific bulk endpoint
      if (platform === "TIKTOK") {
        const result = await bulkTikTok.mutateAsync({
          advertiserAccountId,
          campaigns: names.map((name) => ({
            name,
            objectiveType: tikObjective,
            budgetMode: tikBudgetMode,
            ...(tikBudget ? { budget: Number(tikBudget) } : {}),
          })),
        });
        onJobCreated(result.jobId);
      } else {
        const result = await bulkMeta.mutateAsync({
          advertiserAccountId,
          campaigns: names.map((name) => ({
            name,
            objective: metaObjective,
            budgetType: metaBudgetType,
            ...(metaBudget ? { budget: Number(metaBudget) } : {}),
            status: metaStatus,
          })),
        });
        onJobCreated(result.jobId);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao criar campanhas.";
      setError(msg);
    }
  }

  const names = parseNames();
  const nameCount = names.length;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Account selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">
          Conta {platform === "TIKTOK" ? "Advertiser" : "de Anúncios"}
        </label>
        <select
          value={advertiserAccountId}
          onChange={(e) => setAdvertiserAccountId(e.target.value)}
          className={selectClass}
          required
        >
          <option value="">Selecione uma conta...</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {!accounts?.length && (
          <p className="text-xs text-yellow-600">
            Nenhuma conta sincronizada. Sincronize na aba de conexões.
          </p>
        )}
      </div>

      {/* Template selector (optional) */}
      {templates && templates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Template{" "}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className={selectClass}
          >
            <option value="">Sem template (preencher manualmente)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selectedTemplateId && (
            <p className="text-xs text-blue-600">
              Config preenchida automaticamente pelo template.
            </p>
          )}
        </div>
      )}

      {/* Config fields (shown even when template selected, for review) */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Configuração das campanhas
        </p>

        {platform === "TIKTOK" ? (
          <>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Objetivo
                </label>
                <select
                  value={tikObjective}
                  onChange={(e) => setTikObjective(e.target.value)}
                  className={selectClass}
                >
                  {TIKTOK_OBJECTIVES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Orçamento
                </label>
                <select
                  value={tikBudgetMode}
                  onChange={(e) => setTikBudgetMode(e.target.value)}
                  className={selectClass}
                >
                  {TIKTOK_BUDGET_MODES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {tikBudgetMode !== "BUDGET_MODE_INFINITE" && (
              <Input
                id="bulk-tik-budget"
                type="number"
                label="Valor do orçamento (R$)"
                placeholder="Ex: 100"
                value={tikBudget}
                onChange={(e) => setTikBudget(e.target.value)}
                min="1"
                step="0.01"
              />
            )}
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Objetivo
                </label>
                <select
                  value={metaObjective}
                  onChange={(e) => setMetaObjective(e.target.value)}
                  className={selectClass}
                >
                  {META_OBJECTIVES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Tipo de orçamento
                </label>
                <select
                  value={metaBudgetType}
                  onChange={(e) =>
                    setMetaBudgetType(e.target.value as "daily" | "lifetime")
                  }
                  className={selectClass}
                >
                  <option value="daily">Diário</option>
                  <option value="lifetime">Vitalício</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  id="bulk-meta-budget"
                  type="number"
                  label="Valor do orçamento (R$)"
                  placeholder="Ex: 50"
                  value={metaBudget}
                  onChange={(e) => setMetaBudget(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Status inicial
                </label>
                <select
                  value={metaStatus}
                  onChange={(e) =>
                    setMetaStatus(e.target.value as "ACTIVE" | "PAUSED")
                  }
                  className={selectClass}
                >
                  <option value="ACTIVE">Ativa</option>
                  <option value="PAUSED">Pausada</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Campaign names textarea */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Nomes das campanhas
          </label>
          {nameCount > 0 && (
            <span className="text-xs text-blue-600 font-medium">
              {nameCount} campanha{nameCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <textarea
          value={namesInput}
          onChange={(e) => setNamesInput(e.target.value)}
          placeholder={"Campanha Verão - Produto A\nCampanha Verão - Produto B\nCampanha Inverno - Produto A"}
          rows={6}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none font-mono"
          required
        />
        <p className="text-xs text-gray-400">
          Um nome por linha · Máximo de 50 campanhas por envio
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Button
        type="submit"
        isLoading={isPending}
        className="w-full"
        size="lg"
        disabled={!nameCount || !advertiserAccountId}
      >
        {nameCount > 0
          ? `Criar ${nameCount} campanha${nameCount !== 1 ? "s" : ""}`
          : "Criar campanhas"}
      </Button>
    </form>
  );
}

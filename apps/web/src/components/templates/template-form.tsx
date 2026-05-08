"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  { value: "BUDGET_MODE_DAY", label: "Orçamento diário" },
  { value: "BUDGET_MODE_TOTAL", label: "Orçamento total" },
  { value: "BUDGET_MODE_INFINITE", label: "Sem limite" },
];

const META_OBJECTIVES = [
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento de marca" },
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_LEADS", label: "Geração de leads" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoção de app" },
  { value: "OUTCOME_SALES", label: "Vendas" },
];

interface TemplateFormProps {
  initial?: CampaignTemplate;
  onSubmit: (data: {
    name: string;
    platform: "TIKTOK" | "META";
    config: Record<string, unknown>;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TemplateForm({
  initial,
  onSubmit,
  onCancel,
  isLoading,
}: TemplateFormProps) {
  const isEditing = !!initial;

  const [name, setName] = useState(initial?.name ?? "");
  const [platform, setPlatform] = useState<"TIKTOK" | "META">(
    initial?.platform ?? "TIKTOK"
  );

  // TikTok config
  const [tikObjective, setTikObjective] = useState(
    (initial?.config?.["objectiveType"] as string) ?? "TRAFFIC"
  );
  const [tikBudgetMode, setTikBudgetMode] = useState(
    (initial?.config?.["budgetMode"] as string) ?? "BUDGET_MODE_DAY"
  );
  const [tikBudget, setTikBudget] = useState(
    String(initial?.config?.["budget"] ?? "")
  );

  // Meta config
  const [metaObjective, setMetaObjective] = useState(
    (initial?.config?.["objective"] as string) ?? "OUTCOME_TRAFFIC"
  );
  const [metaBudgetType, setMetaBudgetType] = useState(
    (initial?.config?.["budgetType"] as string) ?? "daily"
  );
  const [metaBudget, setMetaBudget] = useState(
    String(initial?.config?.["budget"] ?? "")
  );
  const [metaStatus, setMetaStatus] = useState(
    (initial?.config?.["status"] as string) ?? "ACTIVE"
  );

  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const config: Record<string, unknown> =
      platform === "TIKTOK"
        ? {
            objectiveType: tikObjective,
            budgetMode: tikBudgetMode,
            ...(tikBudgetMode !== "BUDGET_MODE_INFINITE" && tikBudget
              ? { budget: Number(tikBudget) }
              : {}),
          }
        : {
            objective: metaObjective,
            budgetType: metaBudgetType,
            ...(metaBudget ? { budget: Number(metaBudget) } : {}),
            status: metaStatus,
          };

    try {
      await onSubmit({ name, platform, config });
    } catch {
      setError("Erro ao salvar template. Tente novamente.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="tpl-name"
        label="Nome do template"
        placeholder="Ex: Campanha padrão de tráfego"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={255}
      />

      {!isEditing && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Plataforma
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as "TIKTOK" | "META")}
            className={selectClass}
          >
            <option value="TIKTOK">TikTok Ads</option>
            <option value="META">Meta Ads</option>
          </select>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Configuração da campanha
        </p>

        {platform === "TIKTOK" ? (
          <>
            <div className="flex flex-col gap-1.5 mb-3">
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

            <div className="flex flex-col gap-1.5 mb-3">
              <label className="text-sm font-medium text-gray-700">
                Modo de orçamento
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

            {tikBudgetMode !== "BUDGET_MODE_INFINITE" && (
              <Input
                id="tpl-tik-budget"
                type="number"
                label="Orçamento (R$)"
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
            <div className="flex flex-col gap-1.5 mb-3">
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

            <div className="flex gap-3 mb-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Tipo de orçamento
                </label>
                <select
                  value={metaBudgetType}
                  onChange={(e) => setMetaBudgetType(e.target.value)}
                  className={selectClass}
                >
                  <option value="daily">Diário</option>
                  <option value="lifetime">Vitalício</option>
                </select>
              </div>
              <div className="flex-1">
                <Input
                  id="tpl-meta-budget"
                  type="number"
                  label="Orçamento (R$)"
                  placeholder="Ex: 50"
                  value={metaBudget}
                  onChange={(e) => setMetaBudget(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Status inicial
              </label>
              <select
                value={metaStatus}
                onChange={(e) => setMetaStatus(e.target.value)}
                className={selectClass}
              >
                <option value="ACTIVE">Ativa</option>
                <option value="PAUSED">Pausada</option>
              </select>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          isLoading={isLoading ?? false}
          className="flex-1"
        >
          {isEditing ? "Salvar alterações" : "Criar template"}
        </Button>
      </div>
    </form>
  );
}

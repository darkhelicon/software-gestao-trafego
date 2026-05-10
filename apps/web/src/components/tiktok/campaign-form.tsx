"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTikTokAccounts, useCreateTikTokCampaign } from "@/hooks/use-tiktok";

interface CampaignFormProps {
  onJobCreated: (jobId: string) => void;
}

const OBJECTIVES = [
  { value: "REACH", label: "Alcance" },
  { value: "TRAFFIC", label: "Tráfego" },
  { value: "VIDEO_VIEWS", label: "Visualizações de vídeo" },
  { value: "LEAD_GENERATION", label: "Geração de leads" },
  { value: "CONVERSIONS", label: "Conversões" },
  { value: "APP_PROMOTION", label: "Promoção de app" },
];

const BUDGET_MODES = [
  { value: "BUDGET_MODE_DAY", label: "Orçamento diário" },
  { value: "BUDGET_MODE_TOTAL", label: "Orçamento total" },
  { value: "BUDGET_MODE_INFINITE", label: "Sem limite de orçamento" },
];

const selectClass = "h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-gray-300 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors";

export function CampaignForm({ onJobCreated }: CampaignFormProps) {
  const { data: accounts } = useTikTokAccounts();
  const create = useCreateTikTokCampaign();

  const [form, setForm] = useState({
    advertiserAccountId: "",
    name: "",
    objectiveType: "TRAFFIC",
    budgetMode: "BUDGET_MODE_DAY",
    budget: "",
  });
  const [error, setError] = useState<string | null>(null);

  function setField(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.advertiserAccountId) { setError("Selecione uma conta advertiser."); return; }

    try {
      const result = await create.mutateAsync({
        advertiserAccountId: form.advertiserAccountId,
        name: form.name,
        objectiveType: form.objectiveType,
        budgetMode: form.budgetMode,
        ...(form.budget ? { budget: Number(form.budget) } : {}),
      });
      onJobCreated(result.jobId);
    } catch {
      setError("Erro ao criar campanha. Verifique os dados e tente novamente.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Conta Advertiser</label>
        <select value={form.advertiserAccountId} onChange={setField("advertiserAccountId")} className={selectClass} required>
          <option value="">Selecione uma conta...</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.tiktokConnection?.businessCenterName ?? "BC"})
            </option>
          ))}
        </select>
        {!accounts?.length && (
          <p className="text-xs text-brand-400">Nenhuma conta sincronizada. Sincronize na aba de conexões primeiro.</p>
        )}
      </div>

      <Input id="campaign-name" label="Nome da campanha" placeholder="Ex: Campanha Verão 2026" value={form.name} onChange={setField("name")} required maxLength={255} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Objetivo</label>
        <select value={form.objectiveType} onChange={setField("objectiveType")} className={selectClass}>
          {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Modo de orçamento</label>
        <select value={form.budgetMode} onChange={setField("budgetMode")} className={selectClass}>
          {BUDGET_MODES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>

      {form.budgetMode !== "BUDGET_MODE_INFINITE" && (
        <Input id="budget" type="number" label="Orçamento (R$)" placeholder="Ex: 100" value={form.budget} onChange={setField("budget")} min="1" step="0.01" />
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 border border-red-400/20">{error}</p>
      )}

      <Button type="submit" isLoading={create.isPending} className="w-full" size="lg">
        Criar campanha
      </Button>
    </form>
  );
}

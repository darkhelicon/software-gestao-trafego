"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMetaAccounts, useCreateMetaCampaign } from "@/hooks/use-meta";

interface CampaignFormProps {
  onJobCreated: (jobId: string) => void;
}

const OBJECTIVES = [
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento de marca" },
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_LEADS", label: "Geração de leads" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoção de app" },
  { value: "OUTCOME_SALES", label: "Vendas" },
];

const BUDGET_TYPES = [
  { value: "daily", label: "Orçamento diário" },
  { value: "lifetime", label: "Orçamento vitalício" },
];

const selectClass = "h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-gray-300 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors";

export function MetaCampaignForm({ onJobCreated }: CampaignFormProps) {
  const { data: accounts } = useMetaAccounts();
  const create = useCreateMetaCampaign();

  const [form, setForm] = useState({
    advertiserAccountId: "",
    name: "",
    objective: "OUTCOME_TRAFFIC",
    budgetType: "daily" as "daily" | "lifetime",
    budget: "",
    status: "ACTIVE" as "ACTIVE" | "PAUSED",
  });
  const [error, setError] = useState<string | null>(null);

  function setField(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.advertiserAccountId) { setError("Selecione uma conta de anúncios."); return; }

    try {
      const result = await create.mutateAsync({
        advertiserAccountId: form.advertiserAccountId,
        name: form.name,
        objective: form.objective,
        budgetType: form.budgetType,
        ...(form.budget ? { budget: Number(form.budget) } : {}),
        status: form.status,
      });
      onJobCreated(result.jobId);
    } catch {
      setError("Erro ao criar campanha. Verifique os dados e tente novamente.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Conta de anúncios</label>
        <select value={form.advertiserAccountId} onChange={setField("advertiserAccountId")} className={selectClass} required>
          <option value="">Selecione uma conta...</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.metaConnection?.businessManagerName ?? "BM"})
            </option>
          ))}
        </select>
        {!accounts?.length && (
          <p className="text-xs text-brand-400">Nenhuma conta sincronizada. Sincronize na aba de conexões primeiro.</p>
        )}
      </div>

      <Input id="meta-campaign-name" label="Nome da campanha" placeholder="Ex: Campanha Verão 2026" value={form.name} onChange={setField("name")} required maxLength={255} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Objetivo</label>
        <select value={form.objective} onChange={setField("objective")} className={selectClass}>
          {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-sm font-medium text-gray-300">Tipo de orçamento</label>
          <select value={form.budgetType} onChange={setField("budgetType")} className={selectClass}>
            {BUDGET_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <Input id="meta-budget" type="number" label="Orçamento (R$)" placeholder="Ex: 50" value={form.budget} onChange={setField("budget")} min="1" step="0.01" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Status inicial</label>
        <select value={form.status} onChange={setField("status")} className={selectClass}>
          <option value="ACTIVE">Ativa (começa imediatamente)</option>
          <option value="PAUSED">Pausada</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 border border-red-400/20">{error}</p>
      )}

      <Button type="submit" isLoading={create.isPending} className="w-full" size="lg">
        Criar campanha
      </Button>
    </form>
  );
}

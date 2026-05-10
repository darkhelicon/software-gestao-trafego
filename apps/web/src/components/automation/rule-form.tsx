"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AutomationRule } from "@/hooks/use-automation";

const CONDITIONS = [
  { value: "CPA_ABOVE",  label: "CPA maior que", unit: "R$" },
  { value: "CPA_BELOW",  label: "CPA menor que", unit: "R$" },
  { value: "ROAS_ABOVE", label: "ROAS maior que", unit: "x" },
  { value: "ROAS_BELOW", label: "ROAS menor que", unit: "x" },
  { value: "CTR_BELOW",  label: "CTR menor que", unit: "%" },
  { value: "SPEND_ABOVE",label: "Gasto maior que", unit: "R$" },
];

const ACTIONS = [
  { value: "PAUSE_CAMPAIGN",    label: "Pausar campanha",       hasValue: false },
  { value: "RESUME_CAMPAIGN",   label: "Retomar campanha",      hasValue: false },
  { value: "SCALE_BUDGET",      label: "Aumentar orçamento em", hasValue: true, unit: "%" },
  { value: "REDUCE_BUDGET",     label: "Reduzir orçamento em",  hasValue: true, unit: "%" },
  { value: "SEND_ALERT",        label: "Enviar alerta",         hasValue: false },
];

const fieldClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400 transition-colors";

interface RuleFormProps {
  initial?: AutomationRule | undefined;
  onSubmit: (data: object) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function RuleForm({ initial, onSubmit, onCancel, loading }: RuleFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [platform, setPlatform] = useState<string>(initial?.platform ?? "");
  const [condition, setCondition] = useState(initial?.condition ?? "CPA_ABOVE");
  const [conditionValue, setConditionValue] = useState(initial?.conditionValue ?? "0");
  const [action, setAction] = useState(initial?.action ?? "PAUSE_CAMPAIGN");
  const [actionValue, setActionValue] = useState(initial?.actionValue ?? "");
  const [checkInterval, setCheckInterval] = useState(String(initial?.checkInterval ?? 60));

  const selectedCondition = CONDITIONS.find((c) => c.value === condition);
  const selectedAction = ACTIONS.find((a) => a.value === action);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      platform: platform || undefined,
      condition,
      conditionValue: parseFloat(conditionValue),
      action,
      actionValue: selectedAction?.hasValue ? parseFloat(actionValue) : undefined,
      checkInterval: parseInt(checkInterval, 10),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Nome da regra</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={fieldClass}
          placeholder="Ex: Pausar campanhas com CPA alto"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Plataforma (opcional)</label>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={fieldClass}>
          <option value="">Todas as plataformas</option>
          <option value="TIKTOK">TikTok Ads</option>
          <option value="META">Meta Ads</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Condição</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className={fieldClass}>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Valor ({selectedCondition?.unit ?? ""})
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={conditionValue}
            onChange={(e) => setConditionValue(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Ação</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={fieldClass}>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        {selectedAction?.hasValue && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Valor ({selectedAction.unit})
            </label>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              required
              className={fieldClass}
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Intervalo de verificação</label>
        <select value={checkInterval} onChange={(e) => setCheckInterval(e.target.value)} className={fieldClass}>
          <option value="15">A cada 15 minutos</option>
          <option value="30">A cada 30 minutos</option>
          <option value="60">A cada 1 hora</option>
          <option value="180">A cada 3 horas</option>
          <option value="360">A cada 6 horas</option>
          <option value="720">A cada 12 horas</option>
          <option value="1440">Uma vez por dia</option>
        </select>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="text-sm text-gray-600 hover:text-white transition-colors">
          Cancelar
        </button>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Salvando..." : initial ? "Salvar alterações" : "Criar regra"}
        </Button>
      </div>
    </form>
  );
}

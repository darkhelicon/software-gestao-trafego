"use client";

import { useState } from "react";
import type { AutomationRule } from "@/hooks/use-automation";

const CONDITION_LABELS: Record<string, string> = {
  CPA_ABOVE:  "CPA >",
  CPA_BELOW:  "CPA <",
  ROAS_ABOVE: "ROAS >",
  ROAS_BELOW: "ROAS <",
  CTR_BELOW:  "CTR <",
  SPEND_ABOVE:"Gasto >",
};

const CONDITION_UNITS: Record<string, string> = {
  CPA_ABOVE: "R$", CPA_BELOW: "R$",
  ROAS_ABOVE: "x", ROAS_BELOW: "x",
  CTR_BELOW: "%",
  SPEND_ABOVE: "R$",
};

const ACTION_LABELS: Record<string, string> = {
  PAUSE_CAMPAIGN:    "Pausar campanha",
  RESUME_CAMPAIGN:   "Retomar campanha",
  SCALE_BUDGET:      "Aumentar orçamento",
  REDUCE_BUDGET:     "Reduzir orçamento",
  SEND_ALERT:        "Enviar alerta",
  DUPLICATE_CAMPAIGN:"Duplicar campanha",
};

const PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: "TikTok",
  META: "Meta",
};

interface RuleCardProps {
  rule: AutomationRule;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (rule: AutomationRule) => void;
  loading?: boolean;
}

export function RuleCard({ rule, onToggle, onDelete, onEdit, loading }: RuleCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const conditionLabel = CONDITION_LABELS[rule.condition] ?? rule.condition;
  const conditionUnit = CONDITION_UNITS[rule.condition] ?? "";
  const conditionVal = Number(rule.conditionValue).toFixed(2);

  const actionLabel = ACTION_LABELS[rule.action] ?? rule.action;
  const actionSuffix =
    rule.actionValue && ["SCALE_BUDGET", "REDUCE_BUDGET"].includes(rule.action)
      ? ` ${Number(rule.actionValue).toFixed(0)}%`
      : "";

  const lastLog = rule.logs?.[0];

  return (
    <div className={`rounded-xl border bg-white p-5 transition-opacity ${!rule.isActive ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{rule.name}</p>
            {rule.platform && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {PLATFORM_LABELS[rule.platform] ?? rule.platform}
              </span>
            )}
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {rule.isActive ? "Ativa" : "Pausada"}
            </span>
          </div>

          <p className="text-sm text-gray-600">
            SE{" "}
            <span className="font-medium text-gray-900">
              {conditionLabel}{" "}
              {conditionUnit === "R$" ? "R$ " : ""}{conditionVal}{conditionUnit !== "R$" ? conditionUnit : ""}
            </span>{" "}
            → <span className="font-medium text-gray-900">{actionLabel}{actionSuffix}</span>
          </p>

          <p className="text-xs text-gray-400 mt-1">
            Verifica a cada{" "}
            {rule.checkInterval < 60
              ? `${rule.checkInterval}min`
              : `${rule.checkInterval / 60}h`}
            {rule.lastRunAt && (
              <> · Última execução: {new Date(rule.lastRunAt).toLocaleString("pt-BR")}</>
            )}
          </p>

          {lastLog && (
            <div className={`mt-2 text-xs px-2 py-1 rounded inline-block ${
              lastLog.triggered ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-500"
            }`}>
              {lastLog.triggered
                ? `Disparou às ${new Date(lastLog.createdAt).toLocaleString("pt-BR")}`
                : `Sem disparo — ${new Date(lastLog.createdAt).toLocaleString("pt-BR")}`}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onEdit(rule)}
            className="text-xs text-gray-500 hover:text-gray-800 transition-colors px-2 py-1 rounded hover:bg-gray-50"
          >
            Editar
          </button>

          <button
            onClick={() => onToggle(rule.id)}
            disabled={loading}
            className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
              rule.isActive
                ? "text-orange-600 hover:bg-orange-50"
                : "text-green-600 hover:bg-green-50"
            }`}
          >
            {rule.isActive ? "Pausar" : "Ativar"}
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(rule.id)}
                disabled={loading}
                className="text-xs text-red-600 font-medium hover:underline"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-400 hover:text-gray-700"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

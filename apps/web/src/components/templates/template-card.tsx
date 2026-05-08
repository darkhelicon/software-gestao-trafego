"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CampaignTemplate } from "@/hooks/use-templates";

interface TemplateCardProps {
  template: CampaignTemplate;
  onEdit: (template: CampaignTemplate) => void;
  onDelete: (id: string) => void;
  onApply: (template: CampaignTemplate) => void;
}

const PLATFORM_BADGE: Record<string, string> = {
  TIKTOK: "bg-black text-white",
  META: "bg-blue-600 text-white",
};

const PLATFORM_LABEL: Record<string, string> = {
  TIKTOK: "TikTok",
  META: "Meta",
};

function configSummary(
  platform: string,
  config: Record<string, unknown>
): string {
  if (platform === "TIKTOK") {
    const parts = [config["objectiveType"] as string];
    if (config["budgetMode"]) {
      parts.push(
        config["budgetMode"] === "BUDGET_MODE_DAY"
          ? "diário"
          : config["budgetMode"] === "BUDGET_MODE_TOTAL"
          ? "total"
          : "sem limite"
      );
    }
    if (config["budget"]) parts.push(`R$${config["budget"]}`);
    return parts.filter(Boolean).join(" · ");
  }

  const parts = [config["objective"] as string];
  if (config["budgetType"]) {
    parts.push(config["budgetType"] === "daily" ? "diário" : "vitalício");
  }
  if (config["budget"]) parts.push(`R$${config["budget"]}`);
  if (config["status"]) parts.push(config["status"] as string);
  return parts.filter(Boolean).join(" · ");
}

export function TemplateCard({
  template,
  onEdit,
  onDelete,
  onApply,
}: TemplateCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete(template.id);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                PLATFORM_BADGE[template.platform] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {PLATFORM_LABEL[template.platform] ?? template.platform}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm truncate">
            {template.name}
          </h3>
          <p className="text-xs text-gray-400 truncate">
            {configSummary(template.platform, template.config)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => onApply(template)}
        >
          Aplicar
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onEdit(template)}
        >
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className={
            confirmDelete
              ? "text-red-600 bg-red-50"
              : "text-gray-400 hover:text-red-500"
          }
        >
          {confirmDelete ? "Confirmar" : "Excluir"}
        </Button>
      </div>
    </div>
  );
}

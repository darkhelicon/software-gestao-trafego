"use client";

import { useEffect } from "react";
import { clsx } from "clsx";
import { useCampaignJob } from "@/hooks/use-tiktok";
import { useMetaCampaignJob } from "@/hooks/use-meta";

interface JobStatusProps {
  jobId: string;
  platform?: "tiktok" | "meta";
  onDone?: () => void;
}

const STATUS_COLORS = {
  PENDING: "bg-white/5 text-gray-500",
  PROCESSING: "bg-blue-400/10 text-blue-400",
  COMPLETED: "bg-green-400/10 text-green-400",
  FAILED: "bg-red-400/10 text-red-400",
  PARTIALLY_FAILED: "bg-brand-400/10 text-brand-400",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
  PARTIALLY_FAILED: "Parcialmente concluído",
};

export function JobStatus({ jobId, platform = "tiktok", onDone }: JobStatusProps) {
  const tiktokResult = useCampaignJob(platform === "tiktok" ? jobId : null);
  const metaResult = useMetaCampaignJob(platform === "meta" ? jobId : null);

  const job = platform === "meta" ? metaResult.data : tiktokResult.data;
  const isDone = !!job && ["COMPLETED", "PARTIALLY_FAILED"].includes(job.status);

  useEffect(() => {
    if (isDone) onDone?.();
  }, [isDone, onDone]);

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="animate-pulse">Aguardando processamento...</span>
      </div>
    );
  }

  const pct = job.totalItems > 0
    ? Math.round(((job.completedItems + job.failedItems) / job.totalItems) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">
          {isDone ? "Campanha processada" : "Processando campanha..."}
        </span>
        <span className={clsx(
          "text-xs font-semibold px-2.5 py-1 rounded-full",
          STATUS_COLORS[job.status as keyof typeof STATUS_COLORS] ?? "bg-white/5 text-gray-500"
        )}>
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
      </div>

      <div className="w-full bg-white/5 rounded-full h-2">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-500",
            job.status === "COMPLETED" ? "bg-green-400" :
            job.status === "PARTIALLY_FAILED" ? "bg-brand-400" : "bg-blue-400"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{job.completedItems} concluído(s) · {job.failedItems} falha(s) · {job.totalItems} total</span>
        <span>{pct}%</span>
      </div>

      {job.items.filter((i) => i.status === "FAILED").length > 0 && (
        <div className="mt-2 space-y-1">
          {job.items
            .filter((i) => i.status === "FAILED")
            .map((i) => (
              <p key={i.id} className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded border border-red-400/20">
                {i.error ?? "Erro desconhecido"}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

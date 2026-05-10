"use client";

import { useState } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SpendChart } from "@/components/dashboard/spend-chart";
import { PlatformBreakdown } from "@/components/dashboard/platform-breakdown";
import { TopCampaigns } from "@/components/dashboard/top-campaigns";
import {
  DateRangePicker,
  presetToRange,
  type Preset,
} from "@/components/dashboard/date-range-picker";
import {
  useReportSummary,
  useReportDaily,
  useReportByPlatform,
  useReportByCampaign,
  useSyncReports,
} from "@/hooks/use-reports";
import { Button } from "@/components/ui/button";

function formatCurrency(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(n: number) {
  return n.toLocaleString("pt-BR");
}

function formatPct(n: number) {
  return `${n.toFixed(2)}%`;
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [platform, setPlatform] = useState<"ALL" | "TIKTOK" | "META">("ALL");
  const [campaignPage, setCampaignPage] = useState(1);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const range = {
    ...presetToRange(preset),
    ...(platform !== "ALL" ? { platform: platform as "TIKTOK" | "META" } : {}),
  };

  const { data: summary, isLoading: summaryLoading } = useReportSummary(range);
  const { data: daily, isLoading: dailyLoading } = useReportDaily(range);
  const { data: byPlatform, isLoading: platformLoading } = useReportByPlatform(range);
  const { data: byCampaign, isLoading: campaignLoading } = useReportByCampaign(range, campaignPage);

  const sync = useSyncReports();

  function handleSync() {
    sync.mutate(undefined, {
      onSuccess: (res) => {
        setSyncMsg(`Sincronização iniciada para ${res.enqueued} conta(s).`);
        setTimeout(() => setSyncMsg(null), 4000);
      },
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Visão consolidada de todas as campanhas</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker
            preset={preset}
            onPresetChange={(p) => { setPreset(p); setCampaignPage(1); }}
            platform={platform}
            onPlatformChange={(p) => { setPlatform(p); setCampaignPage(1); }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSync}
            disabled={sync.isPending}
          >
            {sync.isPending ? "Sincronizando..." : "Sincronizar dados"}
          </Button>
        </div>
      </div>

      {syncMsg && (
        <div className="rounded-lg border border-brand-400/20 bg-brand-400/10 px-4 py-2.5 text-sm text-brand-400">
          {syncMsg}
        </div>
      )}

      {/* KPI Cards */}
      <section>
        {summaryLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
            <KpiCard label="Gasto total" value={formatCurrency(summary.spend)} />
            <KpiCard label="Impressões" value={formatNumber(summary.impressions)} />
            <KpiCard label="Cliques" value={formatNumber(summary.clicks)} />
            <KpiCard label="Conversões" value={formatNumber(summary.conversions)} />
            <KpiCard label="ROAS" value={`${summary.roas.toFixed(2)}x`} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
            <KpiCard label="Gasto total" value="R$ 0,00" />
            <KpiCard label="Impressões" value="0" />
            <KpiCard label="Cliques" value="0" />
            <KpiCard label="Conversões" value="0" />
            <KpiCard label="ROAS" value="0,00x" />
          </div>
        )}
      </section>

      {summary && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="CTR" value={formatPct(summary.ctr)} />
          <KpiCard label="CPC médio" value={formatCurrency(summary.cpc)} invertTrend />
          <KpiCard label="CPM" value={formatCurrency(summary.cpm)} invertTrend />
          <KpiCard label="CPA" value={summary.cpa > 0 ? formatCurrency(summary.cpa) : "—"} invertTrend />
        </section>
      )}

      {/* Spend chart + Platform breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-base font-semibold text-white mb-4">Gasto diário</h2>
          {dailyLoading ? (
            <div className="h-48 animate-pulse bg-white/5 rounded-lg" />
          ) : (
            <SpendChart rows={daily ?? []} />
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-base font-semibold text-white mb-4">Por plataforma</h2>
          {platformLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse bg-white/5 rounded-lg" />
              ))}
            </div>
          ) : (
            <PlatformBreakdown rows={byPlatform ?? []} />
          )}
        </div>
      </div>

      {/* Top campaigns table */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="text-base font-semibold text-white">Top campanhas por gasto</h2>
        </div>
        {campaignLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-white/5 rounded" />
            ))}
          </div>
        ) : (
          <TopCampaigns
            rows={byCampaign?.items ?? []}
            page={campaignPage}
            pageSize={byCampaign?.pageSize ?? 20}
            onPageChange={setCampaignPage}
          />
        )}
      </div>
    </div>
  );
}

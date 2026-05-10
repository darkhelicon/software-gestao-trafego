import type { PlatformRow } from "@/hooks/use-reports";

interface PlatformBreakdownProps {
  rows: PlatformRow[];
}

const PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: "TikTok Ads",
  META: "Meta Ads",
};

const PLATFORM_COLORS: Record<string, { bar: string; dot: string }> = {
  TIKTOK: { bar: "bg-brand-400", dot: "bg-brand-400" },
  META: { bar: "bg-blue-500", dot: "bg-blue-500" },
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function PlatformBreakdown({ rows }: PlatformBreakdownProps) {
  if (!rows.length) {
    return (
      <div className="text-sm text-gray-600 py-6 text-center">
        Sem dados de plataforma
      </div>
    );
  }

  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);

  return (
    <div className="divide-y divide-white/5">
      {rows.map((row) => {
        const pct = totalSpend > 0 ? (row.spend / totalSpend) * 100 : 0;
        const colors = PLATFORM_COLORS[row.platform] ?? { bar: "bg-gray-600", dot: "bg-gray-600" };
        return (
          <div key={row.platform} className="py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                <span className="text-sm font-medium text-white">
                  {PLATFORM_LABELS[row.platform] ?? row.platform}
                </span>
              </div>
              <span className="text-sm font-semibold text-white">
                R$ {fmt(row.spend)}
              </span>
            </div>

            <div className="w-full bg-white/5 rounded-full h-1.5 mb-3">
              <div
                className={`${colors.bar} h-1.5 rounded-full transition-all`}
                style={{ width: `${pct.toFixed(1)}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
              <div>
                <p className="font-medium text-gray-400">{row.impressions.toLocaleString("pt-BR")}</p>
                <p>Impressões</p>
              </div>
              <div>
                <p className="font-medium text-gray-400">{fmt(row.ctr, 2)}%</p>
                <p>CTR</p>
              </div>
              <div>
                <p className="font-medium text-gray-400">{row.conversions.toLocaleString("pt-BR")}</p>
                <p>Conversões</p>
              </div>
              <div>
                <p className="font-medium text-gray-400">{fmt(row.roas, 2)}x</p>
                <p>ROAS</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

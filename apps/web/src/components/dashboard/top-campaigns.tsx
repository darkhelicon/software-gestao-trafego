import type { CampaignRow } from "@/hooks/use-reports";

interface TopCampaignsProps {
  rows: CampaignRow[];
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: "TikTok",
  META: "Meta",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-gray-100 text-gray-600",
  FAILED: "bg-red-100 text-red-700",
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function TopCampaigns({ rows, page, pageSize, onPageChange }: TopCampaignsProps) {
  if (!rows.length) {
    return (
      <div className="text-sm text-gray-400 py-6 text-center">
        Sem dados de campanhas
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Campanha</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Plataforma</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Gasto</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Impressões</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">CTR</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Conversões</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">CPA</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.campaignId ?? r.campaignName}
                className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate max-w-[180px]">{r.campaignName}</p>
                    <span
                      className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {PLATFORM_LABELS[r.platform] ?? r.platform}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  R$ {fmt(r.spend)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {r.impressions.toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {fmt(r.ctr, 2)}%
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {r.conversions.toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {r.cpa > 0 ? `R$ ${fmt(r.cpa)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {r.roas > 0 ? `${fmt(r.roas, 2)}x` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">Página {page}</p>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 rounded border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Anterior
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={rows.length < pageSize}
            className="px-3 py-1 rounded border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

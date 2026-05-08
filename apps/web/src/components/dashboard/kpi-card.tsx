interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number; // % change — positive = good
  invertTrend?: boolean; // for metrics where lower is better (CPC, CPA)
}

export function KpiCard({ label, value, sub, trend, invertTrend }: KpiCardProps) {
  const isPositive = trend != null ? (invertTrend ? trend < 0 : trend > 0) : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      {trend != null && (
        <p
          className={`mt-2 text-xs font-medium ${
            isPositive ? "text-green-600" : "text-red-500"
          }`}
        >
          {isPositive ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% vs período anterior
        </p>
      )}
    </div>
  );
}

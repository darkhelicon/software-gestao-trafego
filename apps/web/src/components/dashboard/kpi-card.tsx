interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  invertTrend?: boolean;
}

export function KpiCard({ label, value, sub, trend, invertTrend }: KpiCardProps) {
  const isPositive = trend != null ? (invertTrend ? trend < 0 : trend > 0) : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20 transition-colors">
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-600">{sub}</p>}
      {trend != null && (
        <p className={`mt-2 text-xs font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}>
          {isPositive ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% vs período anterior
        </p>
      )}
    </div>
  );
}

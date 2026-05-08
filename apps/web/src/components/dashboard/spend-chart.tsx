import type { DailyRow } from "@/hooks/use-reports";

interface SpendChartProps {
  rows: DailyRow[];
}

const WIDTH = 800;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 32, left: 56 };

function formatCurrency(n: number) {
  if (n >= 1000) return `R$${(n / 1000).toFixed(1)}k`;
  return `R$${n.toFixed(0)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function SpendChart({ rows }: SpendChartProps) {
  if (!rows.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Sem dados para o período selecionado
      </div>
    );
  }

  const chartW = WIDTH - PADDING.left - PADDING.right;
  const chartH = HEIGHT - PADDING.top - PADDING.bottom;

  const maxSpend = Math.max(...rows.map((r) => r.spend), 1);
  const step = chartW / Math.max(rows.length - 1, 1);

  const points = rows.map((r, i) => ({
    x: PADDING.left + i * step,
    y: PADDING.top + chartH - (r.spend / maxSpend) * chartH,
    row: r,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = [
    `${points[0]!.x},${PADDING.top + chartH}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${points[points.length - 1]!.x},${PADDING.top + chartH}`,
  ].join(" ");

  // Y-axis tick labels (0 and max)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PADDING.top + chartH - f * chartH,
    label: formatCurrency(f * maxSpend),
  }));

  // X-axis: show at most 7 labels
  const xInterval = Math.ceil(rows.length / 7);
  const xLabels = points.filter((_, i) => i % xInterval === 0 || i === rows.length - 1);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      {yTicks.map((t) => (
        <line
          key={t.y}
          x1={PADDING.left}
          y1={t.y}
          x2={WIDTH - PADDING.right}
          y2={t.y}
          stroke="#f0f0f0"
          strokeWidth={1}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((t) => (
        <text
          key={t.y}
          x={PADDING.left - 6}
          y={t.y + 4}
          textAnchor="end"
          fontSize={10}
          fill="#9ca3af"
        >
          {t.label}
        </text>
      ))}

      {/* X-axis labels */}
      {xLabels.map((p) => (
        <text
          key={p.row.date}
          x={p.x}
          y={HEIGHT - 6}
          textAnchor="middle"
          fontSize={10}
          fill="#9ca3af"
        >
          {formatDate(p.row.date)}
        </text>
      ))}

      {/* Area fill */}
      <defs>
        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spendGrad)" />

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {points.map((p) => (
        <circle key={p.row.date} cx={p.x} cy={p.y} r={3} fill="#6366f1" />
      ))}
    </svg>
  );
}

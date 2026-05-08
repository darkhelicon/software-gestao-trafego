"use client";

export type Preset = "7d" | "14d" | "30d" | "90d";

interface DateRangePickerProps {
  preset: Preset;
  onPresetChange: (p: Preset) => void;
  platform?: "ALL" | "TIKTOK" | "META";
  onPlatformChange?: (p: "ALL" | "TIKTOK" | "META") => void;
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "14d", label: "14 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

export function DateRangePicker({
  preset,
  onPresetChange,
  platform = "ALL",
  onPlatformChange,
}: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => onPresetChange(p.value)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              preset === p.value
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {onPlatformChange && (
        <select
          value={platform}
          onChange={(e) => onPlatformChange(e.target.value as "ALL" | "TIKTOK" | "META")}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="ALL">Todas as plataformas</option>
          <option value="TIKTOK">TikTok Ads</option>
          <option value="META">Meta Ads</option>
        </select>
      )}
    </div>
  );
}

export function presetToRange(preset: Preset): { startDate: string; endDate: string } {
  const days = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 }[preset];
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split("T")[0]!,
    endDate: end.toISOString().split("T")[0]!,
  };
}

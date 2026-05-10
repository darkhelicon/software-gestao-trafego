"use client";

import { clsx } from "clsx";

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  unlimited: boolean;
}

const RESOURCE_LABELS: Record<string, string> = {
  campaigns_per_day: "Campanhas por dia",
  ads_per_day: "Anúncios por dia",
  business_centers: "Business Centers",
  advertiser_accounts: "Contas Advertiser",
};

export function UsageBar({ label, used, limit, unlimited }: UsageBarProps) {
  const pct = unlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 100;
  const isWarning = pct >= 75;
  const isCritical = pct >= 90;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400 font-medium">{RESOURCE_LABELS[label] ?? label}</span>
        <span>
          {unlimited ? (
            <span className="text-green-400 font-medium">Ilimitado</span>
          ) : (
            <>
              <span className={clsx("font-semibold", isCritical ? "text-red-400" : isWarning ? "text-brand-400" : "text-white")}>
                {used}
              </span>
              <span className="text-gray-600"> / {limit}</span>
            </>
          )}
        </span>
      </div>

      {!unlimited && (
        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-300",
              isCritical ? "bg-red-400" : isWarning ? "bg-brand-400" : "bg-blue-400"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

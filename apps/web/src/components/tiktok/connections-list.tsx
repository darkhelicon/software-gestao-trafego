"use client";

import { Button } from "@/components/ui/button";
import { useTikTokConnections, useDisconnectTikTok, useSyncTikTokAccounts } from "@/hooks/use-tiktok";

export function TikTokConnectionsList() {
  const { data: connections, isLoading } = useTikTokConnections();
  const disconnect = useDisconnectTikTok();
  const sync = useSyncTikTokAccounts();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse bg-white/5 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!connections?.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
        <p className="text-sm text-gray-500">Nenhum Business Center conectado ainda.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {connections.map((conn) => {
        const expiresAt = new Date(conn.tokenExpiresAt);
        const isExpiringSoon = expiresAt.getTime() - Date.now() < 24 * 3600 * 1000;

        return (
          <div key={conn.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.42a8.16 8.16 0 004.77 1.52V7.5a4.85 4.85 0 01-1-.81z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-white text-sm">
                  {conn.businessCenterName ?? conn.businessCenterId}
                </p>
                <p className="text-xs text-gray-600">BC ID: {conn.businessCenterId}</p>
                {isExpiringSoon && (
                  <p className="text-xs text-brand-400 font-medium mt-0.5">
                    Token expira em breve — reconecte para renovar
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="secondary"
                isLoading={sync.isPending}
                onClick={() => sync.mutate(conn.id)}
              >
                Sincronizar contas
              </Button>
              <Button
                size="sm"
                variant="destructive"
                isLoading={disconnect.isPending}
                onClick={() => {
                  if (confirm("Desconectar este Business Center?")) {
                    disconnect.mutate(conn.id);
                  }
                }}
              >
                Desconectar
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

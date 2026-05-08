"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSyncMetaAccounts, useDisconnectMeta } from "@/hooks/use-meta";

interface MetaConnection {
  id: string;
  businessManagerId: string;
  businessManagerName: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  createdAt: string;
}

interface ConnectionsListProps {
  connections: MetaConnection[];
}

export function MetaConnectionsList({ connections }: ConnectionsListProps) {
  const sync = useSyncMetaAccounts();
  const disconnect = useDisconnectMeta();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function handleSync(connectionId: string) {
    setSyncingId(connectionId);
    try {
      await sync.mutateAsync(connectionId);
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(connectionId: string) {
    if (!confirm("Desconectar este Business Manager?")) return;
    await disconnect.mutateAsync(connectionId);
  }

  function daysUntilExpiry(expiresAt: string | null): string {
    if (!expiresAt) return "—";
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 0) return "Expirado";
    if (days <= 7) return `${days}d (renovar logo)`;
    return `${days}d`;
  }

  return (
    <div className="flex flex-col gap-3">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-gray-900 text-sm">
              {conn.businessManagerName ?? conn.businessManagerId}
            </span>
            <span className="text-xs text-gray-400">
              ID: {conn.businessManagerId} · Token expira em:{" "}
              {daysUntilExpiry(conn.tokenExpiresAt)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              isLoading={syncingId === conn.id}
              onClick={() => handleSync(conn.id)}
            >
              Sincronizar contas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDisconnect(conn.id)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              Desconectar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

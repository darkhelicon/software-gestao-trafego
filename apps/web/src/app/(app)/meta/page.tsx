"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MetaConnectButton } from "@/components/meta/connect-button";
import { MetaConnectionsList } from "@/components/meta/connections-list";
import { useMetaConnections } from "@/hooks/use-meta";
import { Button } from "@/components/ui/button";

export default function MetaPage() {
  const { data: connections, isLoading, refetch } = useMetaConnections();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      void refetch();
    }
  }, [searchParams, refetch]);

  const oauthError = searchParams.get("error");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Meta Ads</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie suas conexões e campanhas do Meta Business Manager.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/meta/campaigns">
            <Button variant="secondary" size="sm">Ver campanhas</Button>
          </Link>
          <MetaConnectButton />
        </div>
      </div>

      {oauthError && (
        <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-4 py-3 text-sm text-red-400">
          {oauthError === "oauth_denied" && "Autorização negada pelo Meta."}
          {oauthError === "invalid_state" && "Sessão expirada. Tente conectar novamente."}
          {oauthError === "token_exchange" && "Falha ao obter token. Tente novamente."}
          {oauthError === "no_business_manager" && "Nenhum Business Manager encontrado na sua conta Meta."}
        </div>
      )}

      {searchParams.get("connected") === "true" && (
        <div className="rounded-lg bg-green-400/10 border border-green-400/20 px-4 py-3 text-sm text-green-400">
          Business Manager(s) conectado(s) com sucesso! Clique em &ldquo;Sincronizar contas&rdquo; para importar suas contas de anúncios.
        </div>
      )}

      <section>
        <h2 className="text-base font-semibold text-white mb-4">Business Managers conectados</h2>
        {isLoading ? (
          <div className="text-sm text-gray-600">Carregando...</div>
        ) : !connections?.length ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-sm text-gray-500">Nenhum Business Manager conectado ainda.</p>
            <p className="text-xs text-gray-600 mt-1">Clique em &ldquo;Conectar Meta&rdquo; para começar.</p>
          </div>
        ) : (
          <MetaConnectionsList connections={connections} />
        )}
      </section>
    </div>
  );
}

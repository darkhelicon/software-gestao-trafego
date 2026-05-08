"use client";

import { TikTokConnectButton as ConnectButton } from "@/components/tiktok/connect-button";
import { TikTokConnectionsList as ConnectionsList } from "@/components/tiktok/connections-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TikTokPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TikTok Ads</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie suas conexões e campanhas do TikTok Business Center.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/tiktok/campaigns">
            <Button variant="secondary" size="sm">
              Ver campanhas
            </Button>
          </Link>
          <ConnectButton />
        </div>
      </div>

      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Conexões ativas
        </h2>
        <ConnectionsList />
      </section>
    </div>
  );
}

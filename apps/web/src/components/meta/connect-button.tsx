"use client";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

export function MetaConnectButton() {
  const org = useAuthStore((s) => s.currentOrg);

  function handleConnect() {
    if (!org?.id) return;
    // Redirect to our API which generates state and redirects to Meta
    const apiBase =
      process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    window.location.href = `${apiBase}/api/v1/oauth/meta/authorize`;
  }

  return (
    <Button onClick={handleConnect} variant="primary" size="sm">
      Conectar Meta
    </Button>
  );
}

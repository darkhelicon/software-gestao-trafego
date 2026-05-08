"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

export function TikTokConnectButton() {
  const org = useAuthStore((s) => s.currentOrg);
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    if (!org) return;
    setLoading(true);

    // The authorize endpoint sets state in Redis and redirects to TikTok
    // We need to call it with auth headers, so we use a form POST redirect trick
    const token = await getIdToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Build URL with auth via query param (short-lived token for redirect flows)
    const url = `${process.env["NEXT_PUBLIC_API_URL"]}/api/v1/oauth/tiktok/authorize`;

    // Use fetch to get the redirect URL, then navigate
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Organization-Id": org.id,
      },
      redirect: "manual",
    });

    if (res.type === "opaqueredirect" || res.status === 302) {
      const location = res.headers.get("location");
      if (location) {
        window.location.href = location;
        return;
      }
    }

    // Fallback: direct link (server will handle redirect)
    window.location.href = url;
    setLoading(false);
  }

  return (
    <Button onClick={handleConnect} isLoading={loading} variant="primary">
      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.42a8.16 8.16 0 004.77 1.52V7.5a4.85 4.85 0 01-1-.81z" />
      </svg>
      Conectar TikTok Business Center
    </Button>
  );
}

async function getIdToken(): Promise<string | null> {
  try {
    const { auth } = await import("@/lib/firebase");
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

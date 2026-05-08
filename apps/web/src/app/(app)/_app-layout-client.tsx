"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/store/auth";
import { auth, firebaseSignOut } from "@/lib/firebase";
import { NotificationBell } from "@/components/notifications/notification-bell";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tiktok", label: "TikTok Ads" },
  { href: "/meta", label: "Meta Ads" },
  { href: "/templates", label: "Templates" },
  { href: "/automation", label: "Automações" },
  { href: "/settings", label: "Configurações" },
  { href: "/settings/members", label: "Membros" },
  { href: "/billing", label: "Billing" },
];

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasSubscription, isInitialized } = useAuth();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!hasSubscription) {
      router.replace("/billing");
    }
  }, [isAuthenticated, hasSubscription, isInitialized, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated || !hasSubscription) return null;

  async function handleSignOut() {
    await firebaseSignOut(auth);
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-0 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="font-bold text-gray-900 text-lg">AdFlow</span>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === link.href || pathname.startsWith(link.href + "/")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentOrg && (
            <span className="hidden sm:block text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {currentOrg.name}
            </span>
          )}
          <NotificationBell />
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sair
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}

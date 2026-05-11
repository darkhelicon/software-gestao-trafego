"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/store/auth";
import { auth, firebaseSignOut } from "@/lib/firebase";
import { NotificationBell } from "@/components/notifications/notification-bell";

const NAV_LINKS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM14 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
      </svg>
    ),
  },
  {
    href: "/tiktok",
    label: "TikTok Ads",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 10l4.553-2.069A1 1 0 0121 8.869v6.262a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/meta",
    label: "Meta Ads",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    href: "/templates",
    label: "Templates",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/automation",
    label: "Automações",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

const BOTTOM_LINKS = [
  {
    href: "/notifications",
    label: "Notificações",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Configurações",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/billing",
    label: "Billing",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
];

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasSubscription, isInitialized } = useAuth();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !hasSubscription) return null;

  async function handleSignOut() {
    await firebaseSignOut(auth);
    document.cookie = "firebase-session=; path=/; max-age=0; SameSite=Lax";
    router.replace("/login");
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-white/5 bg-[#0d0d0d] fixed h-full z-20">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-white/5">
          <Link href="/dashboard">
            <img src="/helzo-scale-logo.png" alt="Helzo Scale" className="h-10 w-auto" />
          </Link>
        </div>

        {/* Org badge */}
        {currentOrg && (
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand-400/20 flex items-center justify-center shrink-0">
                <span className="text-brand-400 text-xs font-bold">
                  {currentOrg.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{currentOrg.name}</p>
                <p className="text-xs text-gray-600 capitalize">{currentOrg.role.toLowerCase()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          <p className="px-2 pt-2 pb-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Plataformas
          </p>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-brand-400/10 text-brand-400"
                  : "text-gray-500 hover:text-white hover:bg-white/5"
              )}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}

          <p className="px-2 pt-4 pb-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Conta
          </p>
          {BOTTOM_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-brand-400/10 text-brand-400"
                  : "text-gray-500 hover:text-white hover:bg-white/5"
              )}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-2 py-3 border-t border-white/5">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 hover:text-red-400 hover:bg-red-400/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-[#0d0d0d] border-b border-white/5 flex items-center px-4 justify-between">
        <Link href="/dashboard">
          <img src="/helzo-scale-logo.png" alt="Helzo Scale" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="w-56 h-full bg-[#0d0d0d] border-r border-white/5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 flex items-center px-4 border-b border-white/5">
              <span className="font-bold text-white">Menu</span>
            </div>
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {[...NAV_LINKS, ...BOTTOM_LINKS].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-brand-400/10 text-brand-400"
                      : "text-gray-500 hover:text-white hover:bg-white/5"
                  )}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="px-2 py-3 border-t border-white/5">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-600 hover:text-red-400 hover:bg-red-400/5 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-56">
        {/* Top header bar */}
        <header className="hidden md:flex h-14 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm items-center justify-end px-6 gap-3 sticky top-0 z-10">
          <NotificationBell />
          <Link
            href="/settings/members"
            className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
          >
            Membros
          </Link>
        </header>

        <main className="p-6 md:p-8 mt-14 md:mt-0">
          {children}
        </main>
      </div>
    </div>
  );
}

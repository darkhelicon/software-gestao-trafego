"use client";

import { useAuthStore, hasActiveSubscription } from "@/store/auth";

export function useAuth() {
  const store = useAuthStore();

  return {
    firebaseUser: store.firebaseUser,
    currentOrg: store.currentOrg,
    isLoading: store.isLoading,
    isInitialized: store.isInitialized,
    isAuthenticated: store.firebaseUser !== null,
    hasSubscription: hasActiveSubscription(store.currentOrg),
    planSlug: store.currentOrg?.subscription?.plan.slug ?? null,
    role: store.currentOrg?.role ?? null,
  };
}

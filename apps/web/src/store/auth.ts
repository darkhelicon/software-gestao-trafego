"use client";

import { create } from "zustand";
import type { User } from "firebase/auth";

export interface OrgContext {
  id: string;
  name: string;
  slug: string;
  role: "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";
  subscription: {
    status: string;
    plan: {
      slug: string;
      name: string;
    };
  } | null;
}

interface AuthState {
  firebaseUser: User | null;
  currentOrg: OrgContext | null;
  isLoading: boolean;
  isInitialized: boolean;

  setFirebaseUser: (user: User | null) => void;
  setCurrentOrg: (org: OrgContext | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  currentOrg: null,
  isLoading: true,
  isInitialized: false,

  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setCurrentOrg: (org) => set({ currentOrg: org }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  reset: () =>
    set({ firebaseUser: null, currentOrg: null, isLoading: false }),
}));

export function hasActiveSubscription(org: OrgContext | null): boolean {
  if (!org?.subscription) return false;
  return ["TRIALING", "ACTIVE"].includes(org.subscription.status);
}

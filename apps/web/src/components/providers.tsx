"use client";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { auth, onAuthStateChanged } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth";
import { api, ApiError } from "@/lib/api";
import { DEMO_MODE, DEMO_ORG } from "@/lib/demo-mode";
import type { OrgContext } from "@/store/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setFirebaseUser, setCurrentOrg, setLoading, setInitialized, reset } =
    useAuthStore();

  useEffect(() => {
    // Demo mode: inject fixed state, skip Firebase entirely
    if (DEMO_MODE) {
      setCurrentOrg(DEMO_ORG);
      setLoading(false);
      setInitialized(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Clear session cookie so middleware can redirect unauthenticated users
        document.cookie = "firebase-session=; path=/; max-age=0; SameSite=Lax";
        reset();
        setInitialized(true);
        return;
      }

      // Set a presence cookie so Next.js middleware can detect auth state.
      // The cookie has no sensitive data — the real auth token is validated by
      // the API on every request using Firebase Admin.
      document.cookie = "firebase-session=1; path=/; max-age=3600; SameSite=Lax";

      setFirebaseUser(firebaseUser);
      setLoading(true);

      type MeResponse = {
        organizationUsers: Array<{
          role: OrgContext["role"];
          organization: {
            id: string;
            name: string;
            slug: string;
            subscription: OrgContext["subscription"];
          };
        }>;
      };

      async function fetchAndSetOrg() {
        const me = await api.get<MeResponse>("/api/v1/auth/me");
        const firstMembership = me.organizationUsers[0];
        if (firstMembership) {
          setCurrentOrg({
            id: firstMembership.organization.id,
            name: firstMembership.organization.name,
            slug: firstMembership.organization.slug,
            role: firstMembership.role,
            subscription: firstMembership.organization.subscription,
          });
        } else {
          setCurrentOrg(null);
        }
      }

      type SyncData = {
        needsOnboarding: boolean;
        user: MeResponse;
      };

      try {
        await fetchAndSetOrg();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // /auth/me returned 401: either a race condition (registration in-flight)
          // or a ghost user (Firebase account exists but Postgres row doesn't).
          // Retry once, then fall back to /auth/sync which creates the DB record.
          await new Promise((resolve) => setTimeout(resolve, 1200));
          try {
            await fetchAndSetOrg();
          } catch {
            // Both /auth/me attempts failed — resolve ghost user via /auth/sync
            try {
              const sync = await api.post<SyncData>("/api/v1/auth/sync", {});
              const firstMembership = sync.user?.organizationUsers?.[0];
              if (firstMembership) {
                setCurrentOrg({
                  id: firstMembership.organization.id,
                  name: firstMembership.organization.name,
                  slug: firstMembership.organization.slug,
                  role: firstMembership.role,
                  subscription: firstMembership.organization.subscription,
                });
              } else {
                setCurrentOrg(null);
              }
            } catch {
              setCurrentOrg(null);
            }
          }
        } else {
          setCurrentOrg(null);
        }
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    });

    return () => unsubscribe();
  }, [setFirebaseUser, setCurrentOrg, setLoading, setInitialized, reset]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>{children}</AuthInitializer>
    </QueryClientProvider>
  );
}

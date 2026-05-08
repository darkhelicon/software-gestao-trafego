"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { isAuthenticated, hasSubscription, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;

    if (!isAuthenticated) {
      router.replace("/login");
    } else if (!hasSubscription) {
      router.replace("/billing");
    } else {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, hasSubscription, isInitialized, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500">Carregando...</div>
    </div>
  );
}

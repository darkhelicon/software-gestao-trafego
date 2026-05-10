"use client";

import { useState } from "react";
import Link from "next/link";
import {
  auth,
  signInWithEmailAndPassword,
  signInWithPopup,
  googleProvider,
} from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Email/password login ───────────────────────────────────────────────────
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      document.cookie = "firebase-session=1; path=/; max-age=3600; SameSite=Lax";
      // Full reload so onAuthStateChanged fires fresh and providers.tsx sets
      // currentOrg before the app-layout subscription gate runs.
      window.location.href = "/dashboard";
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/network-request-failed") {
        setError("Erro de conexão. Verifique sua internet e tente novamente.");
      } else if (code === "auth/too-many-requests") {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else {
        setError("Email ou senha inválidos.");
      }
      setIsLoading(false);
    }
  }

  // ── Google login ───────────────────────────────────────────────────────────
  async function handleGoogleLogin() {
    setIsLoading(true);
    setError(null);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      document.cookie = "firebase-session=1; path=/; max-age=3600; SameSite=Lax";

      // Check if this Google user already has an account in our DB.
      // We do this before navigating so new users go to /register instead
      // of /dashboard (which would redirect them to /billing with no org).
      const token = await credential.user.getIdToken();
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 404) {
        // New Google user — go to register to complete profile
        // window.location.href so the register page detects the Google session
        window.location.href = "/register";
      } else {
        // Existing user — full reload so onAuthStateChanged fires cleanly
        window.location.href = "/dashboard";
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-blocked") {
        setError("Popup bloqueado pelo navegador. Permita popups para este site e tente novamente.");
      } else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        setError("Login cancelado. Clique novamente para tentar.");
      } else if (code === "auth/network-request-failed") {
        setError("Erro de conexão. Verifique sua internet e tente novamente.");
      } else {
        setError("Falha ao entrar com Google. Tente novamente.");
      }
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
      <h2 className="text-xl font-bold text-white mb-6">Entrar na sua conta</h2>

      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
        <Input
          id="email"
          type="email"
          label="Email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          id="password"
          type="password"
          label="Senha"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 border border-red-400/20">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={isLoading} size="lg" className="w-full mt-1">
          Entrar
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs text-gray-600">
          <span className="bg-[#0a0a0a] px-2">ou continue com</span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={handleGoogleLogin}
        disabled={isLoading}
      >
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Google
      </Button>

      <p className="mt-6 text-center text-sm text-gray-500">
        Não tem conta?{" "}
        <Link href="/register" className="text-brand-400 hover:text-brand-500 font-medium transition-colors">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

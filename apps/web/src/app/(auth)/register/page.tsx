"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithPopup,
  googleProvider,
} from "@/lib/firebase";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    organizationName: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function registerInBackend(idToken: string) {
    await api.post("/api/v1/auth/register", {
      idToken,
      name: form.name || "Usuário",
      organizationName: form.organizationName || "Minha Empresa",
    });
  }

  async function handleEmailRegister(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      // Set presence cookie immediately so middleware allows /billing navigation
      document.cookie = "firebase-session=1; path=/; max-age=3600; SameSite=Lax";
      const idToken = await credential.user.getIdToken();
      await registerInBackend(idToken);
      router.push("/billing");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/email-already-in-use") {
        setError("Este email já está em uso. Tente fazer login.");
      } else if (code === "auth/weak-password") {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else if (code === "auth/invalid-email") {
        setError("Email inválido.");
      } else if (code === "auth/network-request-failed") {
        setError("Erro de conexão. Verifique sua internet e tente novamente.");
      } else if (code === "auth/too-many-requests") {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
      } else if (err instanceof Error && err.message) {
        setError("Erro ao criar conta. Tente novamente.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleRegister() {
    setIsLoading(true);
    setError(null);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      document.cookie = "firebase-session=1; path=/; max-age=3600; SameSite=Lax";
      const idToken = await credential.user.getIdToken();
      await registerInBackend(idToken);
      router.push("/billing");
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
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
      <h2 className="text-xl font-bold text-white mb-6">Criar sua conta</h2>

      <form onSubmit={handleEmailRegister} className="flex flex-col gap-4">
        <Input
          id="name"
          label="Seu nome"
          placeholder="João Silva"
          value={form.name}
          onChange={setField("name")}
          required
          autoComplete="name"
        />

        <Input
          id="organizationName"
          label="Nome da empresa"
          placeholder="Minha Agência"
          value={form.organizationName}
          onChange={setField("organizationName")}
          required
        />

        <Input
          id="email"
          type="email"
          label="Email"
          placeholder="voce@empresa.com"
          value={form.email}
          onChange={setField("email")}
          required
          autoComplete="email"
        />

        <Input
          id="password"
          type="password"
          label="Senha"
          placeholder="Mínimo 6 caracteres"
          value={form.password}
          onChange={setField("password")}
          required
          autoComplete="new-password"
          minLength={6}
        />

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 border border-red-400/20">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={isLoading} size="lg" className="w-full mt-1">
          Criar conta
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
        onClick={handleGoogleRegister}
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
        Já tem conta?{" "}
        <Link href="/login" className="text-brand-400 hover:text-brand-500 font-medium transition-colors">
          Entrar
        </Link>
      </p>
    </div>
  );
}

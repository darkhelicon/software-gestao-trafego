"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useInviteMember } from "@/hooks/use-organization";

type Role = "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  OPERATOR: "Operator",
  VIEWER: "Viewer",
};

interface InviteModalProps {
  onClose: () => void;
}

export function InviteModal({ onClose }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("OPERATOR");
  const [error, setError] = useState<string | null>(null);
  const invite = useInviteMember();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await invite.mutateAsync({ email: email.trim(), role });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao convidar";
      setError(
        msg.includes("not found")
          ? "Usuário não encontrado. Peça para ele criar uma conta primeiro."
          : msg.includes("already a member")
          ? "Este usuário já é membro da organização."
          : "Erro ao adicionar membro. Tente novamente."
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[#0d0d0d] border border-white/10 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Adicionar membro</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="invite-email"
            type="email"
            label="Email do usuário"
            placeholder="usuario@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Perfil</label>
            <select
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-gray-300 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 border border-red-400/20">
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" isLoading={invite.isPending}>Adicionar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

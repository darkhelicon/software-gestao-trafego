"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MembersTable } from "@/components/settings/members-table";
import { InviteModal } from "@/components/settings/invite-modal";
import { useMembers } from "@/hooks/use-organization";
import { useAuthStore } from "@/store/auth";

export default function MembersPage() {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const { data: members, isLoading } = useMembers();
  const [showInvite, setShowInvite] = useState(false);

  const canInvite = currentOrg?.role === "ADMIN" || currentOrg?.role === "MANAGER";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Membros</h1>
          <p className="text-gray-500 mt-1">Gerencie os membros e permissões da sua organização.</p>
        </div>
        {canInvite && (
          <Button onClick={() => setShowInvite(true)}>+ Adicionar membro</Button>
        )}
      </div>

      {/* Team list */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Equipe</h2>
          <span className="text-sm text-gray-600">
            {isLoading ? "..." : `${members?.length ?? 0} membro(s)`}
          </span>
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-600 text-sm">Carregando membros...</div>
        ) : !members?.length ? (
          <div className="px-4 py-8 text-center text-gray-600 text-sm">Nenhum membro encontrado.</div>
        ) : (
          <MembersTable members={members} />
        )}
      </div>

      {/* Role reference */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-base font-semibold text-white mb-4">Perfis de acesso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            {
              role: "Admin",
              color: "bg-purple-400/10 text-purple-400",
              desc: "Acesso total: membros, billing, configurações e todas as funcionalidades.",
            },
            {
              role: "Manager",
              color: "bg-blue-400/10 text-blue-400",
              desc: "Cria e gerencia campanhas, contas e automações. Sem acesso a billing.",
            },
            {
              role: "Operator",
              color: "bg-green-400/10 text-green-400",
              desc: "Cria e edita campanhas. Sem acesso a membros ou configurações.",
            },
            {
              role: "Viewer",
              color: "bg-white/5 text-gray-500",
              desc: "Somente leitura: campanhas, contas e relatórios.",
            },
          ].map((item) => (
            <div key={item.role} className="flex gap-3 items-start">
              <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${item.color}`}>
                {item.role}
              </span>
              <p className="text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MembersTable } from "@/components/settings/members-table";
import { InviteModal } from "@/components/settings/invite-modal";
import { useMembers } from "@/hooks/use-organization";
import { useAuthStore } from "@/store/auth";

export default function MembersPage() {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const { data: members, isLoading } = useMembers();
  const [showInvite, setShowInvite] = useState(false);

  const canInvite =
    currentOrg?.role === "ADMIN" || currentOrg?.role === "MANAGER";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membros</h1>
          <p className="text-gray-500 mt-1">
            Gerencie os membros e permissões da sua organização.
          </p>
        </div>
        {canInvite && (
          <Button onClick={() => setShowInvite(true)}>
            + Adicionar membro
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Equipe</CardTitle>
            <span className="text-sm text-gray-500">
              {isLoading ? "..." : `${members?.length ?? 0} membro(s)`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              Carregando membros...
            </div>
          ) : !members?.length ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              Nenhum membro encontrado.
            </div>
          ) : (
            <MembersTable members={members} />
          )}
        </CardContent>
      </Card>

      {/* Role reference */}
      <Card>
        <CardHeader>
          <CardTitle>Perfis de acesso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              {
                role: "Admin",
                color: "bg-purple-100 text-purple-700",
                desc: "Acesso total: membros, billing, configurações e todas as funcionalidades.",
              },
              {
                role: "Manager",
                color: "bg-blue-100 text-blue-700",
                desc: "Cria e gerencia campanhas, contas e automações. Sem acesso a billing.",
              },
              {
                role: "Operator",
                color: "bg-green-100 text-green-700",
                desc: "Cria e edita campanhas. Sem acesso a membros ou configurações.",
              },
              {
                role: "Viewer",
                color: "bg-gray-100 text-gray-600",
                desc: "Somente leitura: campanhas, contas e relatórios.",
              },
            ].map((item) => (
              <div key={item.role} className="flex gap-3 items-start">
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${item.color}`}
                >
                  {item.role}
                </span>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

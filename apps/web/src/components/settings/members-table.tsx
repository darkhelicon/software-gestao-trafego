"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { useUpdateMemberRole, useRemoveMember } from "@/hooks/use-organization";
import { useAuthStore } from "@/store/auth";

type Role = "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

interface Member {
  id: string;
  role: Role;
  joinedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface MembersTableProps {
  members: Member[];
}

const ROLE_COLORS: Record<Role, string> = {
  ADMIN: "bg-purple-400/10 text-purple-400",
  MANAGER: "bg-blue-400/10 text-blue-400",
  OPERATOR: "bg-green-400/10 text-green-400",
  VIEWER: "bg-white/5 text-gray-500",
};

export function MembersTable({ members }: MembersTableProps) {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const updateRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canManage = currentOrg?.role === "ADMIN" || currentOrg?.role === "MANAGER";

  async function handleRoleChange(userId: string, role: Role) {
    setUpdatingId(userId);
    try {
      await updateRole.mutateAsync({ userId, role });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm("Remover este membro da organização?")) return;
    setRemovingId(userId);
    try {
      await remove.mutateAsync(userId);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.02] border-b border-white/5">
            <th className="text-left px-4 py-3 font-medium text-gray-600">Membro</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Perfil</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Entrou em</th>
            {canManage && (
              <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {members.map((m) => {
            const isSelf = m.user.id === currentOrg?.id;
            const isUpdating = updatingId === m.user.id;
            const isRemoving = removingId === m.user.id;

            return (
              <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-400/20 flex items-center justify-center text-brand-400 font-semibold text-xs uppercase shrink-0">
                      {m.user.name?.charAt(0) ?? m.user.email.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{m.user.name ?? "—"}</p>
                      <p className="text-gray-600 text-xs">{m.user.email}</p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  {canManage && !isSelf ? (
                    <select
                      value={m.role}
                      disabled={isUpdating}
                      onChange={(e) => handleRoleChange(m.user.id, e.target.value as Role)}
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-xs font-medium border-0 outline-none cursor-pointer bg-transparent",
                        ROLE_COLORS[m.role]
                      )}
                    >
                      {(["ADMIN", "MANAGER", "OPERATOR", "VIEWER"] as Role[]).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", ROLE_COLORS[m.role])}>
                      {m.role}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-gray-500">
                  {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("pt-BR") : "Pendente"}
                </td>

                {canManage && (
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={isRemoving}
                        onClick={() => handleRemove(m.user.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      >
                        Remover
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUpdateOrganization } from "@/hooks/use-organization";
import { useAuthStore } from "@/store/auth";

export function OrgForm() {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const [name, setName] = useState(currentOrg?.name ?? "");
  const [saved, setSaved] = useState(false);
  const update = useUpdateOrganization();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    await update.mutateAsync({ name: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <Input
        id="org-name"
        label="Nome da organização"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
        maxLength={100}
      />

      {update.error && (
        <p className="text-sm text-red-400">Erro ao salvar. Tente novamente.</p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          isLoading={update.isPending}
          disabled={name.trim() === currentOrg?.name}
        >
          Salvar alterações
        </Button>
        {saved && (
          <span className="text-sm text-green-400 font-medium">Salvo!</span>
        )}
      </div>
    </form>
  );
}

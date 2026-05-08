"use client";

import { useState } from "react";
import { useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, useApplyTemplate } from "@/hooks/use-templates";
import type { CampaignTemplate } from "@/hooks/use-templates";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplateForm } from "@/components/templates/template-form";
import { Button } from "@/components/ui/button";
import { JobStatus } from "@/components/tiktok/job-status";
import { useTikTokAccounts } from "@/hooks/use-tiktok";
import { useMetaAccounts } from "@/hooks/use-meta";

const selectClass =
  "h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export default function TemplatesPage() {
  const [platformFilter, setPlatformFilter] = useState<"" | "TIKTOK" | "META">("");
  const { data: templates, isLoading } = useTemplates(platformFilter || undefined);
  const { data: tiktokAccounts } = useTikTokAccounts();
  const { data: metaAccounts } = useMetaAccounts();

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const applyTemplate = useApplyTemplate();

  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | null>(null);

  // Apply modal state
  const [applyingTemplate, setApplyingTemplate] = useState<CampaignTemplate | null>(null);
  const [applyAccountId, setApplyAccountId] = useState("");
  const [applyNamesInput, setApplyNamesInput] = useState("");
  const [applyJobId, setApplyJobId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function handleCreate(data: {
    name: string;
    platform: "TIKTOK" | "META";
    config: Record<string, unknown>;
  }) {
    await createTemplate.mutateAsync(data);
    setShowForm(false);
  }

  async function handleUpdate(data: {
    name: string;
    platform: "TIKTOK" | "META";
    config: Record<string, unknown>;
  }) {
    if (!editingTemplate) return;
    await updateTemplate.mutateAsync({ id: editingTemplate.id, ...data });
    setEditingTemplate(null);
  }

  async function handleDelete(id: string) {
    await deleteTemplate.mutateAsync(id);
  }

  function openApply(template: CampaignTemplate) {
    setApplyingTemplate(template);
    setApplyAccountId("");
    setApplyNamesInput("");
    setApplyJobId(null);
    setApplyError(null);
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!applyingTemplate) return;
    setApplyError(null);

    const names = applyNamesInput
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean);

    if (!names.length) {
      setApplyError("Adicione pelo menos um nome.");
      return;
    }

    try {
      const result = await applyTemplate.mutateAsync({
        templateId: applyingTemplate.id,
        advertiserAccountId: applyAccountId,
        names,
      });
      setApplyJobId(result.jobId);
    } catch (err: unknown) {
      setApplyError(err instanceof Error ? err.message : "Erro ao aplicar template.");
    }
  }

  const applyAccounts =
    applyingTemplate?.platform === "TIKTOK" ? tiktokAccounts : metaAccounts;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurações reutilizáveis para criar campanhas em massa rapidamente.
          </p>
        </div>
        {!showForm && !editingTemplate && (
          <Button onClick={() => setShowForm(true)} size="sm">
            + Novo template
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-5">
            Novo template
          </h2>
          <TemplateForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isLoading={createTemplate.isPending}
          />
        </div>
      )}

      {/* Edit form */}
      {editingTemplate && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-5">
            Editar template
          </h2>
          <TemplateForm
            initial={editingTemplate}
            onSubmit={handleUpdate}
            onCancel={() => setEditingTemplate(null)}
            isLoading={updateTemplate.isPending}
          />
        </div>
      )}

      {/* Apply modal */}
      {applyingTemplate && !applyJobId && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">
              Aplicar template:{" "}
              <span className="text-blue-600">{applyingTemplate.name}</span>
            </h2>
            <button
              onClick={() => setApplyingTemplate(null)}
              className="text-sm text-gray-400 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={handleApply} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Conta{" "}
                {applyingTemplate.platform === "TIKTOK"
                  ? "Advertiser"
                  : "de Anúncios"}
              </label>
              <select
                value={applyAccountId}
                onChange={(e) => setApplyAccountId(e.target.value)}
                className={selectClass + " w-full"}
                required
              >
                <option value="">Selecione uma conta...</option>
                {applyAccounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Nomes das campanhas
                </label>
                <span className="text-xs text-gray-400">
                  {
                    applyNamesInput
                      .split("\n")
                      .map((n) => n.trim())
                      .filter(Boolean).length
                  }{" "}
                  nome(s)
                </span>
              </div>
              <textarea
                value={applyNamesInput}
                onChange={(e) => setApplyNamesInput(e.target.value)}
                placeholder={"Campanha 01\nCampanha 02\nCampanha 03"}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none font-mono"
                required
              />
              <p className="text-xs text-gray-400">Um nome por linha · máx. 50</p>
            </div>

            {applyError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {applyError}
              </p>
            )}

            <Button
              type="submit"
              isLoading={applyTemplate.isPending}
              className="w-full"
            >
              Criar campanhas com este template
            </Button>
          </form>
        </div>
      )}

      {/* Job status after apply */}
      {applyJobId && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-sm font-semibold text-blue-800 mb-4">
            Criando campanhas...
          </h2>
          <JobStatus
            jobId={applyJobId}
            platform={
              applyingTemplate?.platform === "META" ? "meta" : "tiktok"
            }
            onDone={() => {
              setApplyJobId(null);
              setApplyingTemplate(null);
            }}
          />
        </div>
      )}

      {/* Filter + list */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-800 flex-1">
            Meus templates
          </h2>
          <select
            value={platformFilter}
            onChange={(e) =>
              setPlatformFilter(e.target.value as "" | "TIKTOK" | "META")
            }
            className={selectClass}
          >
            <option value="">Todas as plataformas</option>
            <option value="TIKTOK">TikTok</option>
            <option value="META">Meta</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-400">Carregando...</div>
        ) : !templates?.length ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <p className="text-sm text-gray-500">
              Nenhum template criado ainda.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Crie um template para reutilizar configurações rapidamente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onEdit={setEditingTemplate}
                onDelete={handleDelete}
                onApply={openApply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

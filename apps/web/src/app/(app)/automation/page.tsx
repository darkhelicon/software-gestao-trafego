"use client";

import { useState } from "react";
import { RuleForm } from "@/components/automation/rule-form";
import { RuleCard } from "@/components/automation/rule-card";
import { ChannelConfigForm } from "@/components/automation/channel-config-form";
import {
  useAutomationRules,
  useCreateRule,
  useUpdateRule,
  useToggleRule,
  useDeleteRule,
  useNotificationConfig,
  useSaveNotificationConfig,
  type AutomationRule,
} from "@/hooks/use-automation";
import { Button } from "@/components/ui/button";

type Tab = "rules" | "channels";

export default function AutomationPage() {
  const [tab, setTab] = useState<Tab>("rules");
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const { data: rules, isLoading: rulesLoading } = useAutomationRules();
  const { data: config, isLoading: configLoading } = useNotificationConfig();

  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const toggleRule = useToggleRule();
  const deleteRule = useDeleteRule();
  const saveConfig = useSaveNotificationConfig();

  function handleRuleSubmit(data: object) {
    if (editingRule) {
      updateRule.mutate(
        { id: editingRule.id, ...data },
        { onSuccess: () => { setEditingRule(null); setShowForm(false); } }
      );
    } else {
      createRule.mutate(data, { onSuccess: () => setShowForm(false) });
    }
  }

  function handleEdit(rule: AutomationRule) {
    setEditingRule(rule);
    setShowForm(true);
  }

  function handleCancelForm() {
    setEditingRule(null);
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Automações</h1>
          <p className="text-sm text-gray-500 mt-1">Regras automáticas baseadas em métricas de campanha</p>
        </div>
        {tab === "rules" && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>+ Nova regra</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {(["rules", "channels"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-brand-400 text-brand-400"
                : "border-transparent text-gray-600 hover:text-white"
            }`}
          >
            {t === "rules" ? "Regras de automação" : "Canais de alerta"}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <div className="flex flex-col gap-4">
          {showForm && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-base font-semibold text-white mb-5">
                {editingRule ? "Editar regra" : "Nova regra de automação"}
              </h2>
              <RuleForm
                initial={editingRule ?? undefined}
                onSubmit={handleRuleSubmit}
                onCancel={handleCancelForm}
                loading={createRule.isPending || updateRule.isPending}
              />
            </div>
          )}

          {rulesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse bg-white/5 rounded-xl" />
              ))}
            </div>
          ) : !rules?.length ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
              <p className="text-sm text-gray-500 font-medium">Nenhuma regra criada</p>
              <p className="text-xs text-gray-600 mt-1">
                Crie regras para pausar, escalar ou alertar automaticamente com base em métricas.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={(id) => toggleRule.mutate(id)}
                  onDelete={(id) => deleteRule.mutate(id)}
                  onEdit={handleEdit}
                  loading={toggleRule.isPending || deleteRule.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "channels" && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Configuração de canais</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure onde os alertas das regras serão enviados. Os alertas in-app são sempre ativos.
            </p>
          </div>

          {configLoading ? (
            <div className="text-sm text-gray-600">Carregando...</div>
          ) : (
            <ChannelConfigForm
              initial={config ?? null}
              onSubmit={(data) => saveConfig.mutate(data)}
              loading={saveConfig.isPending}
            />
          )}

          {saveConfig.isSuccess && (
            <p className="mt-3 text-sm text-green-400">Configuração salva com sucesso.</p>
          )}
        </div>
      )}
    </div>
  );
}

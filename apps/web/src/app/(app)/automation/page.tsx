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
        {
          onSuccess: () => {
            setEditingRule(null);
            setShowForm(false);
          },
        }
      );
    } else {
      createRule.mutate(data, {
        onSuccess: () => setShowForm(false),
      });
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automações</h1>
          <p className="text-sm text-gray-500 mt-1">
            Regras automáticas baseadas em métricas de campanha
          </p>
        </div>
        {tab === "rules" && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            + Nova regra
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["rules", "channels"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "rules" ? "Regras de automação" : "Canais de alerta"}
          </button>
        ))}
      </div>

      {/* Rules tab */}
      {tab === "rules" && (
        <div className="flex flex-col gap-4">
          {showForm && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-5">
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
            <div className="text-sm text-gray-400">Carregando regras...</div>
          ) : !rules?.length ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <p className="text-sm text-gray-500 font-medium">Nenhuma regra criada</p>
              <p className="text-xs text-gray-400 mt-1">
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

      {/* Channels tab */}
      {tab === "channels" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900">Configuração de canais</h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure onde os alertas das regras serão enviados. Os alertas in-app são sempre ativos.
            </p>
          </div>

          {configLoading ? (
            <div className="text-sm text-gray-400">Carregando...</div>
          ) : (
            <ChannelConfigForm
              initial={config ?? null}
              onSubmit={(data) => saveConfig.mutate(data)}
              loading={saveConfig.isPending}
            />
          )}

          {saveConfig.isSuccess && (
            <p className="mt-3 text-sm text-green-600">Configuração salva com sucesso.</p>
          )}
        </div>
      )}
    </div>
  );
}

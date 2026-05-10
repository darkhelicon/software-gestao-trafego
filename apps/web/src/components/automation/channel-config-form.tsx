"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { NotificationConfig } from "@/hooks/use-automation";

interface ChannelConfigFormProps {
  initial: NotificationConfig | null;
  onSubmit: (data: object) => void;
  loading?: boolean;
}

const fieldClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400 transition-colors";

export function ChannelConfigForm({ initial, onSubmit, loading }: ChannelConfigFormProps) {
  const [discordWebhook, setDiscordWebhook] = useState(initial?.discordWebhook ?? "");
  const [telegramBotToken, setTelegramBotToken] = useState(initial?.telegramBotToken ?? "");
  const [telegramChatId, setTelegramChatId] = useState(initial?.telegramChatId ?? "");
  const [webhookUrl, setWebhookUrl] = useState(initial?.webhookUrl ?? "");
  const [webhookSecret, setWebhookSecret] = useState(initial?.webhookSecret ?? "");

  useEffect(() => {
    if (!initial) return;
    setDiscordWebhook(initial.discordWebhook ?? "");
    setTelegramBotToken(initial.telegramBotToken ?? "");
    setTelegramChatId(initial.telegramChatId ?? "");
    setWebhookUrl(initial.webhookUrl ?? "");
    setWebhookSecret(initial.webhookSecret ?? "");
  }, [initial]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      discordWebhook: discordWebhook || null,
      telegramBotToken: telegramBotToken || null,
      telegramChatId: telegramChatId || null,
      webhookUrl: webhookUrl || null,
      webhookSecret: webhookSecret || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-white">Discord</span>
          <span className="text-xs text-gray-600">via Incoming Webhook</span>
        </div>
        <input
          type="url"
          value={discordWebhook}
          onChange={(e) => setDiscordWebhook(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className={fieldClass}
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-white">Telegram</span>
          <span className="text-xs text-gray-600">via Bot API</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={telegramBotToken}
            onChange={(e) => setTelegramBotToken(e.target.value)}
            placeholder="Token do bot (1234:AABBcc...)"
            className={fieldClass}
          />
          <input
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="Chat ID (ex: -100123456)"
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-white">Webhook personalizado</span>
          <span className="text-xs text-gray-600">POST com assinatura HMAC-SHA256</span>
        </div>
        <div className="space-y-2">
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://seu-servidor.com/webhook"
            className={fieldClass}
          />
          <input
            type="text"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Segredo para assinatura (opcional)"
            className={fieldClass}
          />
        </div>
        {webhookUrl && (
          <p className="text-xs text-gray-600 mt-1">
            Payload: <code className="bg-white/5 text-gray-400 px-1 rounded">{"{ title, body, timestamp, ruleId, campaignId }"}</code>
          </p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Salvando..." : "Salvar configuração"}
        </Button>
      </div>
    </form>
  );
}

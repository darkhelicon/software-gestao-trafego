import type { Job } from "bullmq";
import { prisma } from "@helzo-scale/database";
import { createHmac } from "crypto";
import { isIP } from "net";

// Inline SSRF guard — worker has no access to API's lib directory
const BLOCKED: RegExp[] = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^::1$/, /^fc[0-9a-f]{2}:/i, /^fd[0-9a-f]{2}:/i, /^fe80:/i,
];

function isSafeUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const h = url.hostname;
    if (isIP(h)) return !BLOCKED.some((p) => p.test(h));
    return true; // hostname will be resolved at fetch time; API already validated on save
  } catch {
    return false;
  }
}

interface NotificationPayload {
  organizationId: string;
  title: string;
  body: string;
  ruleId?: string;
  campaignId?: string;
}

export async function processNotificationSend(job: Job<NotificationPayload>) {
  const { organizationId, title, body, ruleId, campaignId } = job.data;

  const config = await prisma.notificationConfig.findUnique({
    where: { organizationId },
  });

  const dispatched: string[] = [];
  const errors: string[] = [];

  // Always create in-app notification record
  await prisma.notification.create({
    data: {
      organizationId,
      channel: "IN_APP",
      title,
      body,
      payload: { ruleId: ruleId ?? null, campaignId: campaignId ?? null },
      sentAt: new Date(),
    },
  });
  dispatched.push("IN_APP");

  if (!config) {
    console.log(`[notification-send] No config for org ${organizationId} — in-app only`);
    return;
  }

  // Discord webhook
  if (config.discordWebhook && !isSafeUrl(config.discordWebhook)) {
    errors.push("Discord: URL bloqueada por política de segurança");
  } else if (config.discordWebhook) {
    try {
      const res = await fetch(config.discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title,
              description: body,
              color: 0x6366f1,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dispatched.push("DISCORD");
    } catch (err) {
      errors.push(`Discord: ${(err as Error).message}`);
    }
  }

  // Telegram bot
  if (config.telegramBotToken && config.telegramChatId) {
    try {
      const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text: `*${escapeMarkdown(title)}*\n${escapeMarkdown(body)}`,
          parse_mode: "MarkdownV2",
        }),
      });
      const json = await res.json() as { ok: boolean; description?: string };
      if (!json.ok) throw new Error(json.description ?? "Telegram error");
      dispatched.push("TELEGRAM");
    } catch (err) {
      errors.push(`Telegram: ${(err as Error).message}`);
    }
  }

  // Custom webhook
  if (config.webhookUrl && !isSafeUrl(config.webhookUrl)) {
    errors.push("Webhook: URL bloqueada por política de segurança");
  } else if (config.webhookUrl) {
    try {
      const timestamp = Date.now().toString();
      const webhookBody = JSON.stringify({ title, body, timestamp, ruleId, campaignId });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-HelzoScale-Timestamp": timestamp,
      };

      if (config.webhookSecret) {
        const sig = createHmac("sha256", config.webhookSecret)
          .update(webhookBody)
          .digest("hex");
        headers["X-HelzoScale-Signature"] = `sha256=${sig}`;
      }

      const res = await fetch(config.webhookUrl, { method: "POST", headers, body: webhookBody });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dispatched.push("WEBHOOK");
    } catch (err) {
      errors.push(`Webhook: ${(err as Error).message}`);
    }
  }

  if (errors.length) {
    console.warn(`[notification-send] Partial failures for org ${organizationId}:`, errors.join(", "));
  }

  console.log(`[notification-send] Dispatched to: ${dispatched.join(", ")} for org ${organizationId}`);
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

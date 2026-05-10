"use client";

import { useState } from "react";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  type Notification,
} from "@/hooks/use-automation";
import { Button } from "@/components/ui/button";

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "In-app",
  DISCORD: "Discord",
  TELEGRAM: "Telegram",
  WEBHOOK: "Webhook",
  WHATSAPP: "WhatsApp",
};

function NotificationItem({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  const isUnread = !notification.readAt;

  return (
    <div
      className={`flex items-start gap-4 px-6 py-4 border-b border-white/5 last:border-0 transition-colors ${
        isUnread ? "bg-brand-400/5" : "hover:bg-white/[0.02]"
      }`}
    >
      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isUnread ? "bg-brand-400" : "bg-white/10"}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className={`text-sm font-medium ${isUnread ? "text-white" : "text-gray-400"}`}>
            {notification.title}
          </p>
          <span className="text-xs text-gray-600">
            {CHANNEL_LABELS[notification.channel] ?? notification.channel}
          </span>
        </div>
        <p className="text-sm text-gray-500">{notification.body}</p>
        <p className="text-xs text-gray-600 mt-1">
          {new Date(notification.createdAt).toLocaleString("pt-BR")}
        </p>
      </div>

      {isUnread && (
        <button
          onClick={() => onRead(notification.id)}
          className="text-xs text-brand-400 hover:text-brand-500 transition-colors shrink-0 mt-1"
        >
          Marcar lida
        </button>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useNotifications(page, unreadOnly);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Notificações</h1>
          <p className="text-sm text-gray-500 mt-1">Alertas e eventos das suas automações</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              unreadOnly
                ? "bg-brand-400 text-black border-brand-400"
                : "border-white/10 text-gray-500 hover:text-white hover:bg-white/5"
            }`}
          >
            {unreadOnly ? "Todas" : "Não lidas"}
          </button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            Marcar todas como lidas
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-600">Carregando...</div>
        ) : !items.length ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500 font-medium">Nenhuma notificação</p>
            <p className="text-xs text-gray-600 mt-1">
              {unreadOnly
                ? "Você não tem notificações não lidas."
                : "As notificações das suas automações aparecerão aqui."}
            </p>
          </div>
        ) : (
          items.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={(id) => markRead.mutate(id)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-white/10 rounded-lg text-gray-500 disabled:opacity-40 hover:bg-white/5 hover:text-white transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-white/10 rounded-lg text-gray-500 disabled:opacity-40 hover:bg-white/5 hover:text-white transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

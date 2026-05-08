"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export interface AutomationRule {
  id: string;
  name: string;
  platform: "TIKTOK" | "META" | null;
  condition: string;
  conditionValue: string;
  action: string;
  actionValue: string | null;
  isActive: boolean;
  checkInterval: number;
  lastRunAt: string | null;
  createdAt: string;
  logs: Array<{
    id: string;
    triggered: boolean;
    detail: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export interface NotificationConfig {
  id: string;
  discordWebhook: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
}

export interface Notification {
  id: string;
  channel: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
}

// ========================
// Automation Rules
// ========================

export function useAutomationRules() {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["automation-rules", org?.id],
    queryFn: () =>
      api.get<AutomationRule[]>("/api/v1/automation/rules", { organizationId: org?.id }),
    enabled: !!org?.id,
  });
}

export function useCreateRule() {
  const org = useAuthStore((s) => s.currentOrg);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) =>
      api.post<AutomationRule>("/api/v1/automation/rules", body, { organizationId: org?.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules", org?.id] }),
  });
}

export function useUpdateRule() {
  const org = useAuthStore((s) => s.currentOrg);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & object) =>
      api.put<AutomationRule>(`/api/v1/automation/rules/${id}`, body, { organizationId: org?.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules", org?.id] }),
  });
}

export function useToggleRule() {
  const org = useAuthStore((s) => s.currentOrg);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<AutomationRule>(`/api/v1/automation/rules/${id}/toggle`, {}, { organizationId: org?.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules", org?.id] }),
  });
}

export function useDeleteRule() {
  const org = useAuthStore((s) => s.currentOrg);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v1/automation/rules/${id}`, { organizationId: org?.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules", org?.id] }),
  });
}

// ========================
// Notification Config
// ========================

export function useNotificationConfig() {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["notification-config", org?.id],
    queryFn: () =>
      api.get<NotificationConfig | null>("/api/v1/automation/config", { organizationId: org?.id }),
    enabled: !!org?.id,
  });
}

export function useSaveNotificationConfig() {
  const org = useAuthStore((s) => s.currentOrg);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) =>
      api.put<NotificationConfig>("/api/v1/automation/config", body, { organizationId: org?.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-config", org?.id] }),
  });
}

// ========================
// Notifications
// ========================

export function useNotifications(page = 1, unreadOnly = false) {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["notifications", org?.id, page, unreadOnly],
    queryFn: () =>
      api.get<{
        items: Notification[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(
        `/api/v1/notifications?page=${page}${unreadOnly ? "&unreadOnly=true" : ""}`,
        { organizationId: org?.id }
      ),
    enabled: !!org?.id,
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["notifications-unread", org?.id],
    queryFn: () =>
      api.get<{ count: number }>("/api/v1/notifications/unread-count", { organizationId: org?.id }),
    enabled: !!org?.id,
    refetchInterval: 30_000,
  });
}

export function useMarkRead() {
  const org = useAuthStore((s) => s.currentOrg);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/v1/notifications/${id}/read`, {}, { organizationId: org?.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", org?.id] });
      qc.invalidateQueries({ queryKey: ["notifications-unread", org?.id] });
    },
  });
}

export function useMarkAllRead() {
  const org = useAuthStore((s) => s.currentOrg);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post("/api/v1/notifications/mark-all-read", {}, { organizationId: org?.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", org?.id] });
      qc.invalidateQueries({ queryKey: ["notifications-unread", org?.id] });
    },
  });
}

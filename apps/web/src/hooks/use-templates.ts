"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export interface CampaignTemplate {
  id: string;
  name: string;
  platform: "TIKTOK" | "META";
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useTemplates(platform?: "TIKTOK" | "META") {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["templates", org?.id, platform],
    queryFn: () => {
      const params = platform ? `?platform=${platform}` : "";
      return api.get<CampaignTemplate[]>(`/api/v1/templates${params}`, {
        organizationId: org?.id,
      });
    },
    enabled: !!org?.id,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (data: {
      name: string;
      platform: "TIKTOK" | "META";
      config: Record<string, unknown>;
    }) =>
      api.post<CampaignTemplate>("/api/v1/templates", data, {
        organizationId: org?.id,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["templates", org?.id] });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      config?: Record<string, unknown>;
    }) =>
      api.put<CampaignTemplate>(`/api/v1/templates/${id}`, data, {
        organizationId: org?.id,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["templates", org?.id] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v1/templates/${id}`, { organizationId: org?.id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["templates", org?.id] });
    },
  });
}

export function useApplyTemplate() {
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: ({
      templateId,
      advertiserAccountId,
      names,
    }: {
      templateId: string;
      advertiserAccountId: string;
      names: string[];
    }) =>
      api.post<{ jobId: string; totalItems: number; platform: string }>(
        `/api/v1/templates/${templateId}/apply`,
        { advertiserAccountId, names },
        { organizationId: org?.id }
      ),
  });
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface TikTokConnection {
  id: string;
  businessCenterId: string;
  businessCenterName: string | null;
  tokenExpiresAt: string;
  scopes: string[];
  createdAt: string;
}

interface TikTokAccount {
  id: string;
  externalId: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  tiktokConnection: {
    id: string;
    businessCenterName: string | null;
    businessCenterId: string;
  } | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: string | null;
  externalId: string | null;
  createdAt: string;
  advertiserAccount: { id: string; name: string; externalId: string };
  config: Record<string, unknown> | null;
}

interface CampaignJob {
  id: string;
  status: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  startedAt: string | null;
  completedAt: string | null;
  items: Array<{
    id: string;
    status: string;
    error: string | null;
    result: Record<string, unknown> | null;
  }>;
}

interface PaginatedCampaigns {
  items: Campaign[];
  total: number;
  page: number;
  totalPages: number;
}

export function useTikTokConnections() {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["tiktok-connections", org?.id],
    queryFn: () =>
      api.get<TikTokConnection[]>("/api/v1/tiktok/connections", {
        organizationId: org?.id,
      }),
    enabled: !!org?.id,
  });
}

export function useTikTokAccounts() {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["tiktok-accounts", org?.id],
    queryFn: () =>
      api.get<TikTokAccount[]>("/api/v1/tiktok/accounts", {
        organizationId: org?.id,
      }),
    enabled: !!org?.id,
  });
}

export function useTikTokCampaigns(advertiserAccountId?: string) {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["tiktok-campaigns", org?.id, advertiserAccountId],
    queryFn: () => {
      const params = advertiserAccountId
        ? `?advertiserAccountId=${advertiserAccountId}`
        : "";
      return api.get<PaginatedCampaigns>(
        `/api/v1/tiktok/campaigns${params}`,
        { organizationId: org?.id }
      );
    },
    enabled: !!org?.id,
  });
}

export function useCampaignJob(jobId: string | null, enabled = true) {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["campaign-job", jobId],
    queryFn: () =>
      api.get<CampaignJob>(`/api/v1/tiktok/campaigns/jobs/${jobId}`, {
        organizationId: org?.id,
      }),
    enabled: !!org?.id && !!jobId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return ["COMPLETED", "PARTIALLY_FAILED"].includes(data.status)
        ? false
        : 2000;
    },
  });
}

export function useSyncTikTokAccounts() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (connectionId: string) =>
      api.post(
        "/api/v1/tiktok/accounts/sync",
        { connectionId },
        { organizationId: org?.id }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tiktok-accounts", org?.id] });
    },
  });
}

export function useDisconnectTikTok() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (connectionId: string) =>
      api.delete(`/api/v1/tiktok/connections/${connectionId}`, {
        organizationId: org?.id,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tiktok-connections", org?.id] });
      void qc.invalidateQueries({ queryKey: ["tiktok-accounts", org?.id] });
    },
  });
}

export function useBulkCreateTikTokCampaigns() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (data: {
      advertiserAccountId: string;
      campaigns: Array<{
        name: string;
        objectiveType: string;
        budgetMode: string;
        budget?: number;
      }>;
    }) =>
      api.post<{ jobId: string; totalItems: number }>(
        "/api/v1/tiktok/campaigns/bulk",
        data,
        { organizationId: org?.id }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tiktok-campaigns", org?.id] });
    },
  });
}

export function useCreateTikTokCampaign() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (data: {
      advertiserAccountId: string;
      name: string;
      objectiveType: string;
      budgetMode: string;
      budget?: number;
    }) =>
      api.post<{ campaign: Campaign; jobId: string }>(
        "/api/v1/tiktok/campaigns",
        data,
        { organizationId: org?.id }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tiktok-campaigns", org?.id] });
    },
  });
}

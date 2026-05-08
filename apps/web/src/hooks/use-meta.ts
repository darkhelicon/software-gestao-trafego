"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface MetaConnection {
  id: string;
  businessManagerId: string;
  businessManagerName: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  createdAt: string;
}

interface MetaAccount {
  id: string;
  externalId: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  metaConnection: {
    id: string;
    businessManagerName: string | null;
    businessManagerId: string;
  } | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: string | null;
  externalId: string | null;
  createdAt: string;
  config: Record<string, unknown> | null;
  advertiserAccount: { id: string; name: string; externalId: string };
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

export function useMetaConnections() {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["meta-connections", org?.id],
    queryFn: () =>
      api.get<MetaConnection[]>("/api/v1/meta/connections", {
        organizationId: org?.id,
      }),
    enabled: !!org?.id,
  });
}

export function useMetaAccounts() {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["meta-accounts", org?.id],
    queryFn: () =>
      api.get<MetaAccount[]>("/api/v1/meta/accounts", {
        organizationId: org?.id,
      }),
    enabled: !!org?.id,
  });
}

export function useMetaCampaigns(advertiserAccountId?: string) {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["meta-campaigns", org?.id, advertiserAccountId],
    queryFn: () => {
      const params = advertiserAccountId
        ? `?advertiserAccountId=${advertiserAccountId}`
        : "";
      return api.get<PaginatedCampaigns>(
        `/api/v1/meta/campaigns${params}`,
        { organizationId: org?.id }
      );
    },
    enabled: !!org?.id,
  });
}

export function useMetaCampaignJob(jobId: string | null) {
  const org = useAuthStore((s) => s.currentOrg);
  return useQuery({
    queryKey: ["meta-campaign-job", jobId],
    queryFn: () =>
      api.get<CampaignJob>(`/api/v1/meta/campaigns/jobs/${jobId}`, {
        organizationId: org?.id,
      }),
    enabled: !!org?.id && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return ["COMPLETED", "PARTIALLY_FAILED"].includes(data.status)
        ? false
        : 2000;
    },
  });
}

export function useSyncMetaAccounts() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (connectionId: string) =>
      api.post(
        "/api/v1/meta/accounts/sync",
        { connectionId },
        { organizationId: org?.id }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta-accounts", org?.id] });
    },
  });
}

export function useDisconnectMeta() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (connectionId: string) =>
      api.delete(`/api/v1/meta/connections/${connectionId}`, {
        organizationId: org?.id,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta-connections", org?.id] });
      void qc.invalidateQueries({ queryKey: ["meta-accounts", org?.id] });
    },
  });
}

export function useBulkCreateMetaCampaigns() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (data: {
      advertiserAccountId: string;
      campaigns: Array<{
        name: string;
        objective: string;
        budgetType: "daily" | "lifetime";
        budget?: number;
        status: "ACTIVE" | "PAUSED";
      }>;
    }) =>
      api.post<{ jobId: string; totalItems: number }>(
        "/api/v1/meta/campaigns/bulk",
        data,
        { organizationId: org?.id }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta-campaigns", org?.id] });
    },
  });
}

export function useCreateMetaCampaign() {
  const qc = useQueryClient();
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: (data: {
      advertiserAccountId: string;
      name: string;
      objective: string;
      budgetType: "daily" | "lifetime";
      budget?: number;
      status: "ACTIVE" | "PAUSED";
    }) =>
      api.post<{ campaign: Campaign; jobId: string }>(
        "/api/v1/meta/campaigns",
        data,
        { organizationId: org?.id }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meta-campaigns", org?.id] });
    },
  });
}

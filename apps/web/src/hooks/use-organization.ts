"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface Member {
  id: string;
  role: "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";
  joinedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface QuotaItem {
  resource: string;
  used: number;
  limit: number;
  unlimited: boolean;
}

export function useOrganization() {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ["organization", orgId],
    queryFn: () =>
      api.get(`/api/v1/organizations/${orgId}`, { organizationId: orgId }),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useMembers() {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ["members", orgId],
    queryFn: () =>
      api.get<Member[]>(`/api/v1/organizations/${orgId}/members`, {
        organizationId: orgId,
      }),
    enabled: !!orgId,
  });
}

export function useQuotaUsage() {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const orgId = currentOrg?.id;

  return useQuery({
    queryKey: ["quota-usage", orgId],
    queryFn: () =>
      api.get<QuotaItem[]>(`/api/v1/organizations/${orgId}/usage`, {
        organizationId: orgId,
      }),
    enabled: !!orgId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const orgId = currentOrg?.id;

  return useMutation({
    mutationFn: (data: { email: string; role: Member["role"] }) =>
      api.post(`/api/v1/organizations/${orgId}/members`, data, {
        organizationId: orgId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members", orgId] });
    },
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const orgId = currentOrg?.id;

  return useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: Member["role"];
    }) =>
      api.patch(
        `/api/v1/organizations/${orgId}/members/${userId}`,
        { role },
        { organizationId: orgId }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members", orgId] });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const orgId = currentOrg?.id;

  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/api/v1/organizations/${orgId}/members/${userId}`, {
        organizationId: orgId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members", orgId] });
    },
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const orgId = currentOrg?.id;

  return useMutation({
    mutationFn: (data: { name?: string; logoUrl?: string | null }) =>
      api.patch(`/api/v1/organizations/${orgId}`, data, {
        organizationId: orgId,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["organization", orgId] });
    },
  });
}

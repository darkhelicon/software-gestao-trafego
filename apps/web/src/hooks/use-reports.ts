"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export interface SummaryMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
}

export interface DailyRow {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
}

export interface PlatformRow {
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpa: number;
  roas: number;
}

export interface AccountRow {
  accountId: string;
  accountName: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  roas: number;
}

export interface CampaignRow {
  campaignId: string | null;
  campaignName: string;
  platform: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
}

interface DateRange {
  startDate: string;
  endDate: string;
  platform?: "TIKTOK" | "META";
}

export function useReportSummary(range: DateRange) {
  const org = useAuthStore((s) => s.currentOrg);
  const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
  if (range.platform) params.set("platform", range.platform);

  return useQuery({
    queryKey: ["reports-summary", org?.id, range],
    queryFn: () =>
      api.get<SummaryMetrics>(`/api/v1/reports/summary?${params.toString()}`, {
        organizationId: org?.id,
      }),
    enabled: !!org?.id && !!range.startDate && !!range.endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export function useReportDaily(range: DateRange) {
  const org = useAuthStore((s) => s.currentOrg);
  const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
  if (range.platform) params.set("platform", range.platform);

  return useQuery({
    queryKey: ["reports-daily", org?.id, range],
    queryFn: () =>
      api.get<DailyRow[]>(`/api/v1/reports/daily?${params.toString()}`, {
        organizationId: org?.id,
      }),
    enabled: !!org?.id && !!range.startDate && !!range.endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export function useReportByPlatform(range: { startDate: string; endDate: string }) {
  const org = useAuthStore((s) => s.currentOrg);
  const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });

  return useQuery({
    queryKey: ["reports-by-platform", org?.id, range],
    queryFn: () =>
      api.get<PlatformRow[]>(`/api/v1/reports/by-platform?${params.toString()}`, {
        organizationId: org?.id,
      }),
    enabled: !!org?.id && !!range.startDate && !!range.endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export function useReportByAccount(range: DateRange) {
  const org = useAuthStore((s) => s.currentOrg);
  const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
  if (range.platform) params.set("platform", range.platform);

  return useQuery({
    queryKey: ["reports-by-account", org?.id, range],
    queryFn: () =>
      api.get<AccountRow[]>(`/api/v1/reports/by-account?${params.toString()}`, {
        organizationId: org?.id,
      }),
    enabled: !!org?.id && !!range.startDate && !!range.endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export function useReportByCampaign(range: DateRange, page = 1) {
  const org = useAuthStore((s) => s.currentOrg);
  const params = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
    page: String(page),
  });
  if (range.platform) params.set("platform", range.platform);

  return useQuery({
    queryKey: ["reports-by-campaign", org?.id, range, page],
    queryFn: () =>
      api.get<{ items: CampaignRow[]; page: number; pageSize: number }>(
        `/api/v1/reports/by-campaign?${params.toString()}`,
        { organizationId: org?.id }
      ),
    enabled: !!org?.id && !!range.startDate && !!range.endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSyncReports() {
  const org = useAuthStore((s) => s.currentOrg);

  return useMutation({
    mutationFn: () =>
      api.post<{ enqueued: number; startDate: string; endDate: string }>(
        "/api/v1/reports/sync",
        {},
        { organizationId: org?.id }
      ),
  });
}

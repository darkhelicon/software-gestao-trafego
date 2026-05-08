// ========================
// PLAN & BILLING
// ========================

export type PlanSlug = "START" | "GROWTH" | "SCALE" | "ENTERPRISE";

export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "PAUSED";

export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "TRIALING",
  "ACTIVE",
];

export type QuotaResource =
  | "campaigns_per_day"
  | "ads_per_day"
  | "business_centers"
  | "advertiser_accounts";

export const PLAN_QUOTAS: Record<PlanSlug, Record<QuotaResource, number>> = {
  START: {
    campaigns_per_day: 20,
    ads_per_day: 60,
    business_centers: 3,
    advertiser_accounts: -1,
  },
  GROWTH: {
    campaigns_per_day: 40,
    ads_per_day: 120,
    business_centers: 6,
    advertiser_accounts: -1,
  },
  SCALE: {
    campaigns_per_day: 80,
    ads_per_day: 240,
    business_centers: 12,
    advertiser_accounts: -1,
  },
  ENTERPRISE: {
    campaigns_per_day: -1,
    ads_per_day: -1,
    business_centers: -1,
    advertiser_accounts: -1,
  },
};

export const PLAN_FEATURES: Record<PlanSlug, string[]> = {
  START: ["dashboard_basic", "mass_appeal"],
  GROWTH: [
    "dashboard_basic",
    "mass_appeal",
    "campaign_templates",
    "mass_creation_queue",
    "reports_per_account",
  ],
  SCALE: [
    "dashboard_basic",
    "mass_appeal",
    "campaign_templates",
    "mass_creation_queue",
    "reports_per_account",
    "automation_rules",
    "performance_alerts",
    "advanced_metrics_sync",
  ],
  ENTERPRISE: [
    "dashboard_basic",
    "mass_appeal",
    "campaign_templates",
    "mass_creation_queue",
    "reports_per_account",
    "automation_rules",
    "performance_alerts",
    "advanced_metrics_sync",
    "priority_support",
    "custom_limits",
    "webhooks",
    "advanced_integrations",
  ],
};

// ========================
// RBAC
// ========================

export type OrgRole = "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

export type Permission =
  | "campaigns:read"
  | "campaigns:write"
  | "campaigns:delete"
  | "accounts:read"
  | "accounts:write"
  | "accounts:delete"
  | "automations:read"
  | "automations:write"
  | "automations:delete"
  | "reports:read"
  | "billing:read"
  | "billing:write"
  | "members:read"
  | "members:write"
  | "members:delete"
  | "settings:read"
  | "settings:write";

export const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  ADMIN: [
    "campaigns:read",
    "campaigns:write",
    "campaigns:delete",
    "accounts:read",
    "accounts:write",
    "accounts:delete",
    "automations:read",
    "automations:write",
    "automations:delete",
    "reports:read",
    "billing:read",
    "billing:write",
    "members:read",
    "members:write",
    "members:delete",
    "settings:read",
    "settings:write",
  ],
  MANAGER: [
    "campaigns:read",
    "campaigns:write",
    "campaigns:delete",
    "accounts:read",
    "accounts:write",
    "automations:read",
    "automations:write",
    "reports:read",
    "members:read",
    "settings:read",
  ],
  OPERATOR: [
    "campaigns:read",
    "campaigns:write",
    "accounts:read",
    "automations:read",
    "reports:read",
  ],
  VIEWER: ["campaigns:read", "accounts:read", "reports:read"],
};

// ========================
// API RESPONSE
// ========================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ========================
// QUEUE JOBS
// ========================

export type Platform = "TIKTOK" | "META";

export interface CampaignCreateJobPayload {
  organizationId: string;
  jobId: string;
  platform: Platform;
  advertiserAccountId: string;
  items: CampaignJobItem[];
}

export interface CampaignJobItem {
  itemId: string;
  config: Record<string, unknown>;
}

// ========================
// AUTH CONTEXT
// ========================

export interface AuthContext {
  userId: string;
  firebaseUid: string;
  email: string;
  organizationId: string;
  role: OrgRole;
  planSlug: PlanSlug;
  subscriptionStatus: SubscriptionStatus;
  permissions: Permission[];
}

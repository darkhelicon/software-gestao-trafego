import { encrypt, decrypt } from "./encryption.js";

const TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3";

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}

export interface TikTokBusinessCenter {
  bc_id: string;
  name: string;
  role: string;
}

export interface TikTokAdvertiserAccount {
  advertiser_id: string;
  advertiser_name: string;
  currency: string;
  timezone: string;
  status: string;
}

export interface TikTokCampaignPayload {
  advertiser_id: string;
  campaign_name: string;
  objective_type: string;
  budget_mode: "BUDGET_MODE_DAY" | "BUDGET_MODE_TOTAL" | "BUDGET_MODE_INFINITE";
  budget?: number;
  operation_status?: "ENABLE" | "DISABLE";
}

interface TikTokApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

// ========================
// OAuth
// ========================

export function buildTikTokAuthUrl(state: string): string {
  const params = new URLSearchParams({
    app_id: process.env["TIKTOK_APP_ID"] ?? "",
    redirect_uri: process.env["TIKTOK_REDIRECT_URI"] ?? "",
    state,
    scope: [
      "bc.list",
      "advertiser.list",
      "campaign.create",
      "campaign.read",
      "campaign.update",
      "adgroup.create",
      "adgroup.read",
      "adgroup.update",
      "ad.create",
      "ad.read",
      "ad.update",
      "report.read",
    ].join(","),
  });

  return `https://business-api.tiktok.com/portal/auth?${params.toString()}`;
}

export async function exchangeTikTokCode(code: string): Promise<TikTokTokens> {
  const res = await fetch(
    "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env["TIKTOK_APP_ID"],
        secret: process.env["TIKTOK_APP_SECRET"],
        auth_code: code,
        grant_type: "authorization_code",
      }),
    }
  );

  const json = (await res.json()) as TikTokApiResponse<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  }>;

  if (json.code !== 0) {
    throw new Error(`TikTok OAuth error: ${json.message}`);
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + json.data.expires_in);

  return {
    accessToken: json.data.access_token,
    refreshToken: json.data.refresh_token,
    expiresAt,
    scopes: json.data.scope.split(",").filter(Boolean),
  };
}

export async function refreshTikTokToken(
  encryptedRefreshToken: string
): Promise<TikTokTokens> {
  const refreshToken = decrypt(encryptedRefreshToken);

  const res = await fetch(
    "https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env["TIKTOK_APP_ID"],
        secret: process.env["TIKTOK_APP_SECRET"],
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    }
  );

  const json = (await res.json()) as TikTokApiResponse<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  }>;

  if (json.code !== 0) {
    throw new Error(`TikTok refresh error: ${json.message}`);
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + json.data.expires_in);

  return {
    accessToken: json.data.access_token,
    refreshToken: json.data.refresh_token,
    expiresAt,
    scopes: json.data.scope.split(",").filter(Boolean),
  };
}

// ========================
// Helpers
// ========================

async function tiktokGet<T>(
  path: string,
  encryptedToken: string,
  params?: Record<string, string>
): Promise<T> {
  const token = decrypt(encryptedToken);
  const url = new URL(`${TIKTOK_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { "Access-Token": token, "Content-Type": "application/json" },
  });

  const json = (await res.json()) as TikTokApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(`TikTok API [${path}]: ${json.message} (${json.code})`);
  }
  return json.data;
}

async function tiktokPost<T>(
  path: string,
  encryptedToken: string,
  body: unknown
): Promise<T> {
  const token = decrypt(encryptedToken);
  const res = await fetch(`${TIKTOK_BASE}${path}`, {
    method: "POST",
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as TikTokApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(`TikTok API [${path}]: ${json.message} (${json.code})`);
  }
  return json.data;
}

// ========================
// API methods
// ========================

export async function tiktokListBusinessCenters(
  encryptedToken: string
): Promise<TikTokBusinessCenter[]> {
  const data = await tiktokGet<{ list: TikTokBusinessCenter[] }>(
    "/bc/get/",
    encryptedToken
  );
  return data.list ?? [];
}

export async function tiktokListAdvertiserAccounts(
  encryptedToken: string,
  bcId: string
): Promise<TikTokAdvertiserAccount[]> {
  const data = await tiktokGet<{ list: TikTokAdvertiserAccount[] }>(
    "/bc/advertiser/get/",
    encryptedToken,
    { bc_id: bcId }
  );
  return data.list ?? [];
}

export async function tiktokCreateCampaign(
  encryptedToken: string,
  payload: TikTokCampaignPayload
): Promise<{ campaign_id: string }> {
  return tiktokPost<{ campaign_id: string }>(
    "/campaign/create/",
    encryptedToken,
    payload
  );
}

export async function tiktokUpdateCampaignStatus(
  encryptedToken: string,
  advertiserId: string,
  campaignId: string,
  status: "ENABLE" | "DISABLE" | "DELETE"
): Promise<void> {
  await tiktokPost("/campaign/status/update/", encryptedToken, {
    advertiser_id: advertiserId,
    campaign_ids: [campaignId],
    operation_status: status,
  });
}

export async function tiktokUpdateCampaignBudget(
  encryptedToken: string,
  advertiserId: string,
  campaignId: string,
  budgetMode: "BUDGET_MODE_DAY" | "BUDGET_MODE_TOTAL",
  budget: number
): Promise<void> {
  await tiktokPost("/campaign/update/", encryptedToken, {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    budget_mode: budgetMode,
    budget,
  });
}

export async function tiktokGetCampaigns(
  encryptedToken: string,
  advertiserId: string
): Promise<{
  list: Array<{
    campaign_id: string;
    campaign_name: string;
    status: string;
    budget: number;
  }>;
}> {
  return tiktokGet("/campaign/get/", encryptedToken, {
    advertiser_id: advertiserId,
    fields: JSON.stringify([
      "campaign_id",
      "campaign_name",
      "status",
      "budget",
      "budget_mode",
      "objective_type",
      "create_time",
    ]),
  });
}

export interface TikTokDailyReportRow {
  campaign_id: string;
  campaign_name: string;
  stat_time_day: string; // "YYYY-MM-DD HH:mm:ss"
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversion: number;
  cost_per_conversion: number;
  total_purchase_value: number;
  purchase_roas: number;
}

export async function tiktokGetDailyReport(
  encryptedToken: string,
  advertiserId: string,
  startDate: string,
  endDate: string
): Promise<TikTokDailyReportRow[]> {
  const token = decrypt(encryptedToken);

  const res = await fetch(`${TIKTOK_BASE}/report/integrated/get/`, {
    method: "POST",
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      report_type: "BASIC",
      dimensions: ["campaign_id", "stat_time_day"],
      metrics: [
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "cpc",
        "cpm",
        "conversion",
        "cost_per_conversion",
        "total_purchase_value",
        "purchase_roas",
      ],
      start_date: startDate,
      end_date: endDate,
      lifetime: false,
      page: 1,
      page_size: 1000,
    }),
  });

  const json = (await res.json()) as TikTokApiResponse<{
    list: Array<{
      dimensions: { campaign_id: string; stat_time_day: string };
      metrics: {
        spend: string;
        impressions: string;
        clicks: string;
        ctr: string;
        cpc: string;
        cpm: string;
        conversion: string;
        cost_per_conversion: string;
        campaign_name: string;
        total_purchase_value: string;
        purchase_roas: string;
      };
    }>;
  }>;

  if (json.code !== 0) {
    throw new Error(`TikTok report error: ${json.message}`);
  }

  return (json.data?.list ?? []).map((row) => ({
    campaign_id: row.dimensions.campaign_id,
    campaign_name: row.metrics.campaign_name,
    stat_time_day: row.dimensions.stat_time_day,
    spend: parseFloat(row.metrics.spend) || 0,
    impressions: parseInt(row.metrics.impressions, 10) || 0,
    clicks: parseInt(row.metrics.clicks, 10) || 0,
    ctr: parseFloat(row.metrics.ctr) || 0,
    cpc: parseFloat(row.metrics.cpc) || 0,
    cpm: parseFloat(row.metrics.cpm) || 0,
    conversion: parseInt(row.metrics.conversion, 10) || 0,
    cost_per_conversion: parseFloat(row.metrics.cost_per_conversion) || 0,
    total_purchase_value: parseFloat(row.metrics.total_purchase_value) || 0,
    purchase_roas: parseFloat(row.metrics.purchase_roas) || 0,
  }));
}

// ========================
// Account balance
// ========================

export async function tiktokGetAdvertiserBalance(
  encryptedToken: string,
  advertiserId: string
): Promise<number> {
  const data = await tiktokGet<{
    list: Array<{ advertiser_id: string; balance: string }>;
  }>(
    "/advertiser/info/",
    encryptedToken,
    {
      advertiser_ids: JSON.stringify([advertiserId]),
      fields: JSON.stringify(["balance"]),
    }
  );
  const entry = data.list?.[0];
  return entry ? parseFloat(entry.balance) || 0 : 0;
}

// ========================
// Rejected campaigns
// ========================

// Returns external campaign IDs whose delivery is blocked due to review failure.
export async function tiktokGetRejectedCampaigns(
  encryptedToken: string,
  advertiserId: string
): Promise<string[]> {
  const data = await tiktokGet<{
    list: Array<{ campaign_id: string; secondary_status: string }>;
  }>(
    "/campaign/get/",
    encryptedToken,
    {
      advertiser_id: advertiserId,
      fields: JSON.stringify(["campaign_id", "secondary_status"]),
    }
  );

  const REJECTED_SECONDARY = new Set([
    "CAMPAIGN_STATUS_ADVERTISER_AUDIT_DENY",
    "ADGROUP_STATUS_AD_AUDIT_FAIL",
    "AD_STATUS_AUDIT_DENY",
    "CAMPAIGN_STATUS_DISABLE",
  ]);

  return (data.list ?? [])
    .filter((c) => REJECTED_SECONDARY.has(c.secondary_status))
    .map((c) => c.campaign_id);
}

export { encrypt, decrypt };

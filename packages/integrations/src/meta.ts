import { encrypt, decrypt } from "./encryption.js";

const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

export interface MetaTokens {
  accessToken: string;
  expiresAt: Date;
  userId: string;
}

export interface MetaBusinessManager {
  id: string;
  name: string;
}

export interface MetaAdAccount {
  id: string; // "act_123456789"
  name: string;
  currency: string;
  timezone_name: string;
}

export interface MetaCampaignPayload {
  name: string;
  objective: string;
  status: "ACTIVE" | "PAUSED";
  dailyBudget?: number;    // local currency units (e.g. R$)
  lifetimeBudget?: number;
  specialAdCategories?: string[];
}

interface MetaApiError {
  error: { message: string; type: string; code: number; fbtrace_id?: string };
}

function assertNoError<T>(json: unknown, context: string): T {
  if (json && typeof json === "object" && "error" in json) {
    const err = (json as MetaApiError).error;
    throw new Error(`Meta API [${context}]: ${err.message} (code ${err.code})`);
  }
  return json as T;
}

// ========================
// OAuth
// ========================

export function buildMetaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env["META_APP_ID"] ?? "",
    redirect_uri: process.env["META_REDIRECT_URI"] ?? "",
    scope: "ads_management,business_management,ads_read,pages_read_engagement",
    state,
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaCode(code: string): Promise<MetaTokens> {
  // Step 1: code → short-lived user token
  const tokenParams = new URLSearchParams({
    client_id: process.env["META_APP_ID"] ?? "",
    redirect_uri: process.env["META_REDIRECT_URI"] ?? "",
    client_secret: process.env["META_APP_SECRET"] ?? "",
    code,
  });

  const shortRes = await fetch(
    `${META_GRAPH_BASE}/oauth/access_token?${tokenParams.toString()}`
  );
  const shortJson = await shortRes.json();
  assertNoError(shortJson, "oauth/access_token");
  const shortToken = (shortJson as { access_token: string }).access_token;

  // Step 2: short-lived → long-lived (60 days)
  const llParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env["META_APP_ID"] ?? "",
    client_secret: process.env["META_APP_SECRET"] ?? "",
    fb_exchange_token: shortToken,
  });

  const llRes = await fetch(
    `${META_GRAPH_BASE}/oauth/access_token?${llParams.toString()}`
  );
  const llJson = await llRes.json();
  assertNoError(llJson, "oauth/access_token (ll)");
  const { access_token, expires_in } = llJson as {
    access_token: string;
    expires_in?: number;
  };

  // Step 3: resolve Meta user ID
  const meRes = await fetch(
    `${META_GRAPH_BASE}/me?fields=id&access_token=${access_token}`
  );
  const meJson = await meRes.json();
  assertNoError(meJson, "/me");
  const userId = (meJson as { id: string }).id;

  const expiresAt = new Date();
  expiresAt.setSeconds(
    expiresAt.getSeconds() + (expires_in ?? 5_184_000) // 60 days fallback
  );

  return { accessToken: access_token, expiresAt, userId };
}

export async function refreshMetaToken(
  encryptedToken: string
): Promise<MetaTokens> {
  const token = decrypt(encryptedToken);

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env["META_APP_ID"] ?? "",
    client_secret: process.env["META_APP_SECRET"] ?? "",
    fb_exchange_token: token,
  });

  const res = await fetch(
    `${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`
  );
  const json = await res.json();
  assertNoError(json, "oauth/access_token (refresh)");
  const { access_token, expires_in } = json as {
    access_token: string;
    expires_in?: number;
  };

  const meRes = await fetch(
    `${META_GRAPH_BASE}/me?fields=id&access_token=${access_token}`
  );
  const meJson = await meRes.json();
  assertNoError(meJson, "/me (refresh)");
  const userId = (meJson as { id: string }).id;

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (expires_in ?? 5_184_000));

  return { accessToken: access_token, expiresAt, userId };
}

// ========================
// Helpers
// ========================

async function metaGet<T>(
  path: string,
  encryptedToken: string,
  params?: Record<string, string>
): Promise<T> {
  const token = decrypt(encryptedToken);
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", token);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  const json = await res.json();
  return assertNoError<T>(json, path);
}

async function metaPost<T>(
  path: string,
  encryptedToken: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = decrypt(encryptedToken);
  const res = await fetch(`${META_GRAPH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json = await res.json();
  return assertNoError<T>(json, path);
}

// ========================
// API methods
// ========================

export async function metaListBusinessManagers(
  encryptedToken: string
): Promise<MetaBusinessManager[]> {
  const data = await metaGet<{ data: MetaBusinessManager[] }>(
    "/me/businesses",
    encryptedToken,
    { fields: "id,name" }
  );
  return data.data ?? [];
}

export async function metaListAdAccounts(
  encryptedToken: string,
  businessManagerId: string
): Promise<MetaAdAccount[]> {
  const data = await metaGet<{ data: MetaAdAccount[] }>(
    `/${businessManagerId}/owned_ad_accounts`,
    encryptedToken,
    { fields: "id,name,currency,timezone_name" }
  );
  return data.data ?? [];
}

export async function metaCreateCampaign(
  encryptedToken: string,
  accountId: string,
  payload: MetaCampaignPayload
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    name: payload.name,
    objective: payload.objective,
    status: payload.status,
    special_ad_categories: payload.specialAdCategories ?? [],
  };

  if (payload.dailyBudget != null) {
    // Meta expects budget in the currency's minor unit (cents/centavos)
    body["daily_budget"] = String(Math.round(payload.dailyBudget * 100));
  } else if (payload.lifetimeBudget != null) {
    body["lifetime_budget"] = String(Math.round(payload.lifetimeBudget * 100));
  }

  return metaPost<{ id: string }>(`/${accountId}/campaigns`, encryptedToken, body);
}

export async function metaUpdateCampaignStatus(
  encryptedToken: string,
  campaignId: string,
  status: "ACTIVE" | "PAUSED" | "DELETED"
): Promise<void> {
  await metaPost<{ success: boolean }>(`/${campaignId}`, encryptedToken, {
    status,
  });
}

export async function metaUpdateCampaignBudget(
  encryptedToken: string,
  campaignId: string,
  budgetType: "daily" | "lifetime",
  budget: number
): Promise<void> {
  const body: Record<string, string> = {};
  if (budgetType === "daily") {
    body["daily_budget"] = String(Math.round(budget * 100));
  } else {
    body["lifetime_budget"] = String(Math.round(budget * 100));
  }
  await metaPost<{ success: boolean }>(`/${campaignId}`, encryptedToken, body);
}

export async function metaGetCampaigns(
  encryptedToken: string,
  accountId: string
): Promise<{
  data: Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
    daily_budget?: string;
    lifetime_budget?: string;
    created_time?: string;
  }>;
}> {
  return metaGet(
    `/${accountId}/campaigns`,
    encryptedToken,
    {
      fields:
        "id,name,status,objective,daily_budget,lifetime_budget,created_time",
    }
  );
}

export interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  date_start: string; // "YYYY-MM-DD"
  impressions: number;
  clicks: number;
  spend: number;
  cpc: number;
  cpm: number;
  ctr: number;
  conversions: number;
  cost_per_conversion: number;
}

export async function metaGetAccountInsights(
  encryptedToken: string,
  accountId: string, // "act_123456789"
  startDate: string, // "YYYY-MM-DD"
  endDate: string
): Promise<MetaInsightRow[]> {
  const rows: MetaInsightRow[] = [];
  let nextUrl: string | null = null;

  const initialData = await metaGet<{
    data: Array<{
      campaign_id: string;
      campaign_name: string;
      date_start: string;
      impressions: string;
      clicks: string;
      spend: string;
      cpc: string;
      cpm: string;
      ctr: string;
      actions?: Array<{ action_type: string; value: string }>;
      cost_per_action_type?: Array<{ action_type: string; value: string }>;
    }>;
    paging?: { next?: string };
  }>(
    `/${accountId}/insights`,
    encryptedToken,
    {
      fields:
        "campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,actions,cost_per_action_type",
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      level: "campaign",
      time_increment: "1",
      limit: "500",
    }
  );

  function parseRow(row: (typeof initialData.data)[0]): MetaInsightRow {
    const convAction = row.actions?.find(
      (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" ||
             a.action_type === "purchase" ||
             a.action_type === "omni_purchase"
    );
    const cpaAction = row.cost_per_action_type?.find(
      (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" ||
             a.action_type === "purchase" ||
             a.action_type === "omni_purchase"
    );

    return {
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      date_start: row.date_start,
      impressions: parseInt(row.impressions, 10) || 0,
      clicks: parseInt(row.clicks, 10) || 0,
      spend: parseFloat(row.spend) || 0,
      cpc: parseFloat(row.cpc) || 0,
      cpm: parseFloat(row.cpm) || 0,
      ctr: parseFloat(row.ctr) || 0,
      conversions: convAction ? parseInt(convAction.value, 10) : 0,
      cost_per_conversion: cpaAction ? parseFloat(cpaAction.value) : 0,
    };
  }

  initialData.data.forEach((r) => rows.push(parseRow(r)));
  nextUrl = initialData.paging?.next ?? null;

  // Follow pagination
  while (nextUrl) {
    const token = decrypt(encryptedToken);
    const res = await fetch(nextUrl.includes("access_token") ? nextUrl : `${nextUrl}&access_token=${token}`);
    const page = await res.json() as typeof initialData;
    assertNoError(page, "insights/pagination");
    page.data.forEach((r) => rows.push(parseRow(r)));
    nextUrl = page.paging?.next ?? null;
  }

  return rows;
}

export { encrypt, decrypt };

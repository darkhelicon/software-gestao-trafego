import {
  DEMO_USER_ID,
  DEMO_FIREBASE_UID,
  DEMO_USER_EMAIL,
  DEMO_ORG_ID,
  DEMO_PLAN_SLUG,
  DEMO_SUBSCRIPTION_STATUS,
} from "../lib/demo-mode.js";

const now = new Date();
const past = (days: number) => new Date(now.getTime() - days * 86_400_000);
const future = (days: number) => new Date(now.getTime() + days * 86_400_000);

// ── Plans ─────────────────────────────────────────────────────────────────────
export const plans = [
  {
    id: "plan-start",
    slug: "START",
    name: "Start",
    description: "Para pequenas agências",
    price: 9700,
    currency: "BRL",
    interval: "month",
    maxUsers: 2,
    maxCampaigns: 50,
    maxAdAccounts: 3,
    maxMonthlySpend: 5000_00,
    isActive: true,
    features: ["TikTok Ads", "Meta Ads", "Relatórios básicos"],
    stripePriceId: null,
    createdAt: past(180),
    updatedAt: past(180),
  },
  {
    id: "plan-growth",
    slug: "GROWTH",
    name: "Growth",
    description: "Para agências em crescimento",
    price: 29700,
    currency: "BRL",
    interval: "month",
    maxUsers: 10,
    maxCampaigns: 500,
    maxAdAccounts: 20,
    maxMonthlySpend: 50_000_00,
    isActive: true,
    features: ["TikTok Ads", "Meta Ads", "Automação", "Bulk create", "Relatórios avançados"],
    stripePriceId: null,
    createdAt: past(180),
    updatedAt: past(180),
  },
  {
    id: "plan-scale",
    slug: "SCALE",
    name: "Scale",
    description: "Para grandes operações",
    price: 99700,
    currency: "BRL",
    interval: "month",
    maxUsers: 50,
    maxCampaigns: 5000,
    maxAdAccounts: 100,
    maxMonthlySpend: 500_000_00,
    isActive: true,
    features: ["Tudo do Growth", "API access", "SLA prioritário"],
    stripePriceId: null,
    createdAt: past(180),
    updatedAt: past(180),
  },
  {
    id: "plan-enterprise",
    slug: "ENTERPRISE",
    name: "Enterprise",
    description: "Sob medida",
    price: 0,
    currency: "BRL",
    interval: "month",
    maxUsers: 9999,
    maxCampaigns: 999_999,
    maxAdAccounts: 999,
    maxMonthlySpend: 0,
    isActive: true,
    features: ["Ilimitado", "SLA dedicado", "Onboarding customizado"],
    stripePriceId: null,
    createdAt: past(180),
    updatedAt: past(180),
  },
];

const growthPlan = plans[1]!;

// ── Subscription ──────────────────────────────────────────────────────────────
export const subscription = {
  id: "demo-sub-id",
  organizationId: DEMO_ORG_ID,
  planId: growthPlan.id,
  plan: growthPlan,
  status: DEMO_SUBSCRIPTION_STATUS,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodStart: past(15),
  currentPeriodEnd: future(15),
  trialEndsAt: null,
  canceledAt: null,
  createdAt: past(60),
  updatedAt: past(1),
};

// ── Organization ──────────────────────────────────────────────────────────────
export const organization = {
  id: DEMO_ORG_ID,
  name: "Demo Agency",
  slug: "demo-agency",
  logoUrl: null,
  website: "https://demo.adflow.com",
  timezone: "America/Sao_Paulo",
  currency: "BRL",
  createdAt: past(90),
  updatedAt: past(1),
  subscription,
};

// ── User ──────────────────────────────────────────────────────────────────────
export const user = {
  id: DEMO_USER_ID,
  firebaseUid: DEMO_FIREBASE_UID,
  email: DEMO_USER_EMAIL,
  name: "Demo User",
  avatarUrl: null,
  createdAt: past(90),
  updatedAt: past(1),
  organizationUsers: [
    {
      role: "ADMIN",
      joinedAt: past(90),
      organization: { ...organization },
    },
  ],
};

// ── OrganizationUser membership ───────────────────────────────────────────────
export const organizationUser = {
  organizationId: DEMO_ORG_ID,
  userId: DEMO_USER_ID,
  role: "ADMIN",
  joinedAt: past(90),
  organization,
  user,
};

// ── TikTok connections ────────────────────────────────────────────────────────
export const tiktokConnections = [
  {
    id: "tt-conn-1",
    organizationId: DEMO_ORG_ID,
    externalAccountId: "7234567890123456789",
    displayName: "AdFlow TikTok Business",
    advertiserName: "Demo Agency",
    status: "ACTIVE",
    scopes: ["ad_account:read", "campaign:write"],
    tokenExpiresAt: future(30),
    lastSyncAt: past(1),
    createdAt: past(60),
    updatedAt: past(1),
  },
  {
    id: "tt-conn-2",
    organizationId: DEMO_ORG_ID,
    externalAccountId: "7234567890199999999",
    displayName: "Cliente Premium TikTok",
    advertiserName: "Cliente Premium Ltda",
    status: "ACTIVE",
    scopes: ["ad_account:read", "campaign:write"],
    tokenExpiresAt: future(25),
    lastSyncAt: past(2),
    createdAt: past(45),
    updatedAt: past(2),
  },
];

// ── TikTok accounts ───────────────────────────────────────────────────────────
export const tiktokAccounts = [
  {
    id: "tt-acc-1",
    connectionId: "tt-conn-1",
    externalId: "ADV_111222333",
    name: "Demo Agency — Principal",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    status: "ENABLE",
    balance: 1250000,
    createdAt: past(60),
    updatedAt: past(1),
    connection: tiktokConnections[0],
  },
  {
    id: "tt-acc-2",
    connectionId: "tt-conn-2",
    externalId: "ADV_444555666",
    name: "Cliente Premium — TikTok",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    status: "ENABLE",
    balance: 4780000,
    createdAt: past(45),
    updatedAt: past(2),
    connection: tiktokConnections[1],
  },
];

// ── Meta connections ──────────────────────────────────────────────────────────
export const metaConnections = [
  {
    id: "meta-conn-1",
    organizationId: DEMO_ORG_ID,
    externalUserId: "9876543210",
    displayName: "Meta Business — Demo",
    status: "ACTIVE",
    scopes: ["ads_management", "ads_read"],
    tokenExpiresAt: future(45),
    lastSyncAt: past(1),
    createdAt: past(55),
    updatedAt: past(1),
  },
];

// ── Meta accounts ─────────────────────────────────────────────────────────────
export const metaAccounts = [
  {
    id: "meta-acc-1",
    connectionId: "meta-conn-1",
    externalId: "act_123456789",
    name: "Demo Agency — Meta Ads",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
    balance: 2100000,
    createdAt: past(55),
    updatedAt: past(1),
    connection: metaConnections[0],
  },
  {
    id: "meta-acc-2",
    connectionId: "meta-conn-1",
    externalId: "act_987654321",
    name: "Cliente Premium — Meta",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
    balance: 8900000,
    createdAt: past(50),
    updatedAt: past(2),
    connection: metaConnections[0],
  },
];

// ── Campaigns ─────────────────────────────────────────────────────────────────
const makeCampaign = (
  id: string,
  name: string,
  platform: string,
  status: string,
  budget: number,
  spend: number,
  impressions: number,
  clicks: number,
  daysAgo: number
) => ({
  id,
  organizationId: DEMO_ORG_ID,
  externalId: `EXT_${id.toUpperCase()}`,
  name,
  platform,
  status,
  objective: "CONVERSIONS",
  dailyBudget: budget,
  totalSpend: spend,
  impressions,
  clicks,
  conversions: Math.floor(clicks * 0.04),
  ctr: clicks / impressions,
  cpm: (spend / impressions) * 1000,
  cpc: spend / clicks,
  roas: parseFloat((Math.random() * 3 + 1.5).toFixed(2)),
  startDate: past(daysAgo),
  endDate: future(30 - daysAgo),
  createdAt: past(daysAgo),
  updatedAt: past(1),
});

export const campaigns = [
  makeCampaign("camp-1", "Campanha TikTok — Verão 2025", "TIKTOK", "ACTIVE", 50000, 38200, 425000, 8900, 30),
  makeCampaign("camp-2", "Remarketing TikTok — Carrinho", "TIKTOK", "ACTIVE", 20000, 15400, 198000, 5200, 20),
  makeCampaign("camp-3", "Lançamento Produto — TikTok", "TIKTOK", "PAUSED", 80000, 61000, 890000, 18200, 45),
  makeCampaign("camp-4", "Campanha Meta — Conversão", "META", "ACTIVE", 60000, 47800, 612000, 12400, 28),
  makeCampaign("camp-5", "Meta — Tráfego Blog", "META", "ACTIVE", 15000, 9800, 285000, 7100, 15),
  makeCampaign("camp-6", "Meta — Leads Qualificados", "META", "PAUSED", 35000, 28900, 445000, 9600, 40),
];

// ── Templates ─────────────────────────────────────────────────────────────────
export const templates = [
  {
    id: "tpl-1",
    organizationId: DEMO_ORG_ID,
    name: "E-commerce — Conversão Básica",
    platform: "TIKTOK",
    objective: "CONVERSIONS",
    description: "Template otimizado para e-commerce com foco em conversão",
    config: { bidStrategy: "LOWEST_COST", placementType: "AUTOMATIC" },
    isPublic: false,
    usageCount: 12,
    createdAt: past(60),
    updatedAt: past(5),
  },
  {
    id: "tpl-2",
    organizationId: DEMO_ORG_ID,
    name: "Lead Gen — B2B",
    platform: "META",
    objective: "LEAD_GENERATION",
    description: "Captação de leads qualificados para B2B",
    config: { bidStrategy: "COST_CAP", targetCpa: 5000 },
    isPublic: false,
    usageCount: 7,
    createdAt: past(45),
    updatedAt: past(10),
  },
  {
    id: "tpl-3",
    organizationId: DEMO_ORG_ID,
    name: "Awareness — Branding",
    platform: "TIKTOK",
    objective: "REACH",
    description: "Maximizar alcance para campanhas de marca",
    config: { bidStrategy: "CPM", frequency: 3 },
    isPublic: true,
    usageCount: 23,
    createdAt: past(30),
    updatedAt: past(2),
  },
  {
    id: "tpl-4",
    organizationId: DEMO_ORG_ID,
    name: "Remarketing — Carrinho Abandonado",
    platform: "META",
    objective: "CONVERSIONS",
    description: "Recuperação de carrinho abandonado",
    config: { audienceType: "RETARGETING", lookbackWindow: 7 },
    isPublic: false,
    usageCount: 18,
    createdAt: past(25),
    updatedAt: past(3),
  },
];

// ── Automation rules ──────────────────────────────────────────────────────────
export const automationRules = [
  {
    id: "rule-1",
    organizationId: DEMO_ORG_ID,
    name: "Pausar se CPA > R$150",
    platform: "TIKTOK",
    trigger: { metric: "cpa", operator: "gt", value: 15000 },
    action: { type: "PAUSE_CAMPAIGN" },
    isActive: true,
    lastTriggeredAt: past(3),
    triggerCount: 4,
    createdAt: past(30),
    updatedAt: past(3),
  },
  {
    id: "rule-2",
    organizationId: DEMO_ORG_ID,
    name: "Aumentar budget se ROAS > 4x",
    platform: "META",
    trigger: { metric: "roas", operator: "gt", value: 4 },
    action: { type: "INCREASE_BUDGET", percentage: 20 },
    isActive: true,
    lastTriggeredAt: past(1),
    triggerCount: 12,
    createdAt: past(45),
    updatedAt: past(1),
  },
  {
    id: "rule-3",
    organizationId: DEMO_ORG_ID,
    name: "Alerta CTR baixo",
    platform: "TIKTOK",
    trigger: { metric: "ctr", operator: "lt", value: 0.8 },
    action: { type: "SEND_NOTIFICATION" },
    isActive: false,
    lastTriggeredAt: null,
    triggerCount: 0,
    createdAt: past(20),
    updatedAt: past(20),
  },
];

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = [
  {
    id: "notif-1",
    organizationId: DEMO_ORG_ID,
    userId: DEMO_USER_ID,
    title: "Regra de automação ativada",
    message: "A regra \"Pausar se CPA > R$150\" pausou a campanha \"Lançamento Produto — TikTok\".",
    type: "AUTOMATION",
    isRead: false,
    createdAt: past(3),
  },
  {
    id: "notif-2",
    organizationId: DEMO_ORG_ID,
    userId: DEMO_USER_ID,
    title: "Campanha aprovada na plataforma",
    message: "\"Campanha TikTok — Verão 2025\" foi aprovada e está em veiculação.",
    type: "CAMPAIGN",
    isRead: false,
    createdAt: past(5),
  },
  {
    id: "notif-3",
    organizationId: DEMO_ORG_ID,
    userId: DEMO_USER_ID,
    title: "ROAS acima do target",
    message: "Campanha \"Meta — Conversão\" atingiu ROAS de 4.2x nos últimos 7 dias.",
    type: "PERFORMANCE",
    isRead: true,
    createdAt: past(7),
  },
  {
    id: "notif-4",
    organizationId: DEMO_ORG_ID,
    userId: DEMO_USER_ID,
    title: "Budget diário consumido a 80%",
    message: "\"Remarketing TikTok — Carrinho\" consumiu 80% do budget diário.",
    type: "BUDGET",
    isRead: true,
    createdAt: past(10),
  },
];

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportSummary = {
  organizationId: DEMO_ORG_ID,
  period: { start: past(30), end: now },
  totalSpend: 201100,
  totalImpressions: 2855000,
  totalClicks: 61400,
  totalConversions: 2456,
  avgCtr: 2.15,
  avgCpm: 7.04,
  avgCpc: 3.27,
  avgRoas: 2.81,
  byPlatform: {
    TIKTOK: { spend: 114600, impressions: 1513000, clicks: 32300, conversions: 1292 },
    META: { spend: 86500, impressions: 1342000, clicks: 29100, conversions: 1164 },
  },
  byDay: Array.from({ length: 30 }, (_, i) => ({
    date: past(29 - i),
    spend: 4000 + Math.floor(Math.random() * 4000),
    impressions: 60000 + Math.floor(Math.random() * 40000),
    clicks: 1200 + Math.floor(Math.random() * 1200),
    conversions: 48 + Math.floor(Math.random() * 60),
  })),
};

// ── Members ───────────────────────────────────────────────────────────────────
export const members = [
  {
    userId: DEMO_USER_ID,
    organizationId: DEMO_ORG_ID,
    role: "ADMIN",
    joinedAt: past(90),
    user: { id: DEMO_USER_ID, email: DEMO_USER_EMAIL, name: "Demo User", avatarUrl: null },
  },
  {
    userId: "demo-user-2",
    organizationId: DEMO_ORG_ID,
    role: "MANAGER",
    joinedAt: past(60),
    user: { id: "demo-user-2", email: "manager@adflow.com", name: "Ana Gerente", avatarUrl: null },
  },
  {
    userId: "demo-user-3",
    organizationId: DEMO_ORG_ID,
    role: "OPERATOR",
    joinedAt: past(30),
    user: { id: "demo-user-3", email: "operador@adflow.com", name: "Carlos Operador", avatarUrl: null },
  },
];

// ── Usage ─────────────────────────────────────────────────────────────────────
export const usageSummary = {
  organizationId: DEMO_ORG_ID,
  planSlug: DEMO_PLAN_SLUG,
  campaigns: { used: campaigns.length, limit: 500 },
  adAccounts: { used: tiktokAccounts.length + metaAccounts.length, limit: 20 },
  members: { used: members.length, limit: 10 },
  apiCalls: { used: 1842, limit: 10000 },
};

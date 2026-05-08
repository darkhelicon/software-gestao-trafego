// Re-export from shared package so routes import from one place
export {
  buildTikTokAuthUrl as buildAuthUrl,
  exchangeTikTokCode as exchangeCode,
  refreshTikTokToken as refreshAccessToken,
  tiktokListBusinessCenters as listBusinessCenters,
  tiktokListAdvertiserAccounts as listAdvertiserAccounts,
  tiktokCreateCampaign as createCampaign,
  tiktokUpdateCampaignStatus as updateCampaignStatus,
  tiktokGetCampaigns as getCampaigns,
  encrypt,
  decrypt,
} from "@adflow/integrations";

export type {
  TikTokTokens,
  TikTokBusinessCenter,
  TikTokAdvertiserAccount,
  TikTokCampaignPayload,
} from "@adflow/integrations";

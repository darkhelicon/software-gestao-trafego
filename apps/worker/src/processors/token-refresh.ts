import { prisma } from "@adflow/database";
import { refreshTikTokToken, refreshMetaToken, encrypt } from "@adflow/integrations";

// Runs hourly via cron registered in worker index
export async function refreshExpiringTokens(): Promise<void> {
  await Promise.all([refreshTikTok(), refreshMeta()]);
}

// ========================
// TikTok — refresh tokens expiring within 24h
// ========================

async function refreshTikTok(): Promise<void> {
  const threshold = new Date();
  threshold.setHours(threshold.getHours() + 24);

  const expiring = await prisma.tiktokConnection.findMany({
    where: { isActive: true, tokenExpiresAt: { lte: threshold } },
    select: {
      id: true,
      refreshToken: true,
      organizationId: true,
      businessCenterId: true,
    },
  });

  if (!expiring.length) return;

  console.log(`[token-refresh] Refreshing ${expiring.length} TikTok token(s)`);

  const results = await Promise.allSettled(
    expiring.map(async (conn) => {
      const refreshed = await refreshTikTokToken(conn.refreshToken);

      await prisma.tiktokConnection.update({
        where: { id: conn.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          refreshToken: encrypt(refreshed.refreshToken),
          tokenExpiresAt: refreshed.expiresAt,
        },
      });

      return conn.id;
    })
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.error(
      `[token-refresh] ${failed.length} TikTok refresh(es) failed:`,
      failed.map((f) => (f as PromiseRejectedResult).reason)
    );
  }

  console.log(
    `[token-refresh] TikTok: ${results.length - failed.length} refreshed, ${failed.length} failed`
  );
}

// ========================
// Meta — extend tokens expiring within 7 days
// (Meta long-lived tokens last 60 days; renew proactively)
// ========================

async function refreshMeta(): Promise<void> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 7);

  const expiring = await prisma.metaConnection.findMany({
    where: {
      isActive: true,
      tokenExpiresAt: { lte: threshold },
    },
    select: {
      id: true,
      accessToken: true,
      organizationId: true,
      businessManagerId: true,
    },
  });

  if (!expiring.length) return;

  console.log(`[token-refresh] Refreshing ${expiring.length} Meta token(s)`);

  const results = await Promise.allSettled(
    expiring.map(async (conn) => {
      const refreshed = await refreshMetaToken(conn.accessToken);

      await prisma.metaConnection.update({
        where: { id: conn.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          tokenExpiresAt: refreshed.expiresAt,
        },
      });

      return conn.id;
    })
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.error(
      `[token-refresh] ${failed.length} Meta refresh(es) failed:`,
      failed.map((f) => (f as PromiseRejectedResult).reason)
    );
  }

  console.log(
    `[token-refresh] Meta: ${results.length - failed.length} refreshed, ${failed.length} failed`
  );
}

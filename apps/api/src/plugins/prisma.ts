import fp from "fastify-plugin";
import type { PrismaClient } from "@helzo-scale/database";
import { isDemoMode } from "../lib/demo-mode.js";
import { mockPrismaClient } from "../mocks/prisma.mock.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app) => {
  if (isDemoMode()) {
    app.decorate("prisma", mockPrismaClient);
    return;
  }

  // Dynamic import so PrismaClient is never instantiated in demo mode
  // (Prisma v6 validates DATABASE_URL in the constructor, not just on connect)
  const { prisma } = await import("@helzo-scale/database");

  await prisma.$connect();

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});

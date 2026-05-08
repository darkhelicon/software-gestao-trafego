import fp from "fastify-plugin";
import { prisma } from "@adflow/database";
import type { PrismaClient } from "@adflow/database";
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

  await prisma.$connect();

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});

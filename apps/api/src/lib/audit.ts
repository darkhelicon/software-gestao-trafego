import type { PrismaClient, AuditAction } from "@adflow/database";
import { Prisma } from "@adflow/database";

interface AuditParams {
  prisma: PrismaClient;
  organizationId: string;
  userId?: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  const {
    prisma,
    organizationId,
    userId,
    action,
    resource,
    resourceId,
    metadata,
    ipAddress,
    userAgent,
  } = params;

  await prisma.auditLog.create({
    data: {
      organizationId,
      action,
      ...(userId !== undefined ? { userId } : {}),
      ...(resource !== undefined ? { resource } : {}),
      ...(resourceId !== undefined ? { resourceId } : {}),
      ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      ...(ipAddress !== undefined ? { ipAddress } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    },
  });
}

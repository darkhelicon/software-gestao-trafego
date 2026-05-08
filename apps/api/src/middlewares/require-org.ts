import type { FastifyRequest, FastifyReply } from "fastify";
import type { OrgRole } from "@adflow/database";

declare module "fastify" {
  interface FastifyRequest {
    organizationId: string;
    orgRole: OrgRole;
  }
}

export async function requireOrg(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const orgId = request.headers["x-organization-id"] as string | undefined;

  if (!orgId) {
    return reply
      .status(400)
      .send({ success: false, error: "X-Organization-Id header is required" });
  }

  const membership = await request.server.prisma.organizationUser.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: request.userId,
      },
    },
    select: { role: true, joinedAt: true },
  });

  if (!membership || !membership.joinedAt) {
    return reply
      .status(403)
      .send({ success: false, error: "Not a member of this organization" });
  }

  request.organizationId = orgId;
  request.orgRole = membership.role;
}

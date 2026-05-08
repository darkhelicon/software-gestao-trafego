import type { FastifyRequest, FastifyReply } from "fastify";
import { ROLE_PERMISSIONS } from "@adflow/types";
import type { Permission } from "@adflow/types";

export function requirePermission(permission: Permission) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const allowed = ROLE_PERMISSIONS[request.orgRole] ?? [];

    if (!allowed.includes(permission)) {
      return reply.status(403).send({
        success: false,
        error: "Insufficient permissions",
        required: permission,
      });
    }
  };
}

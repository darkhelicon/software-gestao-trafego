import type { FastifyRequest, FastifyReply } from "fastify";
import { ROLE_PERMISSIONS } from "@helzo-scale/types";
import type { Permission } from "@helzo-scale/types";

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

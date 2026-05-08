import type { FastifyRequest, FastifyReply } from "fastify";
import { firebaseAuth } from "../lib/firebase-admin.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    firebaseUid: string;
    userEmail: string;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ success: false, error: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await firebaseAuth.verifyIdToken(token, true);

    // Resolve internal user from DB
    const user = await request.server.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true, firebaseUid: true, email: true },
    });

    if (!user) {
      return reply
        .status(401)
        .send({ success: false, error: "User not found" });
    }

    request.userId = user.id;
    request.firebaseUid = user.firebaseUid;
    request.userEmail = user.email;
  } catch {
    return reply.status(401).send({ success: false, error: "Invalid token" });
  }
}

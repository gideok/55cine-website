import type { FastifyReply, FastifyRequest } from "fastify";
import { isAdminAuthConfigured, isAdminSessionActive } from "../services/admin-session.service.js";

export function isAdminAuthenticated(request: FastifyRequest): boolean {
  if (!isAdminAuthConfigured()) return false;
  return isAdminSessionActive(request);
}

export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!isAdminAuthenticated(request)) {
    reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "관리자 인증이 필요합니다." }
    });
  }
}

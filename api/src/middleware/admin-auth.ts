import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * 추후수정 및 로그인 연동
 * 현재는 스텁 인증 — X-Admin-Auth: true 헤더 또는 항상 통과.
 * 실제 로그인 연동 시 JWT/세션 검증으로 교체할 것.
 */
const ADMIN_STUB_ENABLED = true; // 추후수정 및 로그인 연동

export function isAdminAuthenticated(request: FastifyRequest): boolean {
  if (!ADMIN_STUB_ENABLED) {
    const token = request.headers["x-admin-auth"];
    return token === "true" || token === "1";
  }
  // 추후수정 및 로그인 연동 — 현재는 모든 요청 허용
  return true;
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

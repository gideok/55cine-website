import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

export const ADMIN_SESSION_COOKIE = "ti_admin_session";
export const ADMIN_SESSION_HEADER = "x-admin-session";
/** 브라우저 재시작·재부팅 후에도 유지(로그아웃 시 삭제). 토큰 자체는 만료 없음. */
export const ADMIN_SESSION_COOKIE_MAX_AGE_SEC = 10 * 365 * 24 * 60 * 60;

function sessionSecret(): string | null {
  return config.admin.sessionSecret;
}

function signPayload(payloadB64: string): string {
  const secret = sessionSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createAdminSessionToken(): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = { v: 1 };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

function parseSessionPayload(payloadB64: string): { exp?: number } | null {
  try {
    return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { exp?: number };
  } catch {
    return null;
  }
}

function isSessionPayloadValid(payload: { exp?: number } | null): boolean {
  if (!payload) return false;
  if (typeof payload.exp === "number") {
    return payload.exp > Date.now();
  }
  return true;
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token || !sessionSecret()) return false;
  const parts = String(token).split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return false;

  const expected = signPayload(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  return isSessionPayloadValid(parseSessionPayload(payloadB64));
}

export function readAdminSessionToken(request: FastifyRequest): string | null {
  const header = request.headers[ADMIN_SESSION_HEADER];
  if (typeof header === "string" && header.trim()) return header.trim();

  const cookieToken = request.cookies?.[ADMIN_SESSION_COOKIE];
  if (typeof cookieToken === "string" && cookieToken.trim()) return cookieToken.trim();

  return null;
}

export function isAdminSessionActive(request: FastifyRequest): boolean {
  return verifyAdminSessionToken(readAdminSessionToken(request));
}

export function setAdminSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(ADMIN_SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.admin.secureCookie,
    maxAge: ADMIN_SESSION_COOKIE_MAX_AGE_SEC
  });
}

export function clearAdminSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(ADMIN_SESSION_COOKIE, {
    path: "/",
    secure: config.admin.secureCookie,
    sameSite: "lax"
  });
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const id = config.admin.id;
  const pw = config.admin.password;
  if (!id || !pw) return false;

  const userBuf = Buffer.from(String(username));
  const idBuf = Buffer.from(id);
  const passBuf = Buffer.from(String(password));
  const pwBuf = Buffer.from(pw);

  if (userBuf.length !== idBuf.length || passBuf.length !== pwBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(userBuf, idBuf) && crypto.timingSafeEqual(passBuf, pwBuf);
}

export function isAdminAuthConfigured(): boolean {
  return !!(config.admin.id && config.admin.password && config.admin.sessionSecret);
}

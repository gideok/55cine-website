import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

export const ADMIN_SESSION_COOKIE = "ti_admin_session";
export const ADMIN_SESSION_HEADER = "x-admin-session";
export const ADMIN_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
  const payload = { exp: Date.now() + ADMIN_SESSION_MAX_AGE_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${signPayload(payloadB64)}`;
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

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
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
    maxAge: Math.floor(ADMIN_SESSION_MAX_AGE_MS / 1000)
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

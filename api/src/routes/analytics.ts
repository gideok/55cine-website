import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import {
  newVisitorId,
  recordPageview,
  shouldSkipAnalyticsForHost,
  visitorCookieName
} from "../services/analytics.service.js";

const bodySchema = z.object({
  path: z.string().min(1).max(800),
  pageKey: z.string().max(200).optional().nullable()
});

function clientIp(request: FastifyRequest): string {
  const xff = request.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && typeof xff[0] === "string") {
    return xff[0].split(",")[0].trim();
  }
  const real = request.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  return request.ip || "";
}

function setVisitorCookie(reply: FastifyReply, visitorId: string): void {
  reply.setCookie(visitorCookieName(), visitorId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: config.admin.secureCookie
  });
}

export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/analytics/pageview", async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    const host = String(request.headers.host || "").split(":")[0];
    if (shouldSkipAnalyticsForHost(host)) {
      return { ok: true, skipped: true };
    }

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "INVALID_BODY", message: "path 필요" }
      });
    }

    const cookieName = visitorCookieName();
    let visitorId = String(request.cookies?.[cookieName] || "").trim();
    let issued = false;
    if (!visitorId) {
      visitorId = newVisitorId();
      setVisitorCookie(reply, visitorId);
      issued = true;
    }

    try {
      const result = recordPageview({
        path: parsed.data.path,
        pageKey: parsed.data.pageKey,
        visitorId,
        ip: clientIp(request),
        userAgent: String(request.headers["user-agent"] || "")
      });
      return { ok: true, counted: result.ok && "counted" in result ? result.counted : false, issued };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "ANALYTICS_FAILED", message: "pageview 기록 실패" }
      });
    }
  });
}

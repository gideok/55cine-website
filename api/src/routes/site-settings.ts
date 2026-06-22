import type { FastifyInstance } from "fastify";
import { getPublicSiteSettings } from "../services/site-settings.service.js";

export async function registerSiteSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/site-settings", async (request, reply) => {
    try {
      const settings = await getPublicSiteSettings();
      reply.header("Cache-Control", "public, max-age=60");
      return settings;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "SITE_SETTINGS_FAILED", message: "사이트 설정 조회 실패" }
      });
    }
  });
}

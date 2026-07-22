import type { FastifyInstance } from "fastify";
import { buildRobotsTxt, buildSitemapXml } from "../services/sitemap.service.js";

export async function registerSitemapRoutes(app: FastifyInstance): Promise<void> {
  app.get("/sitemap.xml", async (request, reply) => {
    try {
      const xml = await buildSitemapXml();
      reply
        .header("Content-Type", "application/xml; charset=utf-8")
        .header("Cache-Control", "public, max-age=3600")
        .send(xml);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "SITEMAP_FAILED", message: "sitemap 생성 실패" }
      });
    }
  });

  app.get("/robots.txt", async (_request, reply) => {
    reply
      .header("Content-Type", "text/plain; charset=utf-8")
      .header("Cache-Control", "public, max-age=3600")
      .send(buildRobotsTxt());
  });
}

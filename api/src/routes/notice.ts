import type { FastifyInstance } from "fastify";
import { getActiveNotice } from "../services/notice.service.js";

export async function registerNoticeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/notice/active", async (request, reply) => {
    try {
      const notice = await getActiveNotice();
      reply.header("Cache-Control", "public, max-age=60");
      return notice;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "NOTICE_FAILED", message: "공지 조회 실패" }
      });
    }
  });
}

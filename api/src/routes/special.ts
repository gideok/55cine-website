import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSpecialDetail, getSpecialList } from "../services/special.service.js";

const kindSchema = z.enum(["exhibition", "event"]);

export async function registerSpecialRoutes(app: FastifyInstance): Promise<void> {
  app.get("/special", async (request, reply) => {
    const parsed = z.object({ kind: kindSchema }).safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "INVALID_QUERY", message: "kind=exhibition|event 필요" }
      });
    }

    try {
      const items = await getSpecialList(parsed.data.kind);
      reply.header("Cache-Control", "public, max-age=120");
      return { items };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "SPECIAL_LIST_FAILED", message: "기획전·행사 목록 조회 실패" }
      });
    }
  });

  app.get("/special/:publicId", async (request, reply) => {
    const params = z.object({ publicId: z.string().min(1) }).safeParse(request.params);
    const query = z.object({ kind: kindSchema.optional() }).safeParse(request.query);

    if (!params.success) {
      return reply.code(400).send({
        error: { code: "INVALID_PARAMS", message: "publicId 필요" }
      });
    }

    try {
      const detail = await getSpecialDetail(
        params.data.publicId,
        query.success ? query.data.kind : undefined
      );
      if (!detail) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "콘텐츠를 찾을 수 없습니다." }
        });
      }
      reply.header("Cache-Control", "public, max-age=120");
      return detail;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "SPECIAL_DETAIL_FAILED", message: "기획전·행사 상세 조회 실패" }
      });
    }
  });
}

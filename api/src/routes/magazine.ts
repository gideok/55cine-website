import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getMagazineDetail, getMagazineListPage } from "../services/magazine.service.js";

const sectionSchema = z.enum(["preview", "serial", "gv-moment"]);

export async function registerMagazineRoutes(app: FastifyInstance): Promise<void> {
  app.get("/magazine", async (request, reply) => {
    const parsed = z
      .object({
        section: sectionSchema.optional(),
        isPast: z
          .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
          .optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(50).optional(),
        q: z.string().max(200).optional()
      })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "INVALID_QUERY", message: "magazine 목록 쿼리가 올바르지 않습니다." }
      });
    }

    const isPast =
      parsed.data.isPast === "true" ||
      parsed.data.isPast === "1";

    if (!isPast && !parsed.data.section) {
      return reply.code(400).send({
        error: { code: "INVALID_QUERY", message: "section 또는 isPast=true 필요" }
      });
    }

    try {
      const data = await getMagazineListPage({
        section: parsed.data.section,
        isPast,
        page: parsed.data.page ?? 1,
        pageSize: parsed.data.pageSize ?? 12,
        search: parsed.data.q
      });
      reply.header("Cache-Control", "public, max-age=120");
      return data;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "MAGAZINE_LIST_FAILED", message: "매거진 목록 조회 실패" }
      });
    }
  });

  app.get("/magazine/:seq", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({
        error: { code: "INVALID_PARAMS", message: "seq(양의 정수) 필요" }
      });
    }

    try {
      const detail = await getMagazineDetail(params.data.seq);
      if (!detail) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "기사를 찾을 수 없습니다." }
        });
      }
      reply.header("Cache-Control", "public, max-age=120");
      return detail;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "MAGAZINE_DETAIL_FAILED", message: "매거진 상세 조회 실패" }
      });
    }
  });
}

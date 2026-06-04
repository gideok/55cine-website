import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getWeekSchedule } from "../services/schedule-week.service.js";

const weekQuerySchema = z.object({
  anchor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

export async function registerScheduleRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/schedule/week",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            anchor: { type: "string" }
          }
        }
      }
    },
    async (request, reply) => {
      const parsed = weekQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_QUERY",
            message: "anchor는 YYYY-MM-DD 형식이어야 합니다."
          }
        });
      }

      try {
        const data = await getWeekSchedule(parsed.data.anchor);
        reply.header("Cache-Control", "public, max-age=60");
        return data;
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({
          error: {
            code: "SCHEDULE_FETCH_FAILED",
            message: err instanceof Error ? err.message : "시간표 조회에 실패했습니다."
          }
        });
      }
    }
  );
}

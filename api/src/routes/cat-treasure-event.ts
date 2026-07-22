import type { FastifyInstance } from "fastify";
import {
  claimCatTreasureWin,
  getCatTreasureStatus
} from "../services/cat-treasure-event.service.js";

export async function registerCatTreasureEventRoutes(app: FastifyInstance): Promise<void> {
  app.get("/events/cat-treasure", async (request, reply) => {
    try {
      const status = await getCatTreasureStatus();
      reply.header("Cache-Control", "no-store");
      return status;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "CAT_TREASURE_STATUS_FAILED", message: "이벤트 상태 조회 실패" }
      });
    }
  });

  app.post("/events/cat-treasure/claim", async (request, reply) => {
    try {
      const result = await claimCatTreasureWin();
      reply.header("Cache-Control", "no-store");
      if (!result.ok) {
        return reply.code(result.code === "SOLD_OUT" ? 409 : 400).send({
          error: { code: result.code, message: result.message },
          currentWinners: result.currentWinners,
          totalWinners: result.totalWinners
        });
      }
      return result;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "CAT_TREASURE_CLAIM_FAILED", message: "당첨 처리 실패" }
      });
    }
  });
}

import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { getPool } from "../db/pool.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const payload: Record<string, unknown> = {
      status: "ok",
      time: new Date().toISOString(),
      dbConfigured: Boolean(config.db),
      scheduleMock: config.scheduleUseMock
    };

    if (config.db && !config.scheduleUseMock) {
      try {
        const pool = await getPool();
        await pool.request().query("SELECT 1 AS ok");
        payload.db = "connected";
      } catch (err) {
        reply.code(503);
        payload.status = "degraded";
        payload.db = "error";
        payload.message = err instanceof Error ? err.message : String(err);
      }
    }

    return payload;
  });
}

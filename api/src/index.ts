import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { closePool } from "./db/pool.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerScheduleRoutes } from "./routes/schedule.js";
import { registerMovieRoutes } from "./routes/movies.js";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true,
  credentials: true
});

await app.register(
  async (api) => {
    await registerHealthRoutes(api);
    await registerScheduleRoutes(api);
    await registerMovieRoutes(api);
  },
  { prefix: config.apiPrefix }
);

const shutdown = async () => {
  await closePool();
  await app.close();
};

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`API listening on http://${config.host}:${config.port}${config.apiPrefix}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { config } from "./config.js";
import { isAdminAuthConfigured } from "./services/admin-session.service.js";
import { closePool } from "./db/pool.js";
import { closeAnalyticsDb } from "./db/analytics-db.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerScheduleRoutes } from "./routes/schedule.js";
import { registerMovieRoutes } from "./routes/movies.js";
import { registerSpecialRoutes } from "./routes/special.js";
import { registerMagazineRoutes } from "./routes/magazine.js";
import { registerNoticeRoutes } from "./routes/notice.js";
import { registerSiteSettingsRoutes } from "./routes/site-settings.js";
import { registerSitemapRoutes } from "./routes/sitemap.js";
import { registerCatTreasureEventRoutes } from "./routes/cat-treasure-event.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerAdminRoutes } from "./routes/admin/index.js";

const app = Fastify({
  logger: true
});

if (isAdminAuthConfigured()) {
  app.log.info(`Admin auth enabled (id: ${config.admin.id})`);
} else {
  app.log.warn("Admin auth is NOT configured — set ADMIN_ID, ADMIN_PASSWORD, ADMIN_SESSION_SECRET in .env");
}

await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept", "X-Admin-Session"]
});

await app.register(cookie);

await app.register(
  async (api) => {
    await registerHealthRoutes(api);
    await registerScheduleRoutes(api);
    await registerMovieRoutes(api);
    await registerSpecialRoutes(api);
    await registerMagazineRoutes(api);
    await registerNoticeRoutes(api);
    await registerSiteSettingsRoutes(api);
    await registerSitemapRoutes(api);
    await registerCatTreasureEventRoutes(api);
    await registerAnalyticsRoutes(api);

    // admin 인증 훅이 공개 API에 적용되지 않도록 별도 플러그인으로 분리
    await api.register(async (adminApi) => {
      await registerAdminRoutes(adminApi);
    });
  },
  { prefix: config.apiPrefix }
);

const shutdown = async () => {
  await closePool();
  closeAnalyticsDb();
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
  const prefix = config.apiPrefix;
  if (config.host === "0.0.0.0" || config.host === "::") {
    app.log.info(
      `API listening (bind ${config.host}:${config.port}) — use http://127.0.0.1:${config.port}${prefix} in browser (not 0.0.0.0)`
    );
  } else {
    app.log.info(`API listening on http://${config.host}:${config.port}${prefix}`);
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

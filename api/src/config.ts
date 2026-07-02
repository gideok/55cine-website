import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const isProduction = process.env.NODE_ENV === "production";
const dotenvOpts = { override: !isProduction };

dotenv.config({ path: path.join(repoRoot, ".env"), ...dotenvOpts });
dotenv.config({ path: path.join(repoRoot, "api", ".env"), ...dotenvOpts });

export type AppConfig = {
  host: string;
  port: number;
  apiPrefix: string;
  repoRoot: string;
  timezone: string;
  scheduleUseMock: boolean;
  kmdbServiceKey: string | null;
  admin: {
    id: string | null;
    password: string | null;
    sessionSecret: string | null;
    secureCookie: boolean;
  };
  db: {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
  } | null;
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes)$/i.test(value);
}

function parseDatabaseUrl(url: string): AppConfig["db"] {
  const raw = url.replace(/^sqlserver:\/\//i, "");
  const parts = raw.split(";").filter(Boolean);
  const map: Record<string, string> = {};
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (!key || !rest.length) continue;
    map[key.trim().toLowerCase()] = rest.join("=").trim();
  }

  const hostPort = map["host"] || map["server"] || parts[0] || "";
  let server = hostPort;
  let port = 1433;
  if (hostPort.includes(":")) {
    const [h, p] = hostPort.split(":");
    server = h;
    port = Number(p) || 1433;
  } else if (map["port"]) {
    port = Number(map["port"]) || 1433;
  }

  const user = map["user"] || map["username"] || map["user id"] || "";
  const password = map["password"] || map["pwd"] || "";
  const database = map["database"] || map["dbname"] || "";

  if (!server || !user || !database) {
    return null;
  }

  return {
    server,
    port,
    database,
    user,
    password,
    encrypt: parseBool(map["encrypt"], true),
    trustServerCertificate: parseBool(map["trustservercertificate"], true)
  };
}

function dbFromEnv(): AppConfig["db"] {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const parsed = parseDatabaseUrl(url);
    if (parsed) return parsed;
  }

  const server = process.env.DB_SERVER?.trim();
  const user = process.env.DB_USER?.trim();
  const database = process.env.DB_DATABASE?.trim();
  if (!server || !user || !database) return null;

  return {
    server,
    port: Number(process.env.DB_PORT || 1433),
    database,
    user,
    password: process.env.DB_PASSWORD || "",
    encrypt: parseBool(process.env.DB_ENCRYPT, true),
    trustServerCertificate: parseBool(process.env.DB_TRUST_SERVER_CERTIFICATE, true)
  };
}

const adminId = process.env.ADMIN_ID?.trim() || process.env.ADMIN_USERNAME?.trim() || null;
const adminPassword = process.env.ADMIN_PASSWORD?.trim() || null;
const adminSessionSecret =
  process.env.ADMIN_SESSION_SECRET?.trim() ||
  (adminId && adminPassword ? `${adminId}:${adminPassword}` : null);

export const config: AppConfig = {
  host: process.env.API_HOST || "0.0.0.0",
  port: Number(process.env.API_PORT || 3000),
  apiPrefix: (process.env.API_PREFIX || "/api/v1").replace(/\/$/, ""),
  repoRoot: path.resolve(__dirname, "../.."),
  timezone: process.env.TZ || "Asia/Seoul",
  scheduleUseMock: parseBool(process.env.SCHEDULE_USE_MOCK, false),
  kmdbServiceKey: process.env.KMDB_SERVICE_KEY?.trim() || null,
  admin: {
    id: adminId,
    password: adminPassword,
    sessionSecret: adminSessionSecret,
    secureCookie: parseBool(process.env.ADMIN_SECURE_COOKIE, process.env.NODE_ENV === "production")
  },
  db: dbFromEnv()
};

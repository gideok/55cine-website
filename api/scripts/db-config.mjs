import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

export function getSqlConfig() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const raw = url.replace(/^sqlserver:\/\//i, "");
    const parts = raw.split(";").filter(Boolean);
    const map = {};
    for (const part of parts) {
      const [key, ...rest] = part.split("=");
      if (!key) continue;
      map[key.trim().toLowerCase()] = rest.join("=").trim();
    }
    const hostPort = map.host || map.server || parts[0] || "";
    let server = hostPort;
    let port = 1433;
    if (hostPort.includes(":")) {
      const [h, p] = hostPort.split(":");
      server = h;
      port = Number(p) || 1433;
    }
    return {
      server,
      port,
      database: map.database || map.dbname || "master",
      user: map.user || map.username,
      password: map.password || map.pwd,
      options: {
        encrypt: map.encrypt !== "false",
        trustServerCertificate: map.trustservercertificate !== "false"
      }
    };
  }

  const server = process.env.DB_SERVER?.trim();
  const user = process.env.DB_USER?.trim();
  if (!server || !user) return null;

  return {
    server,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_DATABASE?.trim() || "master",
    user,
    password: process.env.DB_PASSWORD || "",
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false"
    }
  };
}

/**
 * SQL 스크립트 실행 — .env 만 사용 (git 미포함)
 */
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";
import { getSqlConfig } from "./db-config.mjs";

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: node scripts/run-sql.mjs <path-to.sql>");
  process.exit(1);
}

const cfg = getSqlConfig();
if (!cfg) {
  console.error("DB_SERVER / DB_USER 또는 DATABASE_URL 이 필요합니다.");
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), sqlFile);
const script = fs.readFileSync(fullPath, "utf8");
const batches = script.split(/\bGO\b/gi).map((s) => s.trim()).filter(Boolean);

const pool = await sql.connect(cfg);
for (const batch of batches) {
  await pool.request().query(batch);
}
await pool.close();
console.log("OK:", fullPath);

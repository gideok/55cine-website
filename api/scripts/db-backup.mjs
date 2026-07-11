/**
 * MS SQL Server 논리 백업 — dbo 테이블을 JSON으로 덤프
 * 서버: deploy/scripts/db-backup.sh + systemd timer (4시간)
 */
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";
import { getSqlConfig } from "./db-config.mjs";

const OUT_DIR = process.env.DB_BACKUP_OUT_DIR?.trim();
if (!OUT_DIR) {
  console.error("DB_BACKUP_OUT_DIR 환경 변수가 필요합니다.");
  process.exit(1);
}

function serializeValue(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) {
    return { __type: "Buffer", data: value.toString("base64") };
  }
  return value;
}

function serializeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = serializeValue(value);
  }
  return out;
}

async function main() {
  const cfg = getSqlConfig();
  if (!cfg?.server || !cfg?.user || !cfg?.database) {
    console.error("DB 설정 없음 (.env)");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const pool = await sql.connect(cfg);
  const tables = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = N'dbo'
    ORDER BY TABLE_NAME
  `);

  const manifest = {
    database: cfg.database,
    server: cfg.server,
    createdAt: new Date().toISOString(),
    tables: []
  };

  for (const row of tables.recordset) {
    const schema = row.TABLE_SCHEMA;
    const name = row.TABLE_NAME;
    const qualified = `[${schema}].[${name}]`;
    const result = await pool.request().query(`SELECT * FROM ${qualified}`);
    const payload = result.recordset.map(serializeRow);
    const fileName = `${schema}.${name}.json`;
    fs.writeFileSync(path.join(OUT_DIR, fileName), JSON.stringify(payload));
    manifest.tables.push({ schema, name, rows: payload.length, file: fileName });
    console.log(`[db-backup] ${qualified}: ${payload.length} rows`);
  }

  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  await pool.close();

  const totalRows = manifest.tables.reduce((sum, t) => sum + t.rows, 0);
  console.log(
    `[db-backup] done — ${manifest.tables.length} tables, ${totalRows} rows -> ${OUT_DIR}`
  );
}

main().catch((err) => {
  console.error("[db-backup] failed:", err.message || err);
  process.exit(1);
});

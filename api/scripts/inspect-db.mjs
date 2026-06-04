/**
 * DB 스키마 확인 (로컬 .env 만 사용)
 */
import sql from "mssql";
import { getSqlConfig } from "./db-config.mjs";

const cfg = getSqlConfig();
if (!cfg?.server || !cfg?.user) {
  console.error("DB 설정 없음 (.env)");
  process.exit(1);
}

async function main() {
  const pool = await sql.connect(cfg);
  const cols = await pool.request().query(`
    SELECT c.name, t.name AS type_name
    FROM sys.columns c
    INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
    INNER JOIN sys.tables tb ON c.object_id = tb.object_id
    INNER JOIN sys.schemas s ON tb.schema_id = s.schema_id
    WHERE s.name = N'dbo' AND tb.name = N'prog_daily'
    ORDER BY c.column_id
  `);
  console.log("Database:", cfg.database);
  console.log("prog_daily columns:");
  for (const row of cols.recordset) {
    console.log(" -", row.name, row.type_name);
  }
  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

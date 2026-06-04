/**
 * prog_daily 기준 2026-05-01 이후 회차 없는 현재상영작 → date_close = 2025-12-31
 *
 * Usage:
 *   node scripts/admin-close-stale-now-playing.mjs           # 미리보기만
 *   node scripts/admin-close-stale-now-playing.mjs --execute # UPDATE 실행
 */
import sql from "mssql";
import { getSqlConfig } from "./db-config.mjs";

const SCHEDULE_CUTOFF = "2026-05-01";
const DATE_CLOSE_SET = "2025-12-31";
const execute = process.argv.includes("--execute");

const scheduleMaxCte = `
schedule_max AS (
  SELECT
    pd.prog_id,
    MAX(TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc)))) AS last_date_sc
  FROM dbo.prog_daily AS pd
  WHERE NULLIF(LTRIM(RTRIM(pd.date_sc)), '') IS NOT NULL
    AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) IS NOT NULL
  GROUP BY pd.prog_id
)`;

const targetWhere = `
  wp.slug IS NOT NULL
  AND LTRIM(RTRIM(wp.slug)) <> ''
  AND TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open))) IS NOT NULL
  AND @today >= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open)))
  AND (
    NULLIF(LTRIM(RTRIM(pb.date_close)), '') IS NULL
    OR @today <= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close)))
  )
  AND (
    sm.last_date_sc IS NULL
    OR sm.last_date_sc <= @schedule_cutoff
  )
  AND ISNULL(LTRIM(RTRIM(pb.date_close)), '') <> @date_close_set
`;

async function main() {
  const cfg = getSqlConfig();
  if (!cfg?.server || !cfg?.user) {
    console.error("DB 설정 없음 (프로젝트 루트 .env)");
    process.exit(1);
  }

  const pool = await sql.connect(cfg);

  const previewRes = await pool
    .request()
    .input("schedule_cutoff", sql.Date, SCHEDULE_CUTOFF)
    .input("date_close_set", sql.Char(10), DATE_CLOSE_SET)
    .query(`
      DECLARE @today date = CAST(GETDATE() AS date);
      ;WITH ${scheduleMaxCte}
      SELECT
        pb.prog_id,
        pb.name,
        wp.slug,
        LTRIM(RTRIM(pb.date_open)) AS date_open,
        LTRIM(RTRIM(pb.date_close)) AS date_close_before,
        @date_close_set AS date_close_after,
        sm.last_date_sc
      FROM dbo.prog_base AS pb
      INNER JOIN dbo.web_program AS wp ON wp.prog_id = pb.prog_id
      LEFT JOIN schedule_max AS sm ON sm.prog_id = pb.prog_id
      WHERE ${targetWhere}
      ORDER BY pb.prog_id;
    `);

  const rows = previewRes.recordset;
  console.log("Database:", cfg.database);
  console.log("Cutoff (no screenings after):", SCHEDULE_CUTOFF);
  console.log("date_close set to:", DATE_CLOSE_SET);
  console.log("Targets:", rows.length);
  if (rows.length) console.table(rows);

  if (!execute) {
    console.log("\nDry-run only. Run with --execute to UPDATE.");
    await pool.close();
    return;
  }

  if (!rows.length) {
    console.log("Nothing to update.");
    await pool.close();
    return;
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const updateRes = await new sql.Request(tx)
      .input("schedule_cutoff", sql.Date, SCHEDULE_CUTOFF)
      .input("date_close_set", sql.Char(10), DATE_CLOSE_SET)
      .query(`
        DECLARE @today date = CAST(GETDATE() AS date);
        ;WITH ${scheduleMaxCte},
        targets AS (
          SELECT pb.prog_id
          FROM dbo.prog_base AS pb
          INNER JOIN dbo.web_program AS wp ON wp.prog_id = pb.prog_id
          LEFT JOIN schedule_max AS sm ON sm.prog_id = pb.prog_id
          WHERE ${targetWhere}
        )
        UPDATE pb
        SET pb.date_close = @date_close_set
        FROM dbo.prog_base AS pb
        INNER JOIN targets AS t ON t.prog_id = pb.prog_id;
        SELECT @@ROWCOUNT AS rows_updated;
      `);

    await tx.commit();
    console.log("Updated rows:", updateRes.recordset[0]?.rows_updated ?? 0);
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

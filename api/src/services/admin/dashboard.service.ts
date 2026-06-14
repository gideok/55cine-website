import sql from "mssql";
import { getPool } from "../../db/pool.js";
import { getServerToday } from "../schedule-flags.js";

export type AdminDashboardStats = {
  programs: {
    total: number;
    /** prog_base만 있고 web_program 없음, date_open >= 2026-01-01 */
    desktopOnlyFrom2026: number;
  };
  movies: {
    nowPlaying: number;
    upcoming: number;
    past: number;
  };
  special: {
    exhibition: number;
    event: number;
    total: number;
  };
  magazine: {
    preview: number;
    serial: number;
    gvMoment: number;
    past: number;
    total: number;
  };
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const pool = await getPool();
  const today = getServerToday();

  const [progRes, desktopOnly2026Res, nowRes, upRes, pastRes, spRes, mzRes] = await Promise.all([
    pool.request().query<{ total: number }>(`SELECT COUNT(*) AS total FROM dbo.web_program`),
    pool.request().input("yearStart", sql.Date, "2026-01-01").query<{ total: number }>(`
      SELECT COUNT(*) AS total
      FROM dbo.prog_base pb
      LEFT JOIN dbo.web_program wp ON wp.prog_id = pb.prog_id
      WHERE wp.seq IS NULL
        AND TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open))) >= @yearStart
    `),
    pool.request().input("today", sql.Date, today).query<{ total: number }>(`
      SELECT COUNT(*) AS total
      FROM dbo.web_program wp
      INNER JOIN dbo.prog_base pb ON pb.prog_id = wp.prog_id
      WHERE @today >= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open)))
        AND (
          NULLIF(LTRIM(RTRIM(pb.date_close)), '') IS NULL
          OR @today <= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close)))
        )
    `),
    pool.request().input("today", sql.Date, today).query<{ total: number }>(`
      SELECT COUNT(*) AS total
      FROM dbo.web_program wp
      INNER JOIN dbo.prog_base pb ON pb.prog_id = wp.prog_id
      WHERE @today < TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open)))
    `),
    pool.request().input("today", sql.Date, today).query<{ total: number }>(`
      SELECT COUNT(*) AS total
      FROM dbo.web_program wp
      INNER JOIN dbo.prog_base pb ON pb.prog_id = wp.prog_id
      WHERE NULLIF(LTRIM(RTRIM(pb.date_close)), '') IS NOT NULL
        AND @today > TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close)))
    `),
    pool.request().query<{ kind: string; cnt: number }>(`
      SELECT kind, COUNT(*) AS cnt FROM dbo.web_special GROUP BY kind
    `),
    pool.request().query<{ section: string; is_past: boolean; cnt: number }>(`
      SELECT section, is_past, COUNT(*) AS cnt FROM dbo.web_magazine GROUP BY section, is_past
    `)
  ]);

  let exhibition = 0;
  let event = 0;
  for (const row of spRes.recordset) {
    if (row.kind === "exhibition") exhibition = row.cnt;
    if (row.kind === "event") event = row.cnt;
  }

  const magazine = { preview: 0, serial: 0, gvMoment: 0, past: 0, total: 0 };
  for (const row of mzRes.recordset) {
    if (row.is_past) {
      magazine.past += row.cnt;
    } else if (row.section === "preview") {
      magazine.preview = row.cnt;
    } else if (row.section === "serial") {
      magazine.serial = row.cnt;
    } else if (row.section === "gv-moment") {
      magazine.gvMoment = row.cnt;
    }
    magazine.total += row.cnt;
  }

  return {
    programs: {
      total: progRes.recordset[0]?.total ?? 0,
      desktopOnlyFrom2026: desktopOnly2026Res.recordset[0]?.total ?? 0
    },
    movies: {
      nowPlaying: nowRes.recordset[0]?.total ?? 0,
      upcoming: upRes.recordset[0]?.total ?? 0,
      past: pastRes.recordset[0]?.total ?? 0
    },
    special: { exhibition, event, total: exhibition + event },
    magazine
  };
}

import sql from "mssql";
import { getPool } from "../db/pool.js";
import {
  formatMovieDetailDateLabel,
  formatTimeLabel,
  getServerToday,
  toDateOnly
} from "./schedule-flags.js";
import { formatReleaseDate, gradeToRating } from "./movie-grade.js";

export type MovieSection = "now-playing" | "upcoming" | "past";

export type MovieListItem = {
  slug: string;
  poster: string;
  titleKo: string;
  titleEn: string;
  director?: string;
  detailUrl?: string;
};

export type MovieDetailRecord = {
  slug: string;
  poster: string;
  titleKo: string;
  titleEn: string;
  director: string;
  cast: string;
  info: string;
  runningMinutes: number | null;
  ratingImage: string;
  ratingAlt: string;
  releaseDate: string;
  synopsis: string;
  trailerYoutubeId: string;
  screenings: Array<{ dateLabel: string; timeLabel: string; bookingUrl?: string }>;
  bookingUrl?: string;
};

type ProgRow = {
  prog_id: number;
  slug: string;
  name: string;
  name2: string | null;
  date_open: unknown;
  date_close: unknown;
  grade: number | null;
  runningtime: number | null;
  img1: string | null;
  img_thumb: string | null;
  director: string | null;
  cast_names: string | null;
  info: string | null;
  synopsis: string | null;
  trailer_url: string | null;
};

const PROG_WEB_SELECT = `
  pb.prog_id,
  wp.slug,
  pb.name,
  pb.name2,
  pb.date_open,
  pb.date_close,
  pb.grade,
  pb.runningtime,
  wp.img1,
  wp.img_thumb,
  wp.director,
  wp.cast_names,
  wp.info,
  wp.synopsis,
  wp.trailer_url
`;

/** sys_code div_code 040 — 상영상태 */
const PROG_STATE_DIV_CODE = "040";
const PROG_STATE_ENDED_NAME = "상영종료";

function excludeScreeningEndedClause(): string {
  return `
    AND NOT EXISTS (
      SELECT 1
      FROM dbo.sys_code AS sc
      WHERE sc.div_code = N'${PROG_STATE_DIV_CODE}'
        AND sc.seq_code = pb.div_state
        AND sc.name = N'${PROG_STATE_ENDED_NAME}'
    )
  `;
}

function sectionWhereClause(section: MovieSection): string {
  switch (section) {
    case "now-playing":
      return `
        @today >= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open)))
        AND (
          NULLIF(LTRIM(RTRIM(pb.date_close)), '') IS NULL
          OR @today <= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close)))
        )
        ${excludeScreeningEndedClause()}
      `;
    case "upcoming":
      return `@today < TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open)))`;
    case "past":
      return `
        NULLIF(LTRIM(RTRIM(pb.date_close)), '') IS NOT NULL
        AND @today > TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close)))
      `;
    default:
      throw new Error(`Unknown section: ${section}`);
  }
}

function titleEnFromSlug(slug: string): string {
  return String(slug || "").trim().replace(/-/g, " ");
}

function resolveListTitleEn(slug: string): string {
  return titleEnFromSlug(slug);
}

function resolveDetailTitleEn(row: ProgRow): string {
  return String(row.name2 || "").trim() || titleEnFromSlug(String(row.slug || ""));
}

function mapListItem(row: ProgRow, section: MovieSection): MovieListItem {
  const slug = String(row.slug || "").trim();
  return {
    slug,
    poster: row.img1?.trim() || "images/schedule-poster-placeholder.svg",
    titleKo: String(row.name || "").trim(),
    titleEn: resolveListTitleEn(slug),
    director: row.director?.trim() || undefined,
    detailUrl: `movies/movie-detail.html?slug=${encodeURIComponent(slug)}&from=${section}`
  };
}

type ProgDailyScreeningRow = {
  prog_id: number;
  date_sc: unknown;
  time_sc: unknown;
};

function mapScreeningRows(rows: ProgDailyScreeningRow[]): MovieDetailRecord["screenings"] {
  const screenings: MovieDetailRecord["screenings"] = [];
  for (const row of rows) {
    const date = toDateOnly(row.date_sc);
    if (!date) continue;
    const timeLabel = formatTimeLabel(row.time_sc);
    if (!timeLabel) continue;
    screenings.push({
      dateLabel: formatMovieDetailDateLabel(date),
      timeLabel
    });
  }
  return screenings;
}

/** prog_daily.date_sc / time_sc 기준, 서버 오늘(포함) 이후만 */
async function fetchScreeningsFromProgDaily(
  progId: number
): Promise<MovieDetailRecord["screenings"]> {
  const pool = await getPool();
  const today = getServerToday();
  const result = await pool
    .request()
    .input("progId", sql.Int, progId)
    .input("today", sql.Date, today)
    .query<ProgDailyScreeningRow>(`
      SELECT
        pd.prog_id,
        pd.date_sc,
        pd.time_sc
      FROM dbo.prog_daily AS pd
      WHERE pd.prog_id = @progId
        AND NULLIF(LTRIM(RTRIM(pd.date_sc)), '') IS NOT NULL
        AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) IS NOT NULL
        AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) >= @today
      ORDER BY
        TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))),
        pd.time_sc
    `);

  return mapScreeningRows(result.recordset);
}

function mapDetail(row: ProgRow, screenings: MovieDetailRecord["screenings"] = []): MovieDetailRecord {
  const slug = String(row.slug || "").trim();
  const rating = gradeToRating(row.grade);
  const infoText = row.info?.trim() || "";

  return {
    slug,
    poster: row.img1?.trim() || "images/schedule-poster-placeholder.svg",
    titleKo: String(row.name || "").trim(),
    titleEn: resolveDetailTitleEn(row),
    director: row.director?.trim() || "",
    cast: row.cast_names?.trim() || "",
    info: infoText,
    runningMinutes: row.runningtime ?? null,
    ratingImage: rating.ratingImage,
    ratingAlt: rating.ratingAlt,
    releaseDate: formatReleaseDate(row.date_open),
    synopsis: row.synopsis?.trim() || "",
    trailerYoutubeId: row.trailer_url?.trim() || "",
    screenings
  };
}

type ProgRowWithTotal = ProgRow & { _total: number };

function listOrderClause(section: MovieSection): string {
  if (section === "past") {
    return `
      TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close))) DESC,
      pb.name
    `;
  }
  return `
    TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open))) DESC,
    pb.name
  `;
}

function listSearchClause(search?: string): string {
  const q = String(search || "").trim();
  if (!q) return "";
  return `
    AND (
      pb.name LIKE @search
      OR ISNULL(pb.name2, '') LIKE @search
      OR ISNULL(wp.director, '') LIKE @search
    )
  `;
}

async function queryPrograms(
  section: MovieSection,
  options?: { page?: number; pageSize?: number; search?: string }
): Promise<{ rows: ProgRow[]; total: number }> {
  const pool = await getPool();
  const today = getServerToday();
  const request = pool.request();
  request.input("today", sql.Date, today);

  const search = String(options?.search || "").trim();
  if (search) {
    request.input("search", sql.NVarChar, `%${search}%`);
  }

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 6));
  const offset = (page - 1) * pageSize;

  request.input("offset", sql.Int, offset);
  request.input("pageSize", sql.Int, pageSize);

  const result = await request.query<ProgRowWithTotal>(`
    SELECT ${PROG_WEB_SELECT}, COUNT(*) OVER() AS _total
    FROM dbo.prog_base AS pb
    INNER JOIN dbo.web_program AS wp ON wp.prog_id = pb.prog_id
    WHERE wp.slug IS NOT NULL
      AND LTRIM(RTRIM(wp.slug)) <> ''
      AND TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open))) IS NOT NULL
      AND ${sectionWhereClause(section)}
      ${listSearchClause(search)}
    ORDER BY ${listOrderClause(section)}
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  const total = result.recordset[0]?._total ?? 0;
  return { rows: result.recordset, total };
}

export type MovieListPageResult = {
  movies: MovieListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function getMovieList(section: MovieSection): Promise<{ movies: MovieListItem[] }> {
  const result = await getMovieListPage(section, 1, 5000);
  return { movies: result.movies };
}

export async function getMovieListPage(
  section: MovieSection,
  page: number,
  pageSize: number,
  search?: string
): Promise<MovieListPageResult> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const { rows, total } = await queryPrograms(section, {
    page: safePage,
    pageSize: safeSize,
    search
  });
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  return {
    movies: rows.map((row) => mapListItem(row, section)),
    page: safePage,
    pageSize: safeSize,
    total,
    totalPages: total === 0 ? 0 : totalPages
  };
}

export async function getMovieDetail(
  slug: string,
  _section?: MovieSection
): Promise<MovieDetailRecord | null> {
  const key = String(slug || "").trim().toLowerCase();
  if (!key) return null;

  const pool = await getPool();
  const result = await pool.request().input("slug", sql.NVarChar, key).query<ProgRow>(`
    SELECT ${PROG_WEB_SELECT}
    FROM dbo.web_program AS wp
    INNER JOIN dbo.prog_base AS pb ON pb.prog_id = wp.prog_id
    WHERE LOWER(wp.slug) = @slug
  `);

  const row = result.recordset[0];
  if (!row) return null;
  const screenings = await fetchScreeningsFromProgDaily(row.prog_id);
  return mapDetail(row, screenings);
}

export async function getAllMovieDetails(): Promise<MovieDetailRecord[]> {
  const pool = await getPool();
  const result = await pool.request().query<ProgRow>(`
    SELECT ${PROG_WEB_SELECT}
    FROM dbo.web_program AS wp
    INNER JOIN dbo.prog_base AS pb ON pb.prog_id = wp.prog_id
    WHERE wp.slug IS NOT NULL AND LTRIM(RTRIM(wp.slug)) <> ''
    ORDER BY pb.name
  `);
  return result.recordset.map((row) => mapDetail(row));
}


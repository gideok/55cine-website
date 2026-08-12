import sql from "mssql";
import { getPool } from "../db/pool.js";
import {
  formatMovieDetailDateLabel,
  formatTimeLabel,
  getServerToday,
  parseFlagsFromProgLabel,
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
  screenings: Array<{
    dateLabel: string;
    timeLabel: string;
    bookingUrl?: string;
    opening?: boolean;
    closing?: boolean;
    gv?: boolean;
    ct?: boolean;
  }>;
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

/** pb 별칭의 prog_base 를 참조하는 쿼리에서만 사용 가능 */
export function screeningEndedExistsClause(): string {
  return `
    EXISTS (
      SELECT 1
      FROM dbo.sys_code AS sc
      WHERE sc.div_code = N'${PROG_STATE_DIV_CODE}'
        AND sc.seq_code = pb.div_state
        AND sc.name = N'${PROG_STATE_ENDED_NAME}'
    )
  `;
}

export function excludeScreeningEndedClause(): string {
  return `AND NOT (${screeningEndedExistsClause().trim()})`;
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
        (
          (
            NULLIF(LTRIM(RTRIM(pb.date_close)), '') IS NOT NULL
            AND @today > TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close)))
          )
          OR (${screeningEndedExistsClause().trim()})
        )
      `;
    default:
      throw new Error(`Unknown section: ${section}`);
  }
}

function titleEnFromSlug(slug: string): string {
  return String(slug || "").trim().replace(/-/g, " ");
}

function resolveListTitleEn(row: ProgRow): string {
  return String(row.name2 || "").trim() || titleEnFromSlug(String(row.slug || ""));
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
    titleEn: resolveListTitleEn(row),
    director: row.director?.trim() || undefined,
    detailUrl: `movies/movie-detail.html?slug=${encodeURIComponent(slug)}&from=${section}`
  };
}

type ProgDailyScreeningRow = {
  prog_id: number;
  date_sc: unknown;
  time_sc: unknown;
  prog_label: string | null;
  is_opening: boolean | number | null;
  is_closing: boolean | number | null;
  is_gv: boolean | number | null;
  is_ct: boolean | number | null;
};

function coerceBit(value: boolean | number | null | undefined): boolean {
  return value === true || value === 1;
}

function resolveScreeningFlags(row: ProgDailyScreeningRow) {
  const hasWebFlags =
    row.is_opening != null ||
    row.is_closing != null ||
    row.is_gv != null ||
    row.is_ct != null;
  if (hasWebFlags) {
    return {
      opening: coerceBit(row.is_opening),
      closing: coerceBit(row.is_closing),
      gv: coerceBit(row.is_gv),
      ct: coerceBit(row.is_ct)
    };
  }
  return parseFlagsFromProgLabel(row.prog_label);
}

function mapScreeningRows(rows: ProgDailyScreeningRow[]): MovieDetailRecord["screenings"] {
  const screenings: MovieDetailRecord["screenings"] = [];
  for (const row of rows) {
    const date = toDateOnly(row.date_sc);
    if (!date) continue;
    const timeLabel = formatTimeLabel(row.time_sc);
    if (!timeLabel) continue;
    const flags = resolveScreeningFlags(row);
    screenings.push({
      dateLabel: formatMovieDetailDateLabel(date),
      timeLabel,
      opening: flags.opening,
      closing: flags.closing,
      gv: flags.gv,
      ct: flags.ct
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
        pd.time_sc,
        pd.prog_label,
        wps.is_opening,
        wps.is_closing,
        wps.is_gv,
        wps.is_ct
      FROM dbo.prog_daily AS pd
      LEFT JOIN dbo.web_program_schedule AS wps ON wps.prog_daily_seq = pd.seq
      WHERE pd.prog_id = @progId
        AND NULLIF(LTRIM(RTRIM(pd.date_sc)), '') IS NOT NULL
        AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) IS NOT NULL
        AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) >= @today
        AND ISNULL(pd.divhidden, 0) = 0
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
      COALESCE(
        TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close))),
        TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open)))
      ) DESC,
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
      OR REPLACE(ISNULL(wp.slug, ''), '-', ' ') LIKE @search
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

/** slug → 한국어 제목 맵 (접속 통계 pageKey 표시용) */
export async function getMovieTitlesBySlugs(slugs: string[]): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      slugs
        .map((s) => String(s || "").trim().toLowerCase())
        .filter(Boolean)
    )
  ];
  const map = new Map<string, string>();
  if (!unique.length) return map;

  const pool = await getPool();
  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const req = pool.request();
    const placeholders = chunk
      .map((slug, idx) => {
        req.input(`s${idx}`, sql.NVarChar, slug);
        return `@s${idx}`;
      })
      .join(", ");
    const result = await req.query<{ slug: string; name: string }>(`
      SELECT LOWER(LTRIM(RTRIM(wp.slug))) AS slug,
             LTRIM(RTRIM(pb.name)) AS name
      FROM dbo.web_program AS wp
      INNER JOIN dbo.prog_base AS pb ON pb.prog_id = wp.prog_id
      WHERE LOWER(LTRIM(RTRIM(wp.slug))) IN (${placeholders})
    `);
    for (const row of result.recordset) {
      const title = String(row.name || "").trim();
      if (title) map.set(String(row.slug || "").toLowerCase(), title);
    }
  }
  return map;
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


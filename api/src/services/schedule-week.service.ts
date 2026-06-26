import sql from "mssql";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import {
  addDays,
  formatDayLabel,
  formatTimeLabel,
  getCinemaWeekEnd,
  getCinemaWeekStart,
  parseAnchorDate,
  parseFlagsFromProgLabel,
  stripTime,
  toDateOnly
} from "./schedule-flags.js";

export type WeekScheduleEntry = {
  time: string;
  title: string;
  opening: boolean;
  closing: boolean;
  gv: boolean;
  ct: boolean;
};

export type WeekScheduleDay = {
  label: string;
  weekday: string;
  entries: WeekScheduleEntry[];
};

export type MovieWebInfo = {
  poster: string | null;
  detailUrl: string | null;
  slug: string | null;
  progId: number | null;
};

export type WeekScheduleResponse = {
  anchor: string;
  rangeStart: string;
  rangeEnd: string;
  days: WeekScheduleDay[];
  moviesByTitle: Record<string, MovieWebInfo>;
};

type DailyRow = {
  date_sc: unknown;
  time_sc: unknown;
  prog_id: number | null;
  prog_label: string | null;
  title: string | null;
  slug: string | null;
  detail_url: string | null;
  img_thumb: string | null;
  is_opening: boolean | number | null;
  is_closing: boolean | number | null;
  is_gv: boolean | number | null;
  is_ct: boolean | number | null;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function anchorIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cleanTitle(name: string | null | undefined): string {
  return String(name || "")
    .replace(/\s*\((개봉|종영|중영)\)\s*$/u, "")
    .trim();
}

function resolveTitle(row: DailyRow): string {
  const base = cleanTitle(row.title);
  if (base) return base;
  return cleanTitle(row.prog_label);
}

function coerceBit(value: boolean | number | null | undefined): boolean {
  return value === true || value === 1;
}

function resolveScheduleFlags(row: DailyRow) {
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

function resolveMovieDetailUrl(row: DailyRow): string | null {
  const custom = row.detail_url ? String(row.detail_url).trim() : "";
  if (custom) return custom;
  const slug = row.slug ? String(row.slug).trim() : "";
  if (!slug) return null;
  return `movies/movie-detail.html?slug=${encodeURIComponent(slug)}`;
}

function compareDayDates(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

function compareTime(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function getScheduleFetchRange(anchor?: string): {
  anchorDate: Date;
  start: Date;
  end: Date;
} {
  const anchorDate = parseAnchorDate(anchor, config.timezone);
  const primaryStart = getCinemaWeekStart(anchorDate);
  const followingEnd = getCinemaWeekEnd(addDays(primaryStart, 7));
  return {
    anchorDate,
    start: primaryStart,
    end: followingEnd
  };
}

export async function fetchWeekScheduleFromDb(anchor?: string): Promise<WeekScheduleResponse> {
  const { anchorDate, start, end } = getScheduleFetchRange(anchor);
  const pool = await getPool();
  const request = pool.request();
  request.input("rangeStart", sql.Date, start);
  request.input("rangeEnd", sql.Date, end);

  const result = await request.query<DailyRow>(`
    SELECT
      pd.date_sc,
      pd.time_sc,
      pd.prog_id,
      pd.prog_label,
      pb.name AS title,
      wp.slug,
      wp.detail_url,
      wp.img_thumb,
      wps.is_opening,
      wps.is_closing,
      wps.is_gv,
      wps.is_ct
    FROM dbo.prog_daily AS pd
    INNER JOIN dbo.prog_base AS pb ON pb.prog_id = pd.prog_id
    LEFT JOIN dbo.web_program_schedule AS wps ON wps.prog_daily_seq = pd.seq
    OUTER APPLY (
      SELECT TOP (1)
        w.slug,
        w.detail_url,
        w.img_thumb
      FROM dbo.web_program AS w
      WHERE w.prog_id = pd.prog_id
      ORDER BY w.seq DESC
    ) AS wp
    WHERE TRY_CONVERT(date, pd.date_sc) >= @rangeStart
      AND TRY_CONVERT(date, pd.date_sc) <= @rangeEnd
      AND ISNULL(pd.divhidden, 0) = 0
    ORDER BY pd.date_sc, pd.time_sc
  `);

  return buildWeekScheduleResponse(result.recordset, anchorDate, start, end);
}

function buildWeekScheduleResponse(
  rows: DailyRow[],
  anchorDate: Date,
  rangeStart: Date,
  rangeEnd: Date
): WeekScheduleResponse {
  const dayMap = new Map<string, { date: Date; day: WeekScheduleDay }>();
  const moviesByTitle: Record<string, MovieWebInfo> = {};

  for (const row of rows) {
    const date = toDateOnly(row.date_sc);
    if (!date) continue;

    const { label, weekday } = formatDayLabel(date);
    const key = anchorIso(date);
    let bucket = dayMap.get(key);
    if (!bucket) {
      bucket = {
        date,
        day: { label, weekday, entries: [] }
      };
      dayMap.set(key, bucket);
    }

    const flags = resolveScheduleFlags(row);
    const title = resolveTitle(row);
    bucket.day.entries.push({
      time: formatTimeLabel(row.time_sc),
      title,
      opening: flags.opening,
      closing: flags.closing,
      gv: flags.gv,
      ct: flags.ct
    });

    if (title) {
      const existing = moviesByTitle[title];
      const poster = row.img_thumb ? String(row.img_thumb).trim() : null;
      const detailUrl = resolveMovieDetailUrl(row);
      const slug = row.slug ? String(row.slug).trim() : null;
      if (!existing || poster || detailUrl || slug) {
        moviesByTitle[title] = {
          poster: poster || existing?.poster || null,
          detailUrl: detailUrl || existing?.detailUrl || null,
          slug: slug || existing?.slug || null,
          progId: row.prog_id ?? existing?.progId ?? null
        };
      }
    }
  }

  const days = Array.from(dayMap.values())
    .sort((a, b) => compareDayDates(a.date, b.date))
    .map((item) => {
      item.day.entries.sort((a, b) => compareTime(a.time, b.time));
      return item.day;
    });

  return {
    anchor: anchorIso(anchorDate),
    rangeStart: anchorIso(rangeStart),
    rangeEnd: anchorIso(rangeEnd),
    days,
    moviesByTitle
  };
}

export async function fetchWeekScheduleMock(anchor?: string): Promise<WeekScheduleResponse> {
  const fixturePath = path.join(__dirname, "../../fixtures/week-schedule-mock.json");
  const raw = await readFile(fixturePath, "utf8");
  const data = JSON.parse(raw) as WeekScheduleResponse;
  const anchorDate = parseAnchorDate(anchor, config.timezone);
  const { start, end } = getScheduleFetchRange(anchor);
  return {
    ...data,
    anchor: anchorIso(anchorDate),
    rangeStart: anchorIso(start),
    rangeEnd: anchorIso(end)
  };
}

export async function getWeekSchedule(anchor?: string): Promise<WeekScheduleResponse> {
  if (config.db && !config.scheduleUseMock) {
    return fetchWeekScheduleFromDb(anchor);
  }
  return fetchWeekScheduleMock(anchor);
}

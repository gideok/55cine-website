import sql from "mssql";
import { config } from "../../config.js";
import { getPool } from "../../db/pool.js";
import {
  addDays,
  formatDayLabel,
  formatTimeLabel,
  getCinemaWeekEnd,
  getCinemaWeekStart,
  parseAnchorDate,
  parseFlagsFromProgLabel,
  toDateOnly,
  toDateIsoString
} from "../schedule-flags.js";

export const DEFAULT_SLOT_ROWS = 6;

export type AdminScreeningSlot = {
  seq: number;
  seqSc: number;
  time: string;
  timeEnd: string | null;
  title: string;
  progId: number;
  progLabel: string | null;
  imgThumb: string | null;
  hidden: boolean;
  opening: boolean;
  closing: boolean;
  gv: boolean;
  ct: boolean;
};

export type AdminScreeningDay = {
  date: string;
  label: string;
  weekday: string;
  slots: AdminScreeningSlot[];
};

export type AdminScreeningWeekResponse = {
  anchor: string;
  weekStart: string;
  weekEnd: string;
  defaultSlotRows: number;
  maxSlotCount: number;
  days: AdminScreeningDay[];
};

type DailyRow = {
  seq: number;
  seq_sc: number | null;
  date_sc: unknown;
  time_sc: unknown;
  time_end: unknown;
  prog_id: number;
  prog_label: string | null;
  title: string | null;
  divhidden: number | null;
  slug: string | null;
  img_thumb: string | null;
  is_opening: boolean | number | null;
  is_closing: boolean | number | null;
  is_gv: boolean | number | null;
  is_ct: boolean | number | null;
};

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

function compareDayDates(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

function compareTime(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function getAdminScreeningWeekRange(anchor?: string): {
  anchorDate: Date;
  weekStart: Date;
  weekEnd: Date;
} {
  const anchorDate = parseAnchorDate(anchor, config.timezone);
  const weekStart = getCinemaWeekStart(anchorDate);
  const weekEnd = getCinemaWeekEnd(weekStart);
  return { anchorDate, weekStart, weekEnd };
}

export async function getAdminScreeningWeek(anchor?: string): Promise<AdminScreeningWeekResponse> {
  const { anchorDate, weekStart, weekEnd } = getAdminScreeningWeekRange(anchor);
  const pool = await getPool();
  const request = pool.request();
  request.input("weekStart", sql.NVarChar(10), toDateIsoString(weekStart));
  request.input("weekEnd", sql.NVarChar(10), toDateIsoString(weekEnd));

  const result = await request.query<DailyRow>(`
    SELECT
      pd.seq,
      pd.seq_sc,
      pd.date_sc,
      pd.time_sc,
      pd.time_end,
      pd.prog_id,
      pd.prog_label,
      pd.divhidden,
      pb.name AS title,
      wp.slug,
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
        w.img_thumb
      FROM dbo.web_program AS w
      WHERE w.prog_id = pd.prog_id
      ORDER BY w.seq DESC
    ) AS wp
    WHERE TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) >= TRY_CONVERT(date, @weekStart)
      AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) <= TRY_CONVERT(date, @weekEnd)
    ORDER BY pd.date_sc, pd.time_sc
  `);

  const dayMap = new Map<string, { date: Date; day: AdminScreeningDay }>();

  for (const row of result.recordset) {
    const date = toDateOnly(row.date_sc);
    if (!date) continue;

    const key = anchorIso(date);
    let bucket = dayMap.get(key);
    if (!bucket) {
      const { label, weekday } = formatDayLabel(date);
      bucket = {
        date,
        day: { date: key, label, weekday, slots: [] }
      };
      dayMap.set(key, bucket);
    }

    const flags = resolveScheduleFlags(row);
    const time = formatTimeLabel(row.time_sc);
    if (!time) continue;

    bucket.day.slots.push({
      seq: Number(row.seq),
      seqSc: Number(row.seq_sc ?? 0),
      time,
      timeEnd: formatTimeLabel(row.time_end) || null,
      title: resolveTitle(row),
      progId: Number(row.prog_id),
      progLabel: row.prog_label ? String(row.prog_label).trim() : null,
      imgThumb: row.img_thumb ? String(row.img_thumb).trim() : null,
      hidden: coerceBit(row.divhidden),
      opening: flags.opening,
      closing: flags.closing,
      gv: flags.gv,
      ct: flags.ct
    });
  }

  const days: AdminScreeningDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    const key = anchorIso(date);
    const bucket = dayMap.get(key);
    if (bucket) {
      bucket.day.slots.sort((a, b) => compareTime(a.time, b.time));
      days.push(bucket.day);
    } else {
      const { label, weekday } = formatDayLabel(date);
      days.push({ date: key, label, weekday, slots: [] });
    }
  }

  days.sort((a, b) => compareDayDates(toDateOnly(a.date)!, toDateOnly(b.date)!));

  const maxSlotCount = days.reduce((max, day) => Math.max(max, day.slots.length), 0);

  return {
    anchor: anchorIso(anchorDate),
    weekStart: anchorIso(weekStart),
    weekEnd: anchorIso(weekEnd),
    defaultSlotRows: DEFAULT_SLOT_ROWS,
    maxSlotCount,
    days
  };
}

export async function setAdminScreeningVisibility(
  seq: number,
  hidden: boolean
): Promise<{ seq: number; hidden: boolean } | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("seq", sql.Int, seq)
    .input("divhidden", sql.TinyInt, hidden ? 1 : 0)
    .query<{ seq: number }>(`
      UPDATE dbo.prog_daily
      SET divhidden = @divhidden
      WHERE seq = @seq;

      SELECT seq FROM dbo.prog_daily WHERE seq = @seq;
    `);

  if (!result.recordset[0]) return null;
  return { seq, hidden };
}

export type ScheduleEntryFlags = {
  opening: boolean;
  closing: boolean;
  gv: boolean;
  ct: boolean;
};

const WEEKDAY_CHARS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function parseFlagsFromProgLabel(progLabel: string | null | undefined): ScheduleEntryFlags {
  const text = String(progLabel || "");
  return {
    opening: text.includes("개봉"),
    closing: text.includes("종영") || text.includes("중영"),
    gv: /\bGV\b/i.test(text) || text.includes("GV"),
    ct: /\bCT\b/i.test(text) || text.includes("CT")
  };
}

export function formatTimeLabel(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    const h = value.getHours();
    const m = value.getMinutes();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const raw = String(value).trim();
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }
  return raw;
}

export function toDateOnly(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    const year = new Date().getFullYear();
    return new Date(year, Number(slash[1]) - 1, Number(slash[2]));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function formatDayLabel(date: Date): { label: string; weekday: string } {
  const weekday = WEEKDAY_CHARS[date.getDay()] ?? "";
  const label = `${date.getMonth() + 1}/${date.getDate()}(${weekday})`;
  return { label, weekday };
}

/** 영화 상세 상영시간표 뱃지용 (예: 06.10.(수)) */
export function formatMovieDetailDateLabel(date: Date): string {
  const weekday = WEEKDAY_CHARS[date.getDay()] ?? "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}.${dd}.(${weekday})`;
}

export function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return stripTime(d);
}

/** 극장 주간: 목요일 ~ 수요일 (GNB week-schedule.js 와 동일) */
export function getCinemaWeekStart(date: Date): Date {
  const d = stripTime(date);
  const daysSinceThursday = (d.getDay() + 3) % 7;
  return addDays(d, -daysSinceThursday);
}

export function getCinemaWeekEnd(weekStart: Date): Date {
  return addDays(weekStart, 6);
}

/** 백엔드 기준 '오늘' (기본 Asia/Seoul) */
export function getServerToday(timezone = "Asia/Seoul"): Date {
  try {
    const iso = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    const [y, m, d] = iso.split("-").map((v) => Number(v));
    return new Date(y, m - 1, d);
  } catch {
    return stripTime(new Date());
  }
}

export function parseAnchorDate(anchor?: string, timezone = "Asia/Seoul"): Date {
  if (!anchor) return getServerToday(timezone);
  const trimmed = anchor.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const parsed = toDateOnly(trimmed);
  return parsed ? stripTime(parsed) : getServerToday(timezone);
}

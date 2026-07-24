import crypto from "node:crypto";
import { config } from "../config.js";
import { getAnalyticsDb, hashIp, hashUa } from "../db/analytics-db.js";
import { getMovieTitlesBySlugs } from "./movies.service.js";

const VISITOR_COOKIE = "ti_vid";
const ASSET_EXT =
  /\.(css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|webm|pdf|json|xml|txt)$/i;

export type PageviewInput = {
  path: string;
  pageKey?: string | null;
  visitorId: string;
  ip?: string | null;
  userAgent?: string | null;
};

export type DailySiteRow = { day: string; uv: number; pv: number };
export type DailyPageRow = { day: string; path: string; pageKey: string; pv: number };

export type AnalyticsSummary = {
  from: string;
  to: string;
  today: { day: string; uv: number; pv: number };
  totals: { uv: number; pv: number };
  days: DailySiteRow[];
};

function seoulDay(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isValidDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) + delta * 86400000;
  return seoulDay(new Date(utc));
}

export function newVisitorId(): string {
  return crypto.randomUUID();
}

export function visitorCookieName(): string {
  return VISITOR_COOKIE;
}

export function isPrivateOrLocalHost(host: string): boolean {
  const h = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

export function shouldSkipAnalyticsForHost(host: string): boolean {
  if (!config.analytics.enabled) return true;
  if (config.analytics.allowLocal) return false;
  return isPrivateOrLocalHost(host);
}

/** pathname(+optional search) → site-relative path without utm/tracking noise */
export function normalizeAnalyticsPath(rawPath: string): string | null {
  let raw = String(rawPath || "").trim();
  if (!raw) return null;

  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      raw = u.pathname + (u.search || "");
    }
  } catch {
    /* keep raw */
  }

  const qIdx = raw.indexOf("?");
  let pathname = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  pathname = pathname.replace(/\\/g, "/");
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  // strip site root prefix if present (e.g. /55cine/...)
  pathname = pathname.replace(/^\/+/, "/");

  const lower = pathname.toLowerCase();
  if (lower.startsWith("/admin/") || lower === "/admin" || lower.startsWith("/api/")) {
    return null;
  }
  if (ASSET_EXT.test(pathname)) return null;

  // drop leading slash for storage consistency with site paths
  let stored = pathname.replace(/^\//, "");
  if (!stored || stored === ".") stored = "index.html";
  if (stored.endsWith("/")) stored += "index.html";

  return stored.slice(0, 400);
}

export function normalizePageKey(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .slice(0, 200);
}

export function recordPageview(input: PageviewInput): { ok: true; counted: boolean } | { ok: false; reason: string } {
  if (!config.analytics.enabled) {
    return { ok: false, reason: "disabled" };
  }

  const pathNorm = normalizeAnalyticsPath(input.path);
  if (!pathNorm) {
    return { ok: false, reason: "ignored_path" };
  }

  const visitorId = String(input.visitorId || "").trim();
  if (!visitorId || visitorId.length > 80) {
    return { ok: false, reason: "invalid_visitor" };
  }

  const pageKey = normalizePageKey(input.pageKey);
  const day = seoulDay();
  const tsUtc = new Date().toISOString();
  const ipHash = hashIp(input.ip || "");
  const uaHash = hashUa(input.userAgent || "");

  const database = getAnalyticsDb();
  database.exec("BEGIN");
  try {
    database
      .prepare(
        `INSERT INTO page_events (ts_utc, day_seoul, visitor_id, path, page_key, ip_hash, ua_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(tsUtc, day, visitorId, pathNorm, pageKey, ipHash, uaHash);

    const vis = database
      .prepare(
        `INSERT OR IGNORE INTO daily_visitor (day_seoul, visitor_id) VALUES (?, ?)`
      )
      .run(day, visitorId);
    const isNewUv = Number(vis.changes || 0) > 0 ? 1 : 0;

    database
      .prepare(
        `INSERT INTO daily_site (day_seoul, uv, pv) VALUES (?, ?, 1)
         ON CONFLICT(day_seoul) DO UPDATE SET
           pv = pv + 1,
           uv = uv + excluded.uv`
      )
      .run(day, isNewUv);

    // Fix: ON CONFLICT excluded.uv is the inserted uv (0 or 1). Good.

    database
      .prepare(
        `INSERT INTO daily_page (day_seoul, path, page_key, pv) VALUES (?, ?, ?, 1)
         ON CONFLICT(day_seoul, path, page_key) DO UPDATE SET pv = pv + 1`
      )
      .run(day, pathNorm, pageKey);

    database.exec("COMMIT");
  } catch (err) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }

  return { ok: true, counted: true };
}

export function getAnalyticsSummary(fromDay?: string, toDay?: string): AnalyticsSummary {
  const today = seoulDay();
  const to = toDay && isValidDay(toDay) ? toDay : today;
  const from = fromDay && isValidDay(fromDay) ? fromDay : addDays(to, -13);

  const database = getAnalyticsDb();
  const days = database
    .prepare(
      `SELECT day_seoul AS day, uv, pv
       FROM daily_site
       WHERE day_seoul >= ? AND day_seoul <= ?
       ORDER BY day_seoul ASC`
    )
    .all(from, to) as DailySiteRow[];

  const todayRow = (database
    .prepare(`SELECT day_seoul AS day, uv, pv FROM daily_site WHERE day_seoul = ?`)
    .get(today) as DailySiteRow | undefined) || { day: today, uv: 0, pv: 0 };

  let uvSum = 0;
  let pvSum = 0;
  for (const row of days) {
    uvSum += Number(row.uv) || 0;
    pvSum += Number(row.pv) || 0;
  }

  return {
    from,
    to,
    today: {
      day: todayRow.day,
      uv: Number(todayRow.uv) || 0,
      pv: Number(todayRow.pv) || 0
    },
    totals: { uv: uvSum, pv: pvSum },
    days: days.map((d) => ({
      day: d.day,
      uv: Number(d.uv) || 0,
      pv: Number(d.pv) || 0
    }))
  };
}

function isMovieDetailPath(path: string): boolean {
  return /movie-detail\.html/i.test(path || "");
}

/** 영화 상세 pageKey(slug)를 한국어 제목으로 치환. 이미 제목이면 그대로 둔다. */
async function enrichMoviePageKeys(items: DailyPageRow[]): Promise<DailyPageRow[]> {
  const slugs = [
    ...new Set(
      items
        .filter((i) => isMovieDetailPath(i.path) && i.pageKey)
        .map((i) => i.pageKey)
    )
  ];
  if (!slugs.length) return items;

  let titleBySlug: Map<string, string>;
  try {
    titleBySlug = await getMovieTitlesBySlugs(slugs);
  } catch {
    return items;
  }
  if (!titleBySlug.size) return items;

  return items.map((item) => {
    if (!isMovieDetailPath(item.path) || !item.pageKey) return item;
    const title = titleBySlug.get(item.pageKey.trim().toLowerCase());
    return title ? { ...item, pageKey: title } : item;
  });
}

export async function getAnalyticsPages(opts: {
  day?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<DailyPageRow[]> {
  const today = seoulDay();
  const limit = Math.min(200, Math.max(1, Math.floor(opts.limit || 50)));
  const database = getAnalyticsDb();

  let items: DailyPageRow[];

  if (opts.day && isValidDay(opts.day)) {
    items = (
      database
        .prepare(
          `SELECT day_seoul AS day, path, page_key AS pageKey, pv
           FROM daily_page
           WHERE day_seoul = ?
           ORDER BY pv DESC, path ASC
           LIMIT ?`
        )
        .all(opts.day, limit) as DailyPageRow[]
    ).map((r) => ({
      day: r.day,
      path: r.path,
      pageKey: r.pageKey || "",
      pv: Number(r.pv) || 0
    }));
  } else {
    const to = opts.to && isValidDay(opts.to) ? opts.to : today;
    const from = opts.from && isValidDay(opts.from) ? opts.from : to;

    items = (
      database
        .prepare(
          `SELECT ? AS day, path, page_key AS pageKey, SUM(pv) AS pv
           FROM daily_page
           WHERE day_seoul >= ? AND day_seoul <= ?
           GROUP BY path, page_key
           ORDER BY pv DESC, path ASC
           LIMIT ?`
        )
        .all(`${from}~${to}`, from, to, limit) as DailyPageRow[]
    ).map((r) => ({
      day: r.day,
      path: r.path,
      pageKey: r.pageKey || "",
      pv: Number(r.pv) || 0
    }));
  }

  return enrichMoviePageKeys(items);
}

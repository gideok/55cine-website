import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { config } from "../config.js";

const require = createRequire(import.meta.url);

export type AnalyticsBackend = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
};

let backend: AnalyticsBackend | null = null;
let backendKind: "node-sqlite" | "json-store" = "json-store";

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const MIGRATE_SQL = `
CREATE TABLE IF NOT EXISTS page_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_utc TEXT NOT NULL,
  day_seoul TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  path TEXT NOT NULL,
  page_key TEXT NOT NULL DEFAULT '',
  ip_hash TEXT,
  ua_hash TEXT
);
CREATE INDEX IF NOT EXISTS ix_page_events_day ON page_events(day_seoul);
CREATE INDEX IF NOT EXISTS ix_page_events_day_path ON page_events(day_seoul, path);
CREATE TABLE IF NOT EXISTS daily_visitor (
  day_seoul TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  PRIMARY KEY (day_seoul, visitor_id)
);
CREATE TABLE IF NOT EXISTS daily_site (
  day_seoul TEXT PRIMARY KEY,
  uv INTEGER NOT NULL DEFAULT 0,
  pv INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS daily_page (
  day_seoul TEXT NOT NULL,
  path TEXT NOT NULL,
  page_key TEXT NOT NULL DEFAULT '',
  pv INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day_seoul, path, page_key)
);
`;

function tryNodeSqlite(filePath: string): AnalyticsBackend | null {
  try {
    // Node 22+ only. createRequire keeps Node 20 API bootable.
    const mod = require("node:sqlite") as {
      DatabaseSync: new (path: string) => {
        exec(sql: string): void;
        prepare(sql: string): {
          run(...params: unknown[]): { changes?: number };
          get(...params: unknown[]): unknown;
          all(...params: unknown[]): unknown[];
        };
        close(): void;
      };
    };
    const db = new mod.DatabaseSync(filePath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec(MIGRATE_SQL);
    backendKind = "node-sqlite";
    return {
      exec: (sql) => db.exec(sql),
      prepare: (sql) => {
        const stmt = db.prepare(sql);
        return {
          run: (...params) => {
            const r = stmt.run(...params);
            return { changes: Number(r?.changes || 0) };
          },
          get: (...params) => stmt.get(...params),
          all: (...params) => stmt.all(...params)
        };
      },
      close: () => db.close()
    };
  } catch {
    return null;
  }
}

type JsonStore = {
  page_events: Array<Record<string, unknown>>;
  daily_visitor: Array<{ day_seoul: string; visitor_id: string }>;
  daily_site: Array<{ day_seoul: string; uv: number; pv: number }>;
  daily_page: Array<{ day_seoul: string; path: string; page_key: string; pv: number }>;
  nextEventId: number;
};

function emptyStore(): JsonStore {
  return {
    page_events: [],
    daily_visitor: [],
    daily_site: [],
    daily_page: [],
    nextEventId: 1
  };
}

function jsonStorePath(sqlitePath: string): string {
  return sqlitePath.replace(/\.sqlite$/i, "") + ".json";
}

function createJsonBackend(filePath: string): AnalyticsBackend {
  const storeFile = jsonStorePath(filePath);
  ensureDir(storeFile);
  let store: JsonStore = emptyStore();
  if (fs.existsSync(storeFile)) {
    try {
      store = { ...emptyStore(), ...JSON.parse(fs.readFileSync(storeFile, "utf8")) };
    } catch {
      store = emptyStore();
    }
  }
  const persist = () => {
    fs.writeFileSync(storeFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  };

  backendKind = "json-store";
  return {
    exec(sql: string) {
      const s = sql.trim().toUpperCase();
      if (s === "BEGIN" || s.startsWith("BEGIN ")) return;
      if (s === "COMMIT" || s.startsWith("COMMIT")) {
        persist();
        return;
      }
      if (s === "ROLLBACK" || s.startsWith("ROLLBACK")) {
        // reload last persisted
        if (fs.existsSync(storeFile)) {
          try {
            store = { ...emptyStore(), ...JSON.parse(fs.readFileSync(storeFile, "utf8")) };
          } catch {
            /* keep */
          }
        }
      }
    },
    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, " ").trim();

      return {
        run: (...params: unknown[]) => {
          if (normalized.startsWith("INSERT INTO page_events")) {
            const [ts_utc, day_seoul, visitor_id, pathVal, page_key, ip_hash, ua_hash] = params;
            store.page_events.push({
              id: store.nextEventId++,
              ts_utc,
              day_seoul,
              visitor_id,
              path: pathVal,
              page_key,
              ip_hash,
              ua_hash
            });
            return { changes: 1 };
          }
          if (normalized.startsWith("INSERT OR IGNORE INTO daily_visitor")) {
            const [day_seoul, visitor_id] = params as string[];
            const exists = store.daily_visitor.some(
              (r) => r.day_seoul === day_seoul && r.visitor_id === visitor_id
            );
            if (exists) return { changes: 0 };
            store.daily_visitor.push({ day_seoul, visitor_id });
            return { changes: 1 };
          }
          if (normalized.startsWith("INSERT INTO daily_site")) {
            const [day_seoul, uv] = params as [string, number];
            const row = store.daily_site.find((r) => r.day_seoul === day_seoul);
            if (!row) {
              store.daily_site.push({ day_seoul, uv: Number(uv) || 0, pv: 1 });
            } else {
              row.pv += 1;
              row.uv += Number(uv) || 0;
            }
            return { changes: 1 };
          }
          if (normalized.startsWith("INSERT INTO daily_page")) {
            const [day_seoul, pathVal, page_key] = params as string[];
            const row = store.daily_page.find(
              (r) =>
                r.day_seoul === day_seoul && r.path === pathVal && r.page_key === page_key
            );
            if (!row) {
              store.daily_page.push({
                day_seoul,
                path: pathVal,
                page_key,
                pv: 1
              });
            } else {
              row.pv += 1;
            }
            return { changes: 1 };
          }
          return { changes: 0 };
        },
        get: (...params: unknown[]) => {
          if (normalized.includes("FROM daily_site WHERE day_seoul = ?")) {
            const day = String(params[0]);
            const row = store.daily_site.find((r) => r.day_seoul === day);
            return row
              ? { day: row.day_seoul, uv: row.uv, pv: row.pv }
              : undefined;
          }
          return undefined;
        },
        all: (...params: unknown[]) => {
          if (normalized.includes("FROM daily_site") && normalized.includes("day_seoul >=")) {
            const [from, to] = params as string[];
            return store.daily_site
              .filter((r) => r.day_seoul >= from && r.day_seoul <= to)
              .sort((a, b) => a.day_seoul.localeCompare(b.day_seoul))
              .map((r) => ({ day: r.day_seoul, uv: r.uv, pv: r.pv }));
          }
          if (normalized.includes("FROM daily_page") && normalized.includes("WHERE day_seoul = ?")) {
            const [day, limit] = params as [string, number];
            return store.daily_page
              .filter((r) => r.day_seoul === day)
              .sort((a, b) => b.pv - a.pv || a.path.localeCompare(b.path))
              .slice(0, Number(limit) || 50)
              .map((r) => ({
                day: r.day_seoul,
                path: r.path,
                pageKey: r.page_key,
                pv: r.pv
              }));
          }
          if (normalized.includes("FROM daily_page") && normalized.includes("GROUP BY")) {
            const [_label, from, to, limit] = params as [string, string, string, number];
            const map = new Map<string, { path: string; pageKey: string; pv: number }>();
            for (const r of store.daily_page) {
              if (r.day_seoul < from || r.day_seoul > to) continue;
              const key = `${r.path}\0${r.page_key}`;
              const cur = map.get(key);
              if (!cur) map.set(key, { path: r.path, pageKey: r.page_key, pv: r.pv });
              else cur.pv += r.pv;
            }
            return Array.from(map.values())
              .sort((a, b) => b.pv - a.pv || a.path.localeCompare(b.path))
              .slice(0, Number(limit) || 50)
              .map((r) => ({
                day: `${from}~${to}`,
                path: r.path,
                pageKey: r.pageKey,
                pv: r.pv
              }));
          }
          return [];
        }
      };
    },
    close() {
      persist();
    }
  };
}

export function getAnalyticsDb(): AnalyticsBackend {
  if (backend) return backend;
  const filePath = config.analytics.dbPath;
  ensureDir(filePath);
  backend = tryNodeSqlite(filePath) || createJsonBackend(filePath);
  return backend;
}

export function getAnalyticsBackendKind(): "node-sqlite" | "json-store" {
  if (!backend) getAnalyticsDb();
  return backendKind;
}

export function closeAnalyticsDb(): void {
  if (backend) {
    backend.close();
    backend = null;
  }
}

export function hashIp(ip: string): string | null {
  const secret = config.analytics.ipHashSecret;
  if (!secret) return null;
  const value = String(ip || "").trim() || "unknown";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function hashUa(ua: string): string | null {
  const secret = config.analytics.ipHashSecret;
  if (!secret) return null;
  const value = String(ua || "").trim().slice(0, 400);
  if (!value) return null;
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

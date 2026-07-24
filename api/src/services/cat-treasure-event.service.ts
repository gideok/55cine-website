import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export type CatTreasureWinnerRecord = {
  /** 클릭 시각 (Asia/Seoul, YYYY-MM-DD HH:MM:SS) */
  clickedAt: string;
  /** 당첨자 IP */
  ip: string;
};

export type CatTreasureEventConfig = {
  startAt: string;
  appearProbability: number;
  totalWinners: number;
  currentWinners: number;
  fadeMs: number;
  enabled: boolean;
  /** true면 같은 브라우저(localStorage) 재당첨 방지 */
  preventSameBrowserReWin: boolean;
  /** true면 페이지 새로고침 시 고양이 미출연 */
  blockOnPageRefresh: boolean;
  /** 당첨 기록 (클릭 시각·IP) */
  winners: CatTreasureWinnerRecord[];
};

export type CatTreasurePublicStatus = {
  active: boolean;
  startAt: string;
  appearProbability: number;
  totalWinners: number;
  currentWinners: number;
  remainingWinners: number;
  fadeMs: number;
  preventSameBrowserReWin: boolean;
  blockOnPageRefresh: boolean;
  reason?: string;
};

type StoredFile = Partial<CatTreasureEventConfig> & {
  notes?: unknown;
  winners?: unknown;
};

const CONFIG_REL = path.join("data", "cat-treasure-event.json");

let writeChain: Promise<unknown> = Promise.resolve();

function configPath(): string {
  return path.join(config.repoRoot, CONFIG_REL);
}

function parseStartAt(raw: string): Date | null {
  const s = String(raw || "").trim();
  // YYYY-MM-DD HH:MM → treat as Asia/Seoul wall time via fixed +09:00
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Asia/Seoul wall clock → YYYY-MM-DD HH:MM:SS */
function formatSeoulDateTime(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function normalizeWinners(raw: unknown): CatTreasureWinnerRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: CatTreasureWinnerRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const clickedAt = String(row.clickedAt || "").trim();
    const ip = String(row.ip || "").trim();
    if (!clickedAt && !ip) continue;
    out.push({ clickedAt, ip: ip || "unknown" });
  }
  return out;
}

function normalize(raw: StoredFile): CatTreasureEventConfig {
  const appearProbability = Number(raw.appearProbability);
  const totalWinners = Math.max(0, Math.floor(Number(raw.totalWinners) || 0));
  const currentWinners = Math.max(0, Math.floor(Number(raw.currentWinners) || 0));
  const fadeMs = Math.max(1000, Math.floor(Number(raw.fadeMs) || 5000));
  const winners = normalizeWinners(raw.winners);
  return {
    startAt: String(raw.startAt || "").trim(),
    appearProbability: Number.isFinite(appearProbability)
      ? Math.min(1, Math.max(0, appearProbability))
      : 0,
    totalWinners,
    currentWinners: Math.min(currentWinners, totalWinners || currentWinners),
    fadeMs,
    enabled: raw.enabled !== false,
    // 키 생략 시: 재당첨 방지 ON, 새로고침 차단 OFF
    preventSameBrowserReWin: raw.preventSameBrowserReWin !== false,
    blockOnPageRefresh: raw.blockOnPageRefresh === true,
    winners
  };
}

async function readStoredFile(): Promise<StoredFile> {
  const text = await fs.readFile(configPath(), "utf8");
  return JSON.parse(text) as StoredFile;
}

export async function readCatTreasureConfig(): Promise<CatTreasureEventConfig> {
  return normalize(await readStoredFile());
}

async function writeCatTreasureConfig(cfg: CatTreasureEventConfig, notes?: unknown): Promise<void> {
  const file = configPath();
  let preservedNotes = notes;
  if (preservedNotes === undefined) {
    try {
      const prev = await readStoredFile();
      preservedNotes = prev.notes;
    } catch {
      /* keep notes if readable */
    }
  }
  const payload: Record<string, unknown> = {
    startAt: cfg.startAt,
    appearProbability: cfg.appearProbability,
    totalWinners: cfg.totalWinners,
    currentWinners: cfg.currentWinners,
    fadeMs: cfg.fadeMs,
    enabled: cfg.enabled,
    preventSameBrowserReWin: cfg.preventSameBrowserReWin,
    blockOnPageRefresh: cfg.blockOnPageRefresh,
    winners: cfg.winners
  };
  if (preservedNotes !== undefined) {
    payload.notes = preservedNotes;
  }
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

export function buildPublicStatus(cfg: CatTreasureEventConfig, now = new Date()): CatTreasurePublicStatus {
  const start = parseStartAt(cfg.startAt);
  const remaining = Math.max(0, cfg.totalWinners - cfg.currentWinners);
  const base = {
    startAt: cfg.startAt,
    appearProbability: cfg.appearProbability,
    totalWinners: cfg.totalWinners,
    currentWinners: cfg.currentWinners,
    remainingWinners: remaining,
    fadeMs: cfg.fadeMs,
    preventSameBrowserReWin: cfg.preventSameBrowserReWin,
    blockOnPageRefresh: cfg.blockOnPageRefresh
  };

  if (!cfg.enabled) {
    return { ...base, active: false, reason: "disabled" };
  }
  if (!start) {
    return { ...base, active: false, reason: "invalid_startAt" };
  }
  if (now.getTime() < start.getTime()) {
    return { ...base, active: false, reason: "not_started" };
  }
  if (cfg.totalWinners <= 0 || remaining <= 0) {
    return { ...base, active: false, reason: "sold_out" };
  }
  return { ...base, active: true };
}

export async function getCatTreasureStatus(): Promise<CatTreasurePublicStatus> {
  const cfg = await readCatTreasureConfig();
  return buildPublicStatus(cfg);
}

/** 관리자 읽기 전용 — 설정 + winners 전체 */
export async function getCatTreasureAdminDetail(): Promise<{
  config: CatTreasureEventConfig;
  status: CatTreasurePublicStatus;
  notes: unknown;
}> {
  const stored = await readStoredFile();
  const cfg = normalize(stored);
  return {
    config: cfg,
    status: buildPublicStatus(cfg),
    notes: stored.notes ?? null
  };
}

export type ClaimResult =
  | {
      ok: true;
      currentWinners: number;
      totalWinners: number;
      remainingWinners: number;
      winner: CatTreasureWinnerRecord;
    }
  | { ok: false; code: string; message: string; currentWinners: number; totalWinners: number };

export function clientIpFromRequest(headers: Record<string, unknown>, fallbackIp?: string): string {
  const xff = headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && typeof xff[0] === "string" && xff[0].trim()) {
    return xff[0].split(",")[0].trim();
  }
  const realIp = headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  const ip = String(fallbackIp || "").trim();
  return ip || "unknown";
}

export async function claimCatTreasureWin(ip: string): Promise<ClaimResult> {
  const winnerIp = String(ip || "").trim() || "unknown";
  return new Promise((resolve, reject) => {
    writeChain = writeChain
      .then(async () => {
        const stored = await readStoredFile();
        const cfg = normalize(stored);
        const status = buildPublicStatus(cfg);
        if (!status.active) {
          resolve({
            ok: false,
            code: status.reason === "sold_out" ? "SOLD_OUT" : "INACTIVE",
            message:
              status.reason === "sold_out"
                ? "이벤트가 종료되었습니다. (당첨 마감)"
                : "이벤트가 진행 중이 아닙니다.",
            currentWinners: cfg.currentWinners,
            totalWinners: cfg.totalWinners
          });
          return;
        }

        const winner: CatTreasureWinnerRecord = {
          clickedAt: formatSeoulDateTime(new Date()),
          ip: winnerIp
        };
        cfg.currentWinners += 1;
        cfg.winners = cfg.winners.concat(winner);
        await writeCatTreasureConfig(cfg, stored.notes);
        const remaining = Math.max(0, cfg.totalWinners - cfg.currentWinners);
        resolve({
          ok: true,
          currentWinners: cfg.currentWinners,
          totalWinners: cfg.totalWinners,
          remainingWinners: remaining,
          winner
        });
      })
      .catch(reject);
  });
}

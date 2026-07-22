import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

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

function normalize(raw: Partial<CatTreasureEventConfig> & Record<string, unknown>): CatTreasureEventConfig {
  const appearProbability = Number(raw.appearProbability);
  const totalWinners = Math.max(0, Math.floor(Number(raw.totalWinners) || 0));
  const currentWinners = Math.max(0, Math.floor(Number(raw.currentWinners) || 0));
  const fadeMs = Math.max(1000, Math.floor(Number(raw.fadeMs) || 5000));
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
    blockOnPageRefresh: raw.blockOnPageRefresh === true
  };
}

export async function readCatTreasureConfig(): Promise<CatTreasureEventConfig> {
  const text = await fs.readFile(configPath(), "utf8");
  return normalize(JSON.parse(text) as Partial<CatTreasureEventConfig>);
}

async function writeCatTreasureConfig(cfg: CatTreasureEventConfig): Promise<void> {
  const file = configPath();
  let notes: unknown = undefined;
  try {
    const prev = JSON.parse(await fs.readFile(file, "utf8")) as { notes?: unknown };
    notes = prev.notes;
  } catch {
    /* keep notes if readable */
  }
  const payload = notes !== undefined ? { ...cfg, notes } : { ...cfg };
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

export type ClaimResult =
  | { ok: true; currentWinners: number; totalWinners: number; remainingWinners: number }
  | { ok: false; code: string; message: string; currentWinners: number; totalWinners: number };

export async function claimCatTreasureWin(): Promise<ClaimResult> {
  return new Promise((resolve, reject) => {
    writeChain = writeChain
      .then(async () => {
        const cfg = await readCatTreasureConfig();
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

        cfg.currentWinners += 1;
        await writeCatTreasureConfig(cfg);
        const remaining = Math.max(0, cfg.totalWinners - cfg.currentWinners);
        resolve({
          ok: true,
          currentWinners: cfg.currentWinners,
          totalWinners: cfg.totalWinners,
          remainingWinners: remaining
        });
      })
      .catch(reject);
  });
}

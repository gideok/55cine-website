/**
 * data/week-schedule-data.js 의 WEEK_SCHEDULE 배열을 API mock JSON 으로 추출
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const srcPath = path.join(root, "data", "week-schedule-data.js");
const outPath = path.join(root, "api", "fixtures", "week-schedule-mock.json");

const fixturePath = path.join(root, "api", "fixtures", "week-schedule-mock.json");
let src = fs.existsSync(srcPath) ? fs.readFileSync(srcPath, "utf8") : "";
const match = src.match(/window\.WEEK_SCHEDULE\s*=\s*(\[[\s\S]*?\n  \]);/);
if (!match) {
  if (fs.existsSync(fixturePath)) {
    console.log("정적 배열 없음 — 기존 fixture 유지:", fixturePath);
    process.exit(0);
  }
  console.error("WEEK_SCHEDULE 배열 또는 기존 fixture 가 없습니다.");
  process.exit(1);
}

function normalizeWeekScheduleEntry(entry) {
  entry = entry || {};
  return {
    time: entry.time != null ? String(entry.time) : "",
    title: entry.title || "",
    opening: Boolean(entry.opening),
    closing: Boolean(entry.closing),
    gv: Boolean(entry.gv),
    ct: Boolean(entry.ct)
  };
}
function normalizeEntries(entries) {
  return (entries || []).map(normalizeWeekScheduleEntry);
}

const sandbox = { normalizeEntries, normalizeWeekScheduleEntry };
vm.createContext(sandbox);
vm.runInContext(`var days = ${match[1]};`, sandbox);
const days = sandbox.days;

const moviesByTitle = {};
const posterBlock = src.match(/var nowPlayingByTitle\s*=\s*(\{[\s\S]*?\n  \});/);
if (posterBlock) {
  vm.runInContext(`var map = ${posterBlock[1]};`, sandbox);
  for (const [title, row] of Object.entries(sandbox.map)) {
    moviesByTitle[title] = {
      poster: row.poster || null,
      detailUrl: row.detailUrl || null,
      progId: null
    };
  }
}

const payload = {
  anchor: "2026-05-27",
  rangeStart: "2026-05-21",
  rangeEnd: "2026-06-10",
  days,
  moviesByTitle
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
console.log("Wrote", outPath);

/**
 * 기획전 films[].info 한 줄 파싱
 * 예: "Rei's Winter Break ,2025 | 극영화 | 73분 45초"
 * prog_base 참고: name2 → title_en, runningtime → running_minutes(분 단위 정수)
 */

/**
 * @param {string} raw
 * @returns {{ titleEn: string|null, info: string|null, runningTimeLabel: string|null, runningMinutes: number|null }}
 */
export function parseFilmInfoLine(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return { titleEn: null, info: null, runningTimeLabel: null, runningMinutes: null };
  }

  const parts = text.split("|").map((s) => s.trim());
  let titleEn = null;
  let info = null;
  let runningTimeLabel = null;

  if (parts[0]) {
    const first = parts[0];
    const yearMatch = first.match(/^(.+?)\s*,\s*(\d{4})\s*$/u);
    titleEn = yearMatch ? yearMatch[1].trim() : first;
  }

  if (parts.length >= 3) {
    info = parts[1] || null;
    runningTimeLabel = parts[2] || null;
  } else if (parts.length === 2) {
    const second = parts[1];
    if (/\d+\s*분/u.test(second)) {
      const split = second.match(/^(.+?)\s+(\d+\s*분[\d\s초]*)\s*$/u);
      if (split) {
        info = split[1].trim();
        runningTimeLabel = split[2].trim();
      } else {
        runningTimeLabel = second;
      }
    } else {
      info = second;
    }
  } else if (parts.length === 1 && /\d+\s*분/u.test(parts[0])) {
    runningTimeLabel = parts[0];
    titleEn = null;
  }

  return {
    titleEn,
    info,
    runningTimeLabel,
    runningMinutes: parseRunningMinutes(runningTimeLabel)
  };
}

/**
 * @param {string|null} label
 * @returns {number|null}
 */
export function parseRunningMinutes(label) {
  if (!label) return null;
  const m = String(label).match(/(\d+)\s*분/u);
  if (!m) return null;
  return Number(m[1]);
}

/** UI 표시용: 파싱된 필드를 기존 info 한 줄 형식으로 복원 */
export function formatFilmInfoLine(row) {
  if (!row) return "";
  const chunks = [];
  if (row.titleEn) chunks.push(row.titleEn);
  if (row.info) chunks.push(row.info);
  if (row.runningTimeLabel) chunks.push(row.runningTimeLabel);
  return chunks.join(" | ");
}

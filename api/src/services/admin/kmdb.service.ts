import { getProgBaseFormOptions, type ProgBaseFormOptions, type SysCodeItem } from "./prog-base-admin.service.js";
import { config } from "../../config.js";

const KMDB_SEARCH_URL =
  "http://api.koreafilm.or.kr/openapi-data2/wisenut/search_api/search_json2.jsp";

export type KmdbTitleSegment = {
  text: string;
  highlight: boolean;
};

export type KmdbMovieRaw = {
  docId: string;
  title: string;
  titleSegments: KmdbTitleSegment[];
  titleEn: string | null;
  titleOrg: string | null;
  prodYear: string | null;
  director: string | null;
  actors: string | null;
  genre: string | null;
  nation: string | null;
  company: string | null;
  runtime: number | null;
  rating: string | null;
  synopsis: string | null;
  posterUrl: string | null;
  kmdbUrl: string | null;
};

export type KmdbMappedProgram = {
  docId: string;
  name: string;
  name2: string;
  runningTime: number | null;
  producer: string | null;
  dateOpen: string | null;
  director: string | null;
  castNames: string | null;
  synopsis: string | null;
  info: string | null;
  gradeSeq: number | null;
  countrySeq: number | null;
  posterUrl: string | null;
  progUrl: string | null;
  /** 선택 팝업 표시용 */
  title: string;
  titleSegments: KmdbTitleSegment[];
  titleEn: string | null;
  prodYear: string | null;
  directorLabel: string | null;
  genre: string | null;
  rating: string | null;
  nation: string | null;
};

function asArray<T>(val: T | T[] | null | undefined): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function textVal(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s || null;
}

function normalizeKmdbQuery(title: string): string {
  return String(title || "").trim().replace(/\s+/g, " ");
}

/** API title 파라미터용 — 공백 제거 버전 */
function normalizeKmdbQueryCompact(title: string): string {
  return normalizeKmdbQuery(title).replace(/\s+/g, "");
}

function normalizeTitleKey(text: string): string {
  return normalizeKmdbTitleText(text).replace(/\s+/g, "").toLowerCase();
}

/** 검색어와 제목 일치도 (높을수록 상위) */
export function scoreKmdbTitleMatch(
  query: string,
  title: string,
  titleEn?: string | null,
  titleOrg?: string | null
): number {
  const q = normalizeTitleKey(query);
  if (!q) return 0;

  const candidates = [title, titleEn, titleOrg]
    .filter((v): v is string => !!v)
    .map((v) => normalizeTitleKey(v));

  let best = 0;
  for (const t of candidates) {
    if (!t) continue;
    if (t === q) {
      best = Math.max(best, 1000);
      continue;
    }
    if (t.startsWith(q)) {
      best = Math.max(best, 800 + Math.round((q.length / t.length) * 50));
      continue;
    }
    if (t.includes(q)) {
      best = Math.max(best, 600 + Math.round((q.length / t.length) * 100));
      continue;
    }
    const qWords = normalizeKmdbQuery(query)
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => normalizeTitleKey(w));
    if (qWords.length > 1 && qWords.every((w) => t.includes(w))) {
      best = Math.max(best, 350);
    }
  }
  return best;
}

type KmdbMovieRawScored = KmdbMovieRaw & { _matchScore: number };

function pickPoster(posters?: string | null): string | null {
  if (!posters) return null;
  const first = posters
    .split("|")
    .map((s) => s.trim())
    .find(Boolean);
  return first || null;
}

function pickKoreanPlot(plots: unknown): string | null {
  if (!plots || typeof plots !== "object") return null;
  const plotNode = (plots as { plot?: unknown }).plot;
  const items = asArray(plotNode as Record<string, unknown> | Record<string, unknown>[]);
  for (const item of items) {
    const lang = textVal(item.plotLang);
    const text = textVal(item.plotText);
    if (!text) continue;
    if (lang && /한국|ko/i.test(lang)) return text;
  }
  const first = items.find((item) => textVal(item.plotText));
  return first ? textVal(first.plotText) : null;
}

function joinNames(items: Record<string, unknown>[], key: string): string | null {
  const names = items
    .map((item) => textVal(item[key]))
    .filter((n): n is string => !!n);
  if (!names.length) return null;
  return names.join(", ");
}

function parseRuntime(raw: unknown): number | null {
  const s = textVal(raw);
  if (!s) return null;
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeKmdbTitleText(text: string): string {
  return String(text || "")
    .replace(/!HS/g, "")
    .replace(/!HE/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pushTitleSegment(segments: KmdbTitleSegment[], raw: string, highlight: boolean): void {
  const text = normalizeKmdbTitleText(raw);
  if (!text) return;
  const last = segments[segments.length - 1];
  if (last && last.highlight === highlight) {
    last.text = `${last.text} ${text}`;
    return;
  }
  segments.push({ text, highlight });
}

/** KMDB 검색 API의 !HS / !HE 하이라이트 마커 파싱 */
export function parseKmdbTitle(raw: string): { title: string; titleSegments: KmdbTitleSegment[] } {
  const src = String(raw || "");
  const segments: KmdbTitleSegment[] = [];
  const markerRe = /!HS\s*([\s\S]*?)\s*!HE/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasMarkers = false;

  while ((match = markerRe.exec(src)) !== null) {
    hasMarkers = true;
    pushTitleSegment(segments, src.slice(lastIndex, match.index), false);
    pushTitleSegment(segments, match[1], true);
    lastIndex = match.index + match[0].length;
  }

  if (hasMarkers) {
    pushTitleSegment(segments, src.slice(lastIndex), false);
    const title = segments
      .map((seg) => seg.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return { title, titleSegments: segments };
  }

  const title = normalizeKmdbTitleText(src);
  return {
    title,
    titleSegments: title ? [{ text: title, highlight: false }] : []
  };
}

function parseKmdbResult(row: Record<string, unknown>): KmdbMovieRaw {
  const directors = joinNames(
    asArray((row.directors as { director?: unknown })?.director) as Record<string, unknown>[],
    "directorNm"
  );
  const actors = joinNames(
    asArray((row.actors as { actor?: unknown })?.actor) as Record<string, unknown>[],
    "actorNm"
  );
  const rawTitle = textVal(row.title) || textVal(row.titleOrg) || "";
  const { title, titleSegments } = parseKmdbTitle(rawTitle);
  return {
    docId: textVal(row.DOCID) || textVal(row.movieId) || title,
    title,
    titleSegments,
    titleEn: textVal(row.titleEng),
    titleOrg: textVal(row.titleOrg),
    prodYear: textVal(row.prodYear),
    director: directors,
    actors,
    genre: textVal(row.genre),
    nation: textVal(row.nation),
    company: textVal(row.company),
    runtime: parseRuntime(row.runtime),
    rating: textVal(row.rating),
    synopsis: pickKoreanPlot(row.plots),
    posterUrl: pickPoster(textVal(row.posters)),
    kmdbUrl: textVal(row.kmdbUrl) || textVal(row.detailUrl)
  };
}

function extractResults(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { Data?: unknown }).Data;
  const blocks = asArray(data) as Record<string, unknown>[];
  const out: Record<string, unknown>[] = [];
  for (const block of blocks) {
    const results = asArray(block.Result) as Record<string, unknown>[];
    out.push(...results);
  }
  return out;
}

function rankKmdbResults(query: string, rows: KmdbMovieRaw[]): KmdbMovieRaw[] {
  const scored: KmdbMovieRawScored[] = rows.map((row) => ({
    ...row,
    _matchScore: scoreKmdbTitleMatch(query, row.title, row.titleEn, row.titleOrg)
  }));

  scored.sort((a, b) => {
    if (b._matchScore !== a._matchScore) return b._matchScore - a._matchScore;
    const yearA = Number(a.prodYear) || 0;
    const yearB = Number(b.prodYear) || 0;
    return yearB - yearA;
  });

  const hasPositive = scored.some((row) => row._matchScore > 0);
  const filtered = hasPositive ? scored.filter((row) => row._matchScore > 0) : scored;

  return filtered.map(({ _matchScore: _s, ...row }) => row);
}

async function fetchKmdbRows(searchParam: "title" | "query", value: string, listCount: number): Promise<KmdbMovieRaw[]> {
  const key = config.kmdbServiceKey?.trim();
  if (!key) {
    throw new Error(
      "KMDB API 인증키가 설정되지 않았습니다. .env에 KMDB_SERVICE_KEY(또는 KMDB_API_KEY)를 등록하세요."
    );
  }

  const url = new URL(KMDB_SEARCH_URL);
  url.searchParams.set("collection", "kmdb_new2");
  url.searchParams.set("ServiceKey", key);
  url.searchParams.set("detail", "Y");
  url.searchParams.set(searchParam, value);
  url.searchParams.set("listCount", String(Math.max(3, Math.min(listCount, 50))));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`KMDB 검색 요청 실패 (${res.status})`);
  }

  const payload = (await res.json()) as unknown;
  return extractResults(payload).map(parseKmdbResult).filter((row) => row.title);
}

export async function searchKmdbMovies(title: string, listCount = 20): Promise<KmdbMovieRaw[]> {
  const query = normalizeKmdbQuery(title);
  if (!query) throw new Error("검색할 영화명을 입력해 주세요.");

  // title: 영화명 상세검색 — query(통합검색)보다 정확. 공백 유·무 모두 시도.
  let rows = await fetchKmdbRows("title", query, listCount);
  if (!rows.length) {
    rows = await fetchKmdbRows("title", normalizeKmdbQueryCompact(query), listCount);
  }

  // title 검색 결과가 없을 때만 통합검색 fallback
  if (!rows.length) {
    rows = await fetchKmdbRows("query", normalizeKmdbQueryCompact(query), listCount);
  }

  return rankKmdbResults(query, rows);
}

function dateFromProdYear(year: string | null): string | null {
  if (!year) return null;
  const y = year.trim();
  if (!/^\d{4}$/.test(y)) return null;
  return `${y}-01-01`;
}

function mapGradeSeq(rating: string | null, grades: SysCodeItem[]): number | null {
  if (!rating) return null;
  const r = rating.replace(/\s/g, "");
  const rules: Array<{ test: RegExp; keys: string[] }> = [
    { test: /전체/, keys: ["전체", "ALL"] },
    { test: /12/, keys: ["12"] },
    { test: /15/, keys: ["15"] },
    { test: /청소년|18|19/, keys: ["청소년", "18", "19"] }
  ];
  for (const rule of rules) {
    if (!rule.test.test(r)) continue;
    const found = grades.find((g) => rule.keys.some((k) => g.name.includes(k)));
    if (found) return found.seqCode;
  }
  return null;
}

function mapCountrySeq(nation: string | null, countries: SysCodeItem[]): number | null {
  if (!nation) return null;
  const parts = nation
    .split(/[,/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    const found = countries.find(
      (c) => c.name === part || part.includes(c.name) || c.name.includes(part)
    );
    if (found) return found.seqCode;
  }
  return null;
}

function buildInfo(item: KmdbMovieRaw): string | null {
  const bits = [item.genre, item.nation, item.rating].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

export function mapKmdbMovieToProgram(
  item: KmdbMovieRaw,
  options: ProgBaseFormOptions
): KmdbMappedProgram {
  const name = item.title;
  const name2 = item.titleEn || item.titleOrg || item.title;
  return {
    docId: item.docId,
    name,
    name2,
    runningTime: item.runtime,
    producer: item.company,
    dateOpen: dateFromProdYear(item.prodYear),
    director: item.director,
    castNames: item.actors,
    synopsis: item.synopsis,
    info: buildInfo(item),
    gradeSeq: mapGradeSeq(item.rating, options.grade),
    countrySeq: mapCountrySeq(item.nation, options.country),
    posterUrl: item.posterUrl,
    progUrl: item.kmdbUrl,
    title: name,
    titleSegments: item.titleSegments,
    titleEn: item.titleEn,
    prodYear: item.prodYear,
    directorLabel: item.director,
    genre: item.genre,
    rating: item.rating,
    nation: item.nation
  };
}

export async function searchKmdbMoviesMapped(
  title: string,
  listCount = 20
): Promise<KmdbMappedProgram[]> {
  const [rows, options] = await Promise.all([
    searchKmdbMovies(title, listCount),
    getProgBaseFormOptions()
  ]);
  return rows.map((row) => mapKmdbMovieToProgram(row, options));
}

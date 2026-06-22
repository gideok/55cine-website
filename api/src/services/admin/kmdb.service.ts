import { getProgBaseFormOptions, type ProgBaseFormOptions, type SysCodeItem } from "./prog-base-admin.service.js";
import { config } from "../../config.js";

const KMDB_SEARCH_URL =
  "http://api.koreafilm.or.kr/openapi-data2/wisenut/search_api/search_json2.jsp";

export type KmdbMovieRaw = {
  docId: string;
  title: string;
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
  return String(title || "").trim().replace(/\s+/g, "");
}

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

function parseKmdbResult(row: Record<string, unknown>): KmdbMovieRaw {
  const directors = joinNames(
    asArray((row.directors as { director?: unknown })?.director) as Record<string, unknown>[],
    "directorNm"
  );
  const actors = joinNames(
    asArray((row.actors as { actor?: unknown })?.actor) as Record<string, unknown>[],
    "actorNm"
  );
  const title = textVal(row.title) || textVal(row.titleOrg) || "";
  return {
    docId: textVal(row.DOCID) || textVal(row.movieId) || title,
    title,
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

export async function searchKmdbMovies(title: string, listCount = 20): Promise<KmdbMovieRaw[]> {
  const key = config.kmdbServiceKey?.trim();
  if (!key) {
    throw new Error("KMDB API 인증키(KMDB_SERVICE_KEY)가 설정되지 않았습니다.");
  }
  const query = normalizeKmdbQuery(title);
  if (!query) throw new Error("검색할 영화명을 입력해 주세요.");

  const url = new URL(KMDB_SEARCH_URL);
  url.searchParams.set("collection", "kmdb_new2");
  url.searchParams.set("ServiceKey", key);
  url.searchParams.set("detail", "Y");
  url.searchParams.set("query", query);
  url.searchParams.set("listCount", String(Math.max(3, Math.min(listCount, 50))));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`KMDB 검색 요청 실패 (${res.status})`);
  }

  const payload = (await res.json()) as unknown;
  const rows = extractResults(payload).map(parseKmdbResult).filter((row) => row.title);
  return rows;
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

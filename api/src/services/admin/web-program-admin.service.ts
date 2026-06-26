import sql from "mssql";
import { getPool } from "../../db/pool.js";

export type AdminProgramListItem = {
  seq: number | null;
  progId: number;
  /** web_program 행 존재 여부 */
  hasWebProgram: boolean;
  /** slug·img_thumb·synopsis 모두 입력 완료 */
  webReady: boolean;
  slug: string;
  titleKo: string;
  titleEn: string;
  dateOpen: string | null;
  dateClose: string | null;
  imgThumb: string | null;
  img1: string | null;
};

export type AdminProgramDetail = AdminProgramListItem & {
  detailUrl: string | null;
  img2: string | null;
  img3: string | null;
  img4: string | null;
  img5: string | null;
  director: string | null;
  castNames: string | null;
  info: string | null;
  synopsis: string | null;
  trailerUrl: string | null;
  grade: number | null;
  runningTime: number | null;
  divScreen: number | null;
  divProg: number | null;
  country: number | null;
  producer: string | null;
  distributor: string | null;
  specVideo: number | null;
  specAudio: number | null;
  specFormat: number | null;
  volumn: string | null;
  divState: number | null;
  progUrl: string | null;
  totSc: number | null;
};

type ProgramRow = {
  seq: number | null;
  prog_id: number;
  slug: string | null;
  detail_url: string | null;
  img_thumb: string | null;
  img1: string | null;
  img2: string | null;
  img3: string | null;
  img4: string | null;
  img5: string | null;
  director: string | null;
  cast_names: string | null;
  info: string | null;
  synopsis: string | null;
  trailer_url: string | null;
  name: string | null;
  name2: string | null;
  date_open: unknown;
  date_close: unknown;
  grade: number | null;
  runningtime: number | null;
  div_screen: number | null;
  div_prog: number | null;
  country: number | null;
  producer: string | null;
  distributor: string | null;
  spec_video: number | null;
  spec_audio: number | null;
  spec_format: number | null;
  volumn: string | null;
  div_state: number | null;
  prog_url: string | null;
  tot_sc: number | null;
};

function formatDate(val: unknown): string | null {
  if (val == null || val === "") return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10) || null;
  return formatDate(d);
}

/** 레거시 DB: 문자열·숫자 혼재 컬럼 안전 변환 */
function trimText(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s || null;
}

function toCode(val: unknown): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/** WEB RDY: web_program 존재 + slug·img_thumb·synopsis 모두 비어 있지 않음 */
function isWebReady(row: ProgramRow): boolean {
  const hasRow = row.seq != null && Number(row.seq) > 0;
  if (!hasRow) return false;
  return !!(trimText(row.slug) && trimText(row.img_thumb) && trimText(row.synopsis));
}

function mapListItem(row: ProgramRow): AdminProgramListItem {
  const seq = row.seq != null ? Number(row.seq) : null;
  const hasWebProgram = seq != null && seq > 0;
  return {
    seq,
    progId: row.prog_id,
    hasWebProgram,
    webReady: isWebReady(row),
    slug: trimText(row.slug) || "",
    titleKo: trimText(row.name) || "",
    titleEn: trimText(row.name2) || "",
    dateOpen: formatDate(row.date_open),
    dateClose: formatDate(row.date_close),
    imgThumb: trimText(row.img_thumb),
    img1: trimText(row.img1)
  };
}

function mapDetail(row: ProgramRow): AdminProgramDetail {
  return {
    ...mapListItem(row),
    detailUrl: trimText(row.detail_url),
    img2: trimText(row.img2),
    img3: trimText(row.img3),
    img4: trimText(row.img4),
    img5: trimText(row.img5),
    director: trimText(row.director),
    castNames: trimText(row.cast_names),
    info: trimText(row.info),
    synopsis: trimText(row.synopsis),
    trailerUrl: trimText(row.trailer_url),
    grade: toCode(row.grade),
    runningTime: toCode(row.runningtime),
    divScreen: toCode(row.div_screen),
    divProg: toCode(row.div_prog),
    country: toCode(row.country),
    producer: trimText(row.producer),
    distributor: trimText(row.distributor),
    specVideo: toCode(row.spec_video),
    specAudio: toCode(row.spec_audio),
    specFormat: toCode(row.spec_format),
    volumn: trimText(row.volumn),
    divState: toCode(row.div_state),
    progUrl: trimText(row.prog_url),
    totSc: toCode(row.tot_sc)
  };
}

/** prog_base(데스크톱 등록) 기준 — web_program 없으면 LEFT JOIN null */
const PROGRAM_FROM = `
  FROM dbo.prog_base pb
  LEFT JOIN dbo.web_program wp ON wp.prog_id = pb.prog_id
`;

const PROGRAM_SELECT = `
  wp.seq, pb.prog_id, wp.slug, wp.detail_url,
  wp.img_thumb, wp.img1, wp.img2, wp.img3, wp.img4, wp.img5,
  wp.director, wp.cast_names, wp.info, wp.synopsis, wp.trailer_url,
  pb.name, pb.name2, pb.date_open, pb.date_close, pb.grade, pb.runningtime,
  pb.div_screen, pb.div_prog, pb.country, pb.producer, pb.distributor,
  pb.spec_video, pb.spec_audio, pb.spec_format, pb.volumn, pb.div_state, pb.prog_url, pb.tot_sc
`;

function buildSearchWhere(q: string): string {
  if (!q) return "1=1";
  return `(
    pb.name LIKE @q OR pb.name2 LIKE @q OR ISNULL(wp.slug, '') LIKE @q
    OR CAST(pb.prog_id AS NVARCHAR(20)) LIKE @q
  )`;
}

function buildListWhere(q: string, desktopOnly: boolean): string {
  const parts: string[] = [buildSearchWhere(q)];
  if (desktopOnly) {
    parts.push("wp.seq IS NULL");
  }
  return parts.join(" AND ");
}

export async function getAdminProgramList(opts: {
  q?: string;
  page: number;
  pageSize: number;
  desktopOnly?: boolean;
}): Promise<{
  items: AdminProgramListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}> {
  const pool = await getPool();
  const page = Math.max(1, opts.page);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize));
  const offset = (page - 1) * pageSize;
  const q = opts.q?.trim() || "";
  const desktopOnly = !!opts.desktopOnly;
  const where = buildListWhere(q, desktopOnly);

  const countReq = pool.request();
  if (q) countReq.input("q", sql.NVarChar, `%${q}%`);
  const countRes = await countReq.query<{ total: number }>(`
    SELECT COUNT(*) AS total ${PROGRAM_FROM} WHERE ${where}
  `);
  const total = countRes.recordset[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const listReq = pool.request();
  if (q) listReq.input("q", sql.NVarChar, `%${q}%`);
  listReq.input("offset", sql.Int, offset);
  listReq.input("pageSize", sql.Int, pageSize);

  const listRes = await listReq.query<ProgramRow>(`
    SELECT ${PROGRAM_SELECT}
    ${PROGRAM_FROM}
    WHERE ${where}
    ORDER BY
      TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open))) DESC,
      pb.prog_id DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return {
    items: listRes.recordset.map(mapListItem),
    page,
    pageSize,
    total,
    totalPages
  };
}

async function fetchProgramRowBySeq(seq: number): Promise<ProgramRow | null> {
  const pool = await getPool();
  const res = await pool.request().input("seq", sql.Int, seq).query<ProgramRow>(`
    SELECT ${PROGRAM_SELECT}
    ${PROGRAM_FROM}
    WHERE wp.seq = @seq
  `);
  return res.recordset[0] ?? null;
}

async function fetchProgramRowByProgId(progId: number): Promise<ProgramRow | null> {
  const pool = await getPool();
  const res = await pool.request().input("progId", sql.Int, progId).query<ProgramRow>(`
    SELECT ${PROGRAM_SELECT}
    ${PROGRAM_FROM}
    WHERE pb.prog_id = @progId
  `);
  return res.recordset[0] ?? null;
}

export async function getAdminProgramBySeq(seq: number): Promise<AdminProgramDetail | null> {
  const row = await fetchProgramRowBySeq(seq);
  return row ? mapDetail(row) : null;
}

export async function getAdminProgramByProgId(progId: number): Promise<AdminProgramDetail | null> {
  const row = await fetchProgramRowByProgId(progId);
  return row ? mapDetail(row) : null;
}

export type UpdateProgramInput = {
  slug?: string | null;
  detailUrl?: string | null;
  imgThumb?: string | null;
  img1?: string | null;
  img2?: string | null;
  img3?: string | null;
  img4?: string | null;
  img5?: string | null;
  director?: string | null;
  castNames?: string | null;
  info?: string | null;
  synopsis?: string | null;
  trailerUrl?: string | null;
};

export type SlugConflict = {
  seq: number;
  progId: number;
  titleKo: string;
  slug: string;
};

export async function findProgramSlugConflict(
  slug: string,
  excludeSeq?: number | null
): Promise<SlugConflict | null> {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized) return null;

  const pool = await getPool();
  const req = pool.request().input("slug", sql.NVarChar(200), normalized);
  let excludeClause = "";
  if (excludeSeq != null && excludeSeq > 0) {
    req.input("excludeSeq", sql.Int, excludeSeq);
    excludeClause = " AND wp.seq <> @excludeSeq";
  }

  const result = await req.query<{ seq: number; prog_id: number; name: string; slug: string }>(`
    SELECT TOP 1 wp.seq, pb.prog_id, pb.name, wp.slug
    FROM dbo.web_program wp
    INNER JOIN dbo.prog_base pb ON pb.prog_id = wp.prog_id
    WHERE LOWER(LTRIM(RTRIM(wp.slug))) = @slug
      ${excludeClause}
  `);

  const row = result.recordset[0];
  if (!row) return null;

  return {
    seq: Number(row.seq),
    progId: Number(row.prog_id),
    titleKo: String(row.name || "").trim(),
    slug: String(row.slug || "").trim()
  };
}

export async function checkAdminProgramDuplicateSlug(
  slug: string,
  excludeSeq?: number
): Promise<{ duplicate: boolean; conflict?: SlugConflict }> {
  const conflict = await findProgramSlugConflict(slug, excludeSeq);
  return conflict ? { duplicate: true, conflict } : { duplicate: false };
}

async function assertSlugNotDuplicate(
  slug: string | null | undefined,
  excludeSeq?: number | null
): Promise<void> {
  const trimmed = String(slug ?? "").trim();
  if (!trimmed) return;
  const conflict = await findProgramSlugConflict(trimmed, excludeSeq);
  if (!conflict) return;
  const err = new Error(
    `slug "${trimmed}"는 이미 등록된 상영작("${conflict.titleKo}", seq ${conflict.seq})과 중복됩니다.\nslug를 수정한 뒤 다시 저장해 주세요.`
  );
  (err as Error & { code: string }).code = "DUPLICATE_SLUG";
  throw err;
}

async function applyWebProgramUpdate(
  seq: number,
  input: UpdateProgramInput
): Promise<AdminProgramDetail | null> {
  if (input.slug !== undefined) {
    await assertSlugNotDuplicate(input.slug, seq);
  }

  const pool = await getPool();
  const req = pool.request().input("seq", sql.Int, seq);

  const fields: string[] = [];
  const set = (col: string, param: string, val: string | null | undefined) => {
    if (val === undefined) return;
    fields.push(`${col} = @${param}`);
    req.input(param, sql.NVarChar(sql.MAX), val);
  };

  set("slug", "slug", input.slug ?? null);
  set("detail_url", "detailUrl", input.detailUrl ?? null);
  set("img_thumb", "imgThumb", input.imgThumb ?? null);
  set("img1", "img1", input.img1 ?? null);
  set("img2", "img2", input.img2 ?? null);
  set("img3", "img3", input.img3 ?? null);
  set("img4", "img4", input.img4 ?? null);
  set("img5", "img5", input.img5 ?? null);
  set("director", "director", input.director ?? null);
  set("cast_names", "castNames", input.castNames ?? null);
  set("info", "info", input.info ?? null);
  set("synopsis", "synopsis", input.synopsis ?? null);
  set("trailer_url", "trailerUrl", input.trailerUrl ?? null);

  if (fields.length) {
    await req.query(`UPDATE dbo.web_program SET ${fields.join(", ")} WHERE seq = @seq`);
  }
  return getAdminProgramBySeq(seq);
}

export async function updateAdminProgram(
  seq: number,
  input: UpdateProgramInput
): Promise<AdminProgramDetail | null> {
  return applyWebProgramUpdate(seq, input);
}

/** 데스크톱 prog_base 만 있는 상영작 — web_program 생성 후 추가정보 저장 */
export async function upsertAdminProgramByProgId(
  progId: number,
  input: UpdateProgramInput
): Promise<AdminProgramDetail | null> {
  const pool = await getPool();
  const existing = await fetchProgramRowByProgId(progId);
  if (!existing) return null;

  if (existing.seq != null && existing.seq > 0) {
    return applyWebProgramUpdate(existing.seq, input);
  }

  const slug =
    input.slug !== undefined && input.slug !== null
      ? String(input.slug).trim() || null
      : null;

  await assertSlugNotDuplicate(slug, null);

  const insert = await pool
    .request()
    .input("progId", sql.Int, progId)
    .input("slug", sql.NVarChar, slug)
    .query<{ seq: number }>(`
      INSERT INTO dbo.web_program (prog_id, slug, detail_url, img_thumb, img1, img2, img3, img4, img5)
      OUTPUT INSERTED.seq
      VALUES (@progId, @slug, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
    `);

  const seq = insert.recordset[0]?.seq;
  if (!seq) return null;

  return applyWebProgramUpdate(seq, input);
}

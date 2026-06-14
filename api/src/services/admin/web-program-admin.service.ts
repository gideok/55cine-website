import sql from "mssql";
import { getPool } from "../../db/pool.js";

export type AdminProgramListItem = {
  seq: number | null;
  progId: number;
  hasWebProgram: boolean;
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
};

function formatDate(val: unknown): string | null {
  if (val == null || val === "") return null;
  const d = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(d.getTime())) return String(val).trim() || null;
  return d.toISOString().slice(0, 10);
}

function mapListItem(row: ProgramRow): AdminProgramListItem {
  const seq = row.seq != null ? Number(row.seq) : null;
  return {
    seq,
    progId: row.prog_id,
    hasWebProgram: seq != null && seq > 0,
    slug: String(row.slug || "").trim(),
    titleKo: String(row.name || "").trim(),
    titleEn: String(row.name2 || "").trim(),
    dateOpen: formatDate(row.date_open),
    dateClose: formatDate(row.date_close),
    imgThumb: row.img_thumb?.trim() || null,
    img1: row.img1?.trim() || null
  };
}

function mapDetail(row: ProgramRow): AdminProgramDetail {
  return {
    ...mapListItem(row),
    detailUrl: row.detail_url?.trim() || null,
    img2: row.img2?.trim() || null,
    img3: row.img3?.trim() || null,
    img4: row.img4?.trim() || null,
    img5: row.img5?.trim() || null,
    director: row.director?.trim() || null,
    castNames: row.cast_names?.trim() || null,
    info: row.info?.trim() || null,
    synopsis: row.synopsis?.trim() || null,
    trailerUrl: row.trailer_url?.trim() || null,
    grade: row.grade ?? null,
    runningTime: row.runningtime ?? null
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
  pb.name, pb.name2, pb.date_open, pb.date_close, pb.grade, pb.runningtime
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

async function applyWebProgramUpdate(
  seq: number,
  input: UpdateProgramInput
): Promise<AdminProgramDetail | null> {
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

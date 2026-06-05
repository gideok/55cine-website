import sql from "mssql";
import { getPool } from "../../db/pool.js";

export type AdminProgramListItem = {
  seq: number;
  progId: number;
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
  seq: number;
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
  return {
    seq: row.seq,
    progId: row.prog_id,
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

const PROGRAM_JOIN = `
  FROM dbo.web_program wp
  INNER JOIN dbo.prog_base pb ON pb.prog_id = wp.prog_id
`;

const PROGRAM_SELECT = `
  wp.seq, wp.prog_id, wp.slug, wp.detail_url,
  wp.img_thumb, wp.img1, wp.img2, wp.img3, wp.img4, wp.img5,
  wp.director, wp.cast_names, wp.info, wp.synopsis, wp.trailer_url,
  pb.name, pb.name2, pb.date_open, pb.date_close, pb.grade, pb.runningtime
`;

export async function getAdminProgramList(opts: {
  q?: string;
  page: number;
  pageSize: number;
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

  let where = "1=1";
  if (q) {
    where = `(
      pb.name LIKE @q OR pb.name2 LIKE @q OR wp.slug LIKE @q
      OR CAST(wp.prog_id AS NVARCHAR(20)) LIKE @q
    )`;
  }

  const countReq = pool.request();
  if (q) countReq.input("q", sql.NVarChar, `%${q}%`);
  const countRes = await countReq.query<{ total: number }>(`
    SELECT COUNT(*) AS total ${PROGRAM_JOIN} WHERE ${where}
  `);
  const total = countRes.recordset[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const listReq = pool.request();
  if (q) listReq.input("q", sql.NVarChar, `%${q}%`);
  listReq.input("offset", sql.Int, offset);
  listReq.input("pageSize", sql.Int, pageSize);

  const listRes = await listReq.query<ProgramRow>(`
    SELECT ${PROGRAM_SELECT}
    ${PROGRAM_JOIN}
    WHERE ${where}
    ORDER BY wp.seq DESC
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

export async function getAdminProgramBySeq(seq: number): Promise<AdminProgramDetail | null> {
  const pool = await getPool();
  const res = await pool.request().input("seq", sql.Int, seq).query<ProgramRow>(`
    SELECT ${PROGRAM_SELECT}
    ${PROGRAM_JOIN}
    WHERE wp.seq = @seq
  `);
  const row = res.recordset[0];
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

export async function updateAdminProgram(
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

  if (!fields.length) return getAdminProgramBySeq(seq);

  await req.query(`UPDATE dbo.web_program SET ${fields.join(", ")} WHERE seq = @seq`);
  return getAdminProgramBySeq(seq);
}

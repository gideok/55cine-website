import sql from "mssql";
import { getPool } from "../../db/pool.js";
import type { MagazineSection } from "../magazine.service.js";

export type AdminMagazineListItem = {
  seq: number;
  publicId: string;
  section: MagazineSection;
  isPast: boolean;
  title: string;
  movieTitle: string | null;
  publishedLabel: string | null;
  listOrder: number;
  imgThumb: string | null;
};

export type AdminMagazineDetail = AdminMagazineListItem & {
  subtitle: string | null;
  publishedAt: string | null;
  excerpt: string | null;
  bodyHtml: string | null;
  imgCover: string | null;
  sourceUrl: string | null;
  articleUrl: string | null;
};

type MagazineRow = {
  seq: number;
  public_id: string;
  section: string;
  is_past: boolean;
  title: string;
  movie_title: string | null;
  subtitle: string | null;
  published_label: string | null;
  published_at: Date | null;
  excerpt: string | null;
  body_html: string | null;
  img_thumb: string | null;
  img_cover: string | null;
  source_url: string | null;
  article_url: string | null;
  list_order: number;
};

function mapListItem(row: MagazineRow): AdminMagazineListItem {
  return {
    seq: row.seq,
    publicId: row.public_id,
    section: row.section as MagazineSection,
    isPast: !!row.is_past,
    title: row.title,
    movieTitle: row.movie_title?.trim() || null,
    publishedLabel: row.published_label?.trim() || null,
    listOrder: row.list_order,
    imgThumb: row.img_thumb?.trim() || null
  };
}

function mapDetail(row: MagazineRow): AdminMagazineDetail {
  return {
    ...mapListItem(row),
    subtitle: row.subtitle?.trim() || null,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    excerpt: row.excerpt?.trim() || null,
    bodyHtml: row.body_html || null,
    imgCover: row.img_cover?.trim() || null,
    sourceUrl: row.source_url?.trim() || null,
    articleUrl: row.article_url?.trim() || null
  };
}

export async function getAdminMagazineList(opts: {
  section?: MagazineSection;
  isPast?: boolean;
  q?: string;
  page: number;
  pageSize: number;
}): Promise<{
  items: AdminMagazineListItem[];
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

  const parts: string[] = [];
  const req = pool.request();

  if (opts.isPast) {
    parts.push("is_past = 1");
  } else if (opts.section) {
    parts.push("section = @section");
    parts.push("is_past = 0");
    req.input("section", sql.NVarChar, opts.section);
  }

  if (q) {
    parts.push("(title LIKE @q OR public_id LIKE @q OR movie_title LIKE @q)");
    req.input("q", sql.NVarChar, `%${q}%`);
  }

  const where = parts.length ? parts.join(" AND ") : "1=1";

  const countRes = await req.query<{ total: number }>(`
    SELECT COUNT(*) AS total FROM dbo.web_magazine WHERE ${where}
  `);
  const total = countRes.recordset[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const listReq = pool.request();
  if (opts.section && !opts.isPast) listReq.input("section", sql.NVarChar, opts.section);
  if (q) listReq.input("q", sql.NVarChar, `%${q}%`);
  listReq.input("offset", sql.Int, offset);
  listReq.input("pageSize", sql.Int, pageSize);

  const listRes = await listReq.query<MagazineRow>(`
    SELECT seq, public_id, section, is_past, title, movie_title, subtitle,
           published_label, published_at, excerpt, body_html,
           img_thumb, img_cover, source_url, article_url, list_order
    FROM dbo.web_magazine
    WHERE ${where}
    ORDER BY list_order ASC, seq ASC
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

export async function getAdminMagazineByPublicId(
  publicId: string
): Promise<AdminMagazineDetail | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input("publicId", sql.NVarChar, publicId)
    .query<MagazineRow>(`
      SELECT seq, public_id, section, is_past, title, movie_title, subtitle,
             published_label, published_at, excerpt, body_html,
             img_thumb, img_cover, source_url, article_url, list_order
      FROM dbo.web_magazine WHERE public_id = @publicId
    `);
  const row = res.recordset[0];
  return row ? mapDetail(row) : null;
}

export type CreateMagazineInput = {
  publicId: string;
  section: MagazineSection;
  title: string;
  movieTitle?: string | null;
  subtitle?: string | null;
  publishedLabel?: string | null;
  publishedAt?: string | null;
  excerpt?: string | null;
  bodyHtml?: string | null;
  imgThumb?: string | null;
  imgCover?: string | null;
  sourceUrl?: string | null;
  articleUrl?: string | null;
  listOrder?: number;
};

export async function createAdminMagazine(input: CreateMagazineInput): Promise<AdminMagazineDetail> {
  const pool = await getPool();
  await pool
    .request()
    .input("publicId", sql.NVarChar, input.publicId)
    .input("section", sql.NVarChar, input.section)
    .input("title", sql.NVarChar, input.title)
    .input("movieTitle", sql.NVarChar, input.movieTitle ?? null)
    .input("subtitle", sql.NVarChar, input.subtitle ?? null)
    .input("publishedLabel", sql.NVarChar, input.publishedLabel ?? null)
    .input("publishedAt", sql.DateTime2, input.publishedAt ? new Date(input.publishedAt) : null)
    .input("excerpt", sql.NVarChar, input.excerpt ?? null)
    .input("bodyHtml", sql.NVarChar(sql.MAX), input.bodyHtml ?? null)
    .input("imgThumb", sql.NVarChar, input.imgThumb ?? null)
    .input("imgCover", sql.NVarChar, input.imgCover ?? null)
    .input("sourceUrl", sql.NVarChar, input.sourceUrl ?? null)
    .input("articleUrl", sql.NVarChar, input.articleUrl ?? null)
    .input("listOrder", sql.Int, input.listOrder ?? 0)
    .query(`
      INSERT INTO dbo.web_magazine (
        public_id, section, is_past, title, movie_title, subtitle,
        published_label, published_at, excerpt, body_html,
        img_thumb, img_cover, source_url, article_url, list_order
      ) VALUES (
        @publicId, @section, 0, @title, @movieTitle, @subtitle,
        @publishedLabel, @publishedAt, @excerpt, @bodyHtml,
        @imgThumb, @imgCover, @sourceUrl, @articleUrl, @listOrder
      )
    `);

  const detail = await getAdminMagazineByPublicId(input.publicId);
  if (!detail) throw new Error("생성 후 조회 실패");
  return detail;
}

export type UpdateMagazineInput = Partial<Omit<CreateMagazineInput, "publicId" | "section">>;

export async function updateAdminMagazine(
  publicId: string,
  input: UpdateMagazineInput
): Promise<AdminMagazineDetail | null> {
  const pool = await getPool();
  const req = pool.request().input("publicId", sql.NVarChar, publicId);
  const fields: string[] = [];

  const set = (col: string, param: string, val: unknown, type?: sql.ISqlTypeFactoryWithNoParams) => {
    if (val === undefined) return;
    fields.push(`${col} = @${param}`);
    req.input(param, type ?? sql.NVarChar(sql.MAX), val);
  };

  set("title", "title", input.title);
  set("movie_title", "movieTitle", input.movieTitle);
  set("subtitle", "subtitle", input.subtitle);
  set("published_label", "publishedLabel", input.publishedLabel);
  if (input.publishedAt !== undefined) {
    set("published_at", "publishedAt", input.publishedAt ? new Date(input.publishedAt) : null, sql.DateTime2);
  }
  set("excerpt", "excerpt", input.excerpt);
  set("body_html", "bodyHtml", input.bodyHtml);
  set("img_thumb", "imgThumb", input.imgThumb);
  set("img_cover", "imgCover", input.imgCover);
  set("source_url", "sourceUrl", input.sourceUrl);
  set("article_url", "articleUrl", input.articleUrl);
  set("list_order", "listOrder", input.listOrder, sql.Int);

  if (!fields.length) return getAdminMagazineByPublicId(publicId);

  fields.push("updated_at = SYSUTCDATETIME()");
  await req.query(`UPDATE dbo.web_magazine SET ${fields.join(", ")} WHERE public_id = @publicId`);
  return getAdminMagazineByPublicId(publicId);
}

export async function deleteAdminMagazine(publicId: string): Promise<boolean> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input("publicId", sql.NVarChar, publicId)
    .query(`DELETE FROM dbo.web_magazine WHERE public_id = @publicId`);
  return (res.rowsAffected[0] ?? 0) > 0;
}

async function nextPastPublicId(pool: sql.ConnectionPool): Promise<string> {
  const res = await pool.request().query<{ maxNum: number | null }>(`
    SELECT MAX(TRY_CAST(SUBSTRING(public_id, 3, 10) AS INT)) AS maxNum
    FROM dbo.web_magazine WHERE public_id LIKE 'pa%'
  `);
  const next = (res.recordset[0]?.maxNum ?? 0) + 1;
  return `pa${String(next).padStart(3, "0")}`;
}

export async function markMagazineAsPast(publicId: string): Promise<AdminMagazineDetail | null> {
  const pool = await getPool();
  const existing = await getAdminMagazineByPublicId(publicId);
  if (!existing) return null;
  if (existing.isPast) return existing;

  const newPublicId = await nextPastPublicId(pool);
  const listOrderRes = await pool.request().query<{ maxOrder: number | null }>(`
    SELECT MAX(list_order) AS maxOrder FROM dbo.web_magazine WHERE is_past = 1
  `);
  const listOrder = (listOrderRes.recordset[0]?.maxOrder ?? 0) + 1;

  await pool
    .request()
    .input("oldId", sql.NVarChar, publicId)
    .input("newId", sql.NVarChar, newPublicId)
    .input("listOrder", sql.Int, listOrder)
    .query(`
      UPDATE dbo.web_magazine
      SET public_id = @newId, is_past = 1, list_order = @listOrder, updated_at = SYSUTCDATETIME()
      WHERE public_id = @oldId
    `);

  return getAdminMagazineByPublicId(newPublicId);
}

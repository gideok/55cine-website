import sql from "mssql";
import { getPool } from "../../db/pool.js";
import type { MagazineSection } from "../magazine.service.js";
import { applyMagazineAssets } from "./magazine-assets.service.js";
import { sanitizeMagazineBodyHtml } from "../../utils/magazine-html.js";

/** dbo.web_magazine NVARCHAR 컬럼 길이 — 초과 시 SQL Server truncation 오류 */
export const MAGAZINE_FIELD_LIMITS = {
  title: 500,
  movieTitle: 300,
  subtitle: 300,
  publishedLabel: 120,
  imgThumb: 500,
  imgCover: 500,
  sourceUrl: 500
} as const;

function clipText(val: string | null | undefined, max: number): string | null {
  if (val == null) return null;
  const s = String(val);
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeMagazineTextFields<T extends CreateMagazineInput | UpdateMagazineInput>(input: T): T {
  const out = { ...input };
  if (out.title !== undefined) out.title = clipText(out.title, MAGAZINE_FIELD_LIMITS.title) ?? "";
  if (out.movieTitle !== undefined) out.movieTitle = clipText(out.movieTitle, MAGAZINE_FIELD_LIMITS.movieTitle);
  if (out.subtitle !== undefined) out.subtitle = clipText(out.subtitle, MAGAZINE_FIELD_LIMITS.subtitle);
  if (out.publishedLabel !== undefined) {
    out.publishedLabel = clipText(out.publishedLabel, MAGAZINE_FIELD_LIMITS.publishedLabel);
  }
  if (out.bodyHtml !== undefined) out.bodyHtml = sanitizeMagazineBodyHtml(out.bodyHtml);
  if (out.imgThumb !== undefined) out.imgThumb = clipText(out.imgThumb, MAGAZINE_FIELD_LIMITS.imgThumb);
  if (out.imgCover !== undefined) out.imgCover = clipText(out.imgCover, MAGAZINE_FIELD_LIMITS.imgCover);
  if (out.sourceUrl !== undefined) out.sourceUrl = clipText(out.sourceUrl, MAGAZINE_FIELD_LIMITS.sourceUrl);
  return out;
}

export type AdminMagazineListItem = {
  seq: number;
  section: MagazineSection;
  isPast: boolean;
  title: string;
  movieTitle: string | null;
  publishedLabel: string | null;
  createdAt: string | null;
  imgThumb: string | null;
};

export type AdminMagazineDetail = AdminMagazineListItem & {
  subtitle: string | null;
  publishedAt: string | null;
  bodyHtml: string | null;
  imgCover: string | null;
  sourceUrl: string | null;
};

type MagazineRow = {
  seq: number;
  section: string;
  is_past: boolean;
  title: string;
  movie_title: string | null;
  subtitle: string | null;
  published_label: string | null;
  published_at: Date | null;
  created_at: Date;
  body_html: string | null;
  img_thumb: string | null;
  img_cover: string | null;
  source_url: string | null;
};

const MAGAZINE_SELECT = `
  seq, section, is_past, title, movie_title, subtitle,
  published_label, published_at, created_at, body_html,
  img_thumb, img_cover, source_url
`;

function mapListItem(row: MagazineRow): AdminMagazineListItem {
  return {
    seq: row.seq,
    section: row.section as MagazineSection,
    isPast: !!row.is_past,
    title: row.title,
    movieTitle: row.movie_title?.trim() || null,
    publishedLabel: row.published_label?.trim() || null,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    imgThumb: row.img_thumb?.trim() || null
  };
}

function mapDetail(row: MagazineRow): AdminMagazineDetail {
  return {
    ...mapListItem(row),
    subtitle: row.subtitle?.trim() || null,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    bodyHtml: row.body_html || null,
    imgCover: row.img_cover?.trim() || null,
    sourceUrl: row.source_url?.trim() || null
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
    parts.push("(title LIKE @q OR movie_title LIKE @q OR CAST(seq AS NVARCHAR(20)) LIKE @q)");
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
    SELECT ${MAGAZINE_SELECT}
    FROM dbo.web_magazine
    WHERE ${where}
    ORDER BY created_at DESC, seq DESC
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

export async function getAdminMagazineBySeq(seq: number): Promise<AdminMagazineDetail | null> {
  const pool = await getPool();
  const res = await pool.request().input("seq", sql.Int, seq).query<MagazineRow>(`
      SELECT ${MAGAZINE_SELECT}
      FROM dbo.web_magazine WHERE seq = @seq
    `);
  const row = res.recordset[0];
  return row ? mapDetail(row) : null;
}

export type MagazineAssetInput = {
  coverTempPath?: string | null;
  removeCover?: boolean;
};

export type CreateMagazineInput = MagazineAssetInput & {
  section: MagazineSection;
  title: string;
  movieTitle?: string | null;
  subtitle?: string | null;
  publishedLabel?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  bodyHtml?: string | null;
  imgThumb?: string | null;
  imgCover?: string | null;
  sourceUrl?: string | null;
};

export async function createAdminMagazine(input: CreateMagazineInput): Promise<AdminMagazineDetail> {
  const pool = await getPool();
  const data = normalizeMagazineTextFields(input);
  const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
  const insertRes = await pool
    .request()
    .input("section", sql.NVarChar, data.section)
    .input("title", sql.NVarChar, data.title)
    .input("movieTitle", sql.NVarChar, data.movieTitle ?? null)
    .input("subtitle", sql.NVarChar, data.subtitle ?? null)
    .input("publishedLabel", sql.NVarChar, data.publishedLabel ?? null)
    .input("publishedAt", sql.DateTime2, data.publishedAt ? new Date(data.publishedAt) : null)
    .input("createdAt", sql.DateTime2, createdAt)
    .input("bodyHtml", sql.NVarChar(sql.MAX), data.bodyHtml ?? null)
    .input("imgThumb", sql.NVarChar, data.imgThumb ?? null)
    .input("imgCover", sql.NVarChar, data.imgCover ?? null)
    .input("sourceUrl", sql.NVarChar, data.sourceUrl ?? null)
    .query<{ seq: number }>(`
      INSERT INTO dbo.web_magazine (
        section, is_past, title, movie_title, subtitle,
        published_label, published_at, created_at, body_html,
        img_thumb, img_cover, source_url
      )
      OUTPUT INSERTED.seq
      VALUES (
        @section, 0, @title, @movieTitle, @subtitle,
        @publishedLabel, @publishedAt, @createdAt, @bodyHtml,
        @imgThumb, @imgCover, @sourceUrl
      )
    `);

  const seq = insertRes.recordset[0]?.seq;
  if (!seq) throw new Error("생성 후 seq 조회 실패");

  const assets = await applyMagazineAssets(seq, {
    bodyHtml: data.bodyHtml,
    coverTempPath: input.coverTempPath,
    removeCover: input.removeCover
  });

  const finalBody = assets.bodyHtml !== undefined ? assets.bodyHtml : data.bodyHtml;
  const finalCover = assets.imgCover !== undefined ? assets.imgCover : data.imgCover ?? null;
  const finalThumb = assets.imgThumb !== undefined ? assets.imgThumb : data.imgThumb ?? null;

  if (
    finalBody !== data.bodyHtml ||
    finalCover !== (data.imgCover ?? null) ||
    finalThumb !== (data.imgThumb ?? null)
  ) {
    await pool
      .request()
      .input("seq", sql.Int, seq)
      .input("bodyHtml", sql.NVarChar(sql.MAX), finalBody)
      .input("imgCover", sql.NVarChar, finalCover)
      .input("imgThumb", sql.NVarChar, finalThumb)
      .query(`
        UPDATE dbo.web_magazine
        SET body_html = @bodyHtml, img_cover = @imgCover, img_thumb = @imgThumb,
            updated_at = SYSUTCDATETIME()
        WHERE seq = @seq
      `);
  }

  const detail = await getAdminMagazineBySeq(seq);
  if (!detail) throw new Error("생성 후 조회 실패");
  return detail;
}

export type UpdateMagazineInput = Partial<Omit<CreateMagazineInput, "section">>;

export async function updateAdminMagazine(
  seq: number,
  input: UpdateMagazineInput
): Promise<AdminMagazineDetail | null> {
  const pool = await getPool();
  const existing = await getAdminMagazineBySeq(seq);
  if (!existing) return null;

  let data = normalizeMagazineTextFields(input);

  const assets = await applyMagazineAssets(seq, {
    bodyHtml: input.bodyHtml,
    coverTempPath: input.coverTempPath,
    removeCover: input.removeCover,
    existingCover: existing.imgCover,
    existingThumb: existing.imgThumb
  });
  if (assets.bodyHtml !== undefined || assets.imgCover !== undefined || assets.imgThumb !== undefined) {
    data = {
      ...data,
      bodyHtml: assets.bodyHtml !== undefined ? assets.bodyHtml : data.bodyHtml,
      imgCover: assets.imgCover !== undefined ? assets.imgCover : data.imgCover,
      imgThumb: assets.imgThumb !== undefined ? assets.imgThumb : data.imgThumb
    };
  }

  const req = pool.request().input("seq", sql.Int, seq);
  const fields: string[] = [];

  const set = (col: string, param: string, val: unknown, type?: sql.ISqlTypeFactoryWithNoParams) => {
    if (val === undefined) return;
    fields.push(`${col} = @${param}`);
    req.input(param, type ?? sql.NVarChar(sql.MAX), val);
  };

  set("title", "title", data.title);
  set("movie_title", "movieTitle", data.movieTitle);
  set("subtitle", "subtitle", data.subtitle);
  set("published_label", "publishedLabel", data.publishedLabel);
  if (data.publishedAt !== undefined) {
    set("published_at", "publishedAt", data.publishedAt ? new Date(data.publishedAt) : null, sql.DateTime2);
  }
  if (data.createdAt !== undefined) {
    set("created_at", "createdAt", data.createdAt ? new Date(data.createdAt) : null, sql.DateTime2);
  }
  set("body_html", "bodyHtml", data.bodyHtml);
  set("img_thumb", "imgThumb", data.imgThumb);
  set("img_cover", "imgCover", data.imgCover);
  set("source_url", "sourceUrl", data.sourceUrl);

  if (!fields.length) return getAdminMagazineBySeq(seq);

  fields.push("updated_at = SYSUTCDATETIME()");
  await req.query(`UPDATE dbo.web_magazine SET ${fields.join(", ")} WHERE seq = @seq`);
  return getAdminMagazineBySeq(seq);
}

export async function deleteAdminMagazine(seq: number): Promise<boolean> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input("seq", sql.Int, seq)
    .query(`DELETE FROM dbo.web_magazine WHERE seq = @seq`);
  return (res.rowsAffected[0] ?? 0) > 0;
}

export async function markMagazineAsPast(seq: number): Promise<AdminMagazineDetail | null> {
  const pool = await getPool();
  const existing = await getAdminMagazineBySeq(seq);
  if (!existing) return null;
  if (existing.isPast) return existing;

  await pool.request().input("seq", sql.Int, seq).query(`
      UPDATE dbo.web_magazine
      SET is_past = 1, updated_at = SYSUTCDATETIME()
      WHERE seq = @seq
    `);

  return getAdminMagazineBySeq(seq);
}

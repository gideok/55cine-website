import sql from "mssql";
import { getPool } from "../../db/pool.js";
import { sanitizeNoticeBodyHtml, type NoticeContentWidth } from "../../utils/notice-html.js";
import { finalizeNoticeMainImage } from "./notice-assets.service.js";

export type NoticeFormatType = "image-text" | "text";

export type AdminNoticeListItem = {
  seq: number;
  title: string;
  formatType: NoticeFormatType;
  contentWidth: NoticeContentWidth;
  isActive: boolean;
  imgMain: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminNoticeDetail = AdminNoticeListItem & {
  bodyHtml: string | null;
};

type NoticeRow = {
  seq: number;
  title: string;
  format_type: string;
  body_html: string | null;
  img_main: string | null;
  content_width: number;
  is_active: boolean | number;
  created_at: unknown;
  updated_at: unknown;
};

function formatTs(val: unknown): string | null {
  if (val == null) return null;
  const d = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toISOString();
}

function mapListItem(row: NoticeRow): AdminNoticeListItem {
  return {
    seq: row.seq,
    title: String(row.title || "").trim(),
    formatType: row.format_type as NoticeFormatType,
    contentWidth: Number(row.content_width) as NoticeContentWidth,
    isActive: !!row.is_active,
    imgMain: row.img_main?.trim() || null,
    createdAt: formatTs(row.created_at) || "",
    updatedAt: formatTs(row.updated_at) || ""
  };
}

function mapDetail(row: NoticeRow): AdminNoticeDetail {
  return {
    ...mapListItem(row),
    bodyHtml: row.body_html || null
  };
}

export type CreateNoticeInput = {
  title: string;
  formatType: NoticeFormatType;
  bodyHtml?: string | null;
  imgMain?: string | null;
  contentWidth: NoticeContentWidth;
  mainImageTempPath?: string | null;
  removeMainImage?: boolean;
};

export type UpdateNoticeInput = Partial<CreateNoticeInput>;

export async function getAdminNoticeList(): Promise<AdminNoticeListItem[]> {
  const pool = await getPool();
  const res = await pool.request().query<NoticeRow>(`
    SELECT seq, title, format_type, body_html, img_main, content_width, is_active, created_at, updated_at
    FROM dbo.web_notice
    ORDER BY is_active DESC, created_at DESC, seq DESC
  `);
  return res.recordset.map(mapListItem);
}

export async function getAdminNoticeBySeq(seq: number): Promise<AdminNoticeDetail | null> {
  const pool = await getPool();
  const res = await pool.request().input("seq", sql.Int, seq).query<NoticeRow>(`
    SELECT seq, title, format_type, body_html, img_main, content_width, is_active, created_at, updated_at
    FROM dbo.web_notice WHERE seq = @seq
  `);
  const row = res.recordset[0];
  return row ? mapDetail(row) : null;
}

async function applyMainImage(
  seq: number,
  input: { mainImageTempPath?: string | null; removeMainImage?: boolean; imgMain?: string | null }
): Promise<string | null> {
  const existing = await getAdminNoticeBySeq(seq);
  return finalizeNoticeMainImage({
    seq,
    mainImageTempPath: input.mainImageTempPath,
    removeMainImage: input.removeMainImage,
    existingMain: input.imgMain ?? existing?.imgMain ?? null
  });
}

export async function createAdminNotice(input: CreateNoticeInput): Promise<AdminNoticeDetail> {
  const pool = await getPool();
  const title = String(input.title || "").trim();
  if (!title) throw new Error("제목을 입력해 주세요.");

  const bodyHtml = sanitizeNoticeBodyHtml(input.bodyHtml);
  const insert = await pool
    .request()
    .input("title", sql.NVarChar(200), title)
    .input("formatType", sql.NVarChar(20), input.formatType)
    .input("bodyHtml", sql.NVarChar(sql.MAX), bodyHtml)
    .input("contentWidth", sql.TinyInt, input.contentWidth)
    .query<{ seq: number }>(`
      INSERT INTO dbo.web_notice (title, format_type, body_html, content_width)
      OUTPUT INSERTED.seq
      VALUES (@title, @formatType, @bodyHtml, @contentWidth)
    `);

  const seq = insert.recordset[0]?.seq;
  if (!seq) throw new Error("공지 등록 실패");

  let imgMain: string | null = null;
  if (input.formatType === "image-text") {
    imgMain = await applyMainImage(seq, input);
    if (imgMain) {
      await pool
        .request()
        .input("seq", sql.Int, seq)
        .input("imgMain", sql.NVarChar(500), imgMain)
        .query(`UPDATE dbo.web_notice SET img_main = @imgMain, updated_at = SYSUTCDATETIME() WHERE seq = @seq`);
    }
  }

  const detail = await getAdminNoticeBySeq(seq);
  if (!detail) throw new Error("공지 조회 실패");
  return detail;
}

export async function updateAdminNotice(
  seq: number,
  input: UpdateNoticeInput
): Promise<AdminNoticeDetail | null> {
  const existing = await getAdminNoticeBySeq(seq);
  if (!existing) return null;

  const pool = await getPool();
  const req = pool.request().input("seq", sql.Int, seq);
  const fields: string[] = [];

  if (input.title !== undefined) {
    const title = String(input.title || "").trim();
    if (!title) throw new Error("제목을 입력해 주세요.");
    fields.push("title = @title");
    req.input("title", sql.NVarChar(200), title);
  }
  if (input.formatType !== undefined) {
    fields.push("format_type = @formatType");
    req.input("formatType", sql.NVarChar(20), input.formatType);
  }
  if (input.bodyHtml !== undefined) {
    fields.push("body_html = @bodyHtml");
    req.input("bodyHtml", sql.NVarChar(sql.MAX), sanitizeNoticeBodyHtml(input.bodyHtml));
  }
  if (input.contentWidth !== undefined) {
    fields.push("content_width = @contentWidth");
    req.input("contentWidth", sql.TinyInt, input.contentWidth);
  }

  const formatType = input.formatType ?? existing.formatType;
  let imgMain = existing.imgMain;
  if (formatType === "image-text" && (input.mainImageTempPath || input.removeMainImage || input.imgMain !== undefined)) {
    imgMain = await applyMainImage(seq, {
      mainImageTempPath: input.mainImageTempPath,
      removeMainImage: input.removeMainImage,
      imgMain: input.imgMain
    });
    fields.push("img_main = @imgMain");
    req.input("imgMain", sql.NVarChar(500), imgMain);
  } else if (formatType === "text") {
    fields.push("img_main = NULL");
  }

  if (fields.length) {
    fields.push("updated_at = SYSUTCDATETIME()");
    await req.query(`UPDATE dbo.web_notice SET ${fields.join(", ")} WHERE seq = @seq`);
  }

  return getAdminNoticeBySeq(seq);
}

export async function deleteAdminNotice(seq: number): Promise<boolean> {
  const pool = await getPool();
  const res = await pool.request().input("seq", sql.Int, seq).query(`
    DELETE FROM dbo.web_notice WHERE seq = @seq
  `);
  return (res.rowsAffected[0] ?? 0) > 0;
}

/** 활성 공지 1건만 — 나머지는 모두 비활성화 */
export async function activateAdminNotice(seq: number): Promise<AdminNoticeDetail | null> {
  const pool = await getPool();
  const exists = await getAdminNoticeBySeq(seq);
  if (!exists) return null;

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query(`UPDATE dbo.web_notice SET is_active = 0`);
    await new sql.Request(tx)
      .input("seq", sql.Int, seq)
      .query(`
        UPDATE dbo.web_notice
        SET is_active = 1, updated_at = SYSUTCDATETIME()
        WHERE seq = @seq
      `);
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return getAdminNoticeBySeq(seq);
}

export async function deactivateAdminNotice(seq: number): Promise<AdminNoticeDetail | null> {
  const pool = await getPool();
  const res = await pool.request().input("seq", sql.Int, seq).query(`
    UPDATE dbo.web_notice
    SET is_active = 0, updated_at = SYSUTCDATETIME()
    WHERE seq = @seq
  `);
  if ((res.rowsAffected[0] ?? 0) === 0) return null;
  return getAdminNoticeBySeq(seq);
}

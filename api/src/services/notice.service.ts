import sql from "mssql";
import { getPool } from "../db/pool.js";
import type { NoticeContentWidth } from "../utils/notice-html.js";
import { noticeLayoutPercents } from "../utils/notice-html.js";

export type PublicNotice = {
  seq: number;
  formatType: "image-text" | "text";
  bodyHtml: string | null;
  imgMain: string | null;
  contentWidth: NoticeContentWidth;
  layout: {
    contentPct: number;
    marginPct: number;
  };
};

type NoticeRow = {
  seq: number;
  format_type: string;
  body_html: string | null;
  img_main: string | null;
  content_width: number;
};

export async function getActiveNotice(): Promise<PublicNotice | null> {
  const pool = await getPool();
  const res = await pool.request().query<NoticeRow>(`
    SELECT TOP (1) seq, format_type, body_html, img_main, content_width
    FROM dbo.web_notice
    WHERE is_active = 1
    ORDER BY seq DESC
  `);
  const row = res.recordset[0];
  if (!row) return null;

  const contentWidth = Number(row.content_width) as NoticeContentWidth;
  return {
    seq: row.seq,
    formatType: row.format_type as PublicNotice["formatType"],
    bodyHtml: row.body_html || null,
    imgMain: row.img_main?.trim() || null,
    contentWidth,
    layout: noticeLayoutPercents(contentWidth)
  };
}

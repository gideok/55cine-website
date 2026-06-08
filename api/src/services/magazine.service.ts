import sql from "mssql";
import { getPool } from "../db/pool.js";
import { decodePlainTextField, excerptFromBodyHtml } from "../utils/magazine-html.js";

export type MagazineSection = "preview" | "serial" | "gv-moment";

export type MagazineListItem = {
  seq: number;
  id: number;
  title: string;
  excerpt: string;
  thumbnail: string;
  date: string;
  detailUrl: string;
};

export type MagazineNeighbor = {
  seq: number;
  id: number;
  title: string;
  thumbnail: string;
};

export type MagazineDetail = {
  seq: number;
  id: number;
  title: string;
  movieTitle: string;
  subtitle: string;
  publishedLabel: string;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  coverImage: string;
  thumbnail: string;
  bodyHtml: string;
  excerpt: string;
  sourceUrl: string;
  section: MagazineSection;
  isPast: boolean;
  neighbors: {
    prev: MagazineNeighbor | null;
    next: MagazineNeighbor | null;
  };
};

export type MagazineListPage = {
  items: MagazineListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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
  updated_at: Date;
  body_html: string | null;
  img_thumb: string | null;
  img_cover: string | null;
  source_url: string | null;
};

const MAGAZINE_SELECT = `
  seq, section, is_past, title, movie_title, subtitle,
  published_label, published_at, created_at, updated_at, body_html,
  img_thumb, img_cover, source_url
`;

function detailPagePath(row: Pick<MagazineRow, "section" | "seq" | "is_past">): string {
  const id = encodeURIComponent(String(row.seq));
  if (row.is_past) {
    return `magazine/past-articles/article-detail.html?id=${id}`;
  }
  switch (row.section) {
    case "serial":
      return `magazine/serial/article-detail.html?id=${id}`;
    case "gv-moment":
      return `magazine/gv-moment/article-detail.html?id=${id}`;
    default:
      return `magazine/preview/article-detail.html?id=${id}`;
  }
}

function mapListItem(row: MagazineRow): MagazineListItem {
  const thumb = row.img_thumb?.trim() || row.img_cover?.trim() || "";
  const date = row.published_label?.trim() || "";
  return {
    seq: row.seq,
    id: row.seq,
    title: decodePlainTextField(row.title),
    excerpt: excerptFromBodyHtml(row.body_html),
    thumbnail: thumb,
    date,
    detailUrl: detailPagePath(row)
  };
}

function listWhereClause(opts: {
  section?: MagazineSection;
  isPast?: boolean;
}): { sql: string; inputs: Array<{ name: string; type: sql.ISqlTypeFactoryWithNoParams; value: unknown }> } {
  const parts: string[] = [];
  const inputs: Array<{ name: string; type: sql.ISqlTypeFactoryWithNoParams; value: unknown }> = [];

  if (opts.isPast) {
    parts.push("is_past = 1");
  } else if (opts.section) {
    parts.push("section = @section");
    parts.push("is_past = 0");
    inputs.push({ name: "section", type: sql.NVarChar, value: opts.section });
  }

  return { sql: parts.length ? parts.join(" AND ") : "1=1", inputs };
}

export async function getMagazineListPage(opts: {
  section?: MagazineSection;
  isPast?: boolean;
  page: number;
  pageSize: number;
}): Promise<MagazineListPage> {
  const pool = await getPool();
  const page = Math.max(1, opts.page);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize));
  const offset = (page - 1) * pageSize;
  const where = listWhereClause(opts);

  const countReq = pool.request();
  for (const inp of where.inputs) {
    countReq.input(inp.name, inp.type, inp.value);
  }
  const countRes = await countReq.query<{ total: number }>(`
    SELECT COUNT(*) AS total FROM dbo.web_magazine WHERE ${where.sql}
  `);
  const total = countRes.recordset[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const listReq = pool.request();
  for (const inp of where.inputs) {
    listReq.input(inp.name, inp.type, inp.value);
  }
  listReq.input("offset", sql.Int, offset);
  listReq.input("pageSize", sql.Int, pageSize);

  const listRes = await listReq.query<MagazineRow>(`
    SELECT ${MAGAZINE_SELECT}
    FROM dbo.web_magazine
    WHERE ${where.sql}
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

async function fetchNeighbor(
  pool: sql.ConnectionPool,
  whereSql: string,
  inputs: Array<{ name: string; type: sql.ISqlTypeFactoryWithNoParams; value: unknown }>,
  createdAt: Date,
  seq: number,
  direction: "prev" | "next"
): Promise<MagazineNeighbor | null> {
  const req = pool.request();
  for (const inp of inputs) {
    req.input(inp.name, inp.type, inp.value);
  }
  req.input("createdAt", sql.DateTime2, createdAt);
  req.input("seq", sql.Int, seq);

  // prev = 이전 글(더 오래됨), next = 다음 글(더 최근)
  const cmp =
    direction === "prev"
      ? `(created_at < @createdAt OR (created_at = @createdAt AND seq < @seq))`
      : `(created_at > @createdAt OR (created_at = @createdAt AND seq > @seq))`;
  const order =
    direction === "prev"
      ? `created_at DESC, seq DESC`
      : `created_at ASC, seq ASC`;

  const res = await req.query<MagazineRow>(`
    SELECT TOP 1 seq, title, img_thumb, img_cover
    FROM dbo.web_magazine
    WHERE ${whereSql} AND ${cmp}
    ORDER BY ${order}
  `);

  const row = res.recordset[0];
  if (!row) return null;
  return {
    seq: row.seq,
    id: row.seq,
    title: decodePlainTextField(row.title),
    thumbnail: row.img_thumb?.trim() || row.img_cover?.trim() || ""
  };
}

export async function getMagazineDetail(seq: number): Promise<MagazineDetail | null> {
  const pool = await getPool();
  const main = await pool.request().input("seq", sql.Int, seq).query<MagazineRow>(`
      SELECT ${MAGAZINE_SELECT}
      FROM dbo.web_magazine
      WHERE seq = @seq
    `);

  const row = main.recordset[0];
  if (!row) return null;

  const where = row.is_past
    ? listWhereClause({ isPast: true })
    : listWhereClause({ section: row.section as MagazineSection, isPast: false });

  const [prev, next] = await Promise.all([
    fetchNeighbor(pool, where.sql, where.inputs, row.created_at, row.seq, "prev"),
    fetchNeighbor(pool, where.sql, where.inputs, row.created_at, row.seq, "next")
  ]);

  const cover = row.img_cover?.trim() || row.img_thumb?.trim() || "";
  const thumb = row.img_thumb?.trim() || cover;

  return {
    seq: row.seq,
    id: row.seq,
    title: decodePlainTextField(row.title),
    movieTitle: decodePlainTextField(row.movie_title),
    subtitle: row.subtitle?.trim() || "",
    publishedLabel: row.published_label?.trim() || "",
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    coverImage: cover,
    thumbnail: thumb,
    bodyHtml: row.body_html || "",
    excerpt: excerptFromBodyHtml(row.body_html),
    sourceUrl: row.source_url?.trim() || "",
    section: row.section as MagazineSection,
    isPast: !!row.is_past,
    neighbors: { prev, next }
  };
}

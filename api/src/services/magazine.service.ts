import sql from "mssql";
import { getPool } from "../db/pool.js";

export type MagazineSection = "preview" | "serial" | "gv-moment";

export type MagazineListItem = {
  id: string;
  publicId: string;
  title: string;
  excerpt: string;
  thumbnail: string;
  date: string;
  detailUrl: string;
};

export type MagazineNeighbor = {
  id: string;
  title: string;
  thumbnail: string;
};

export type MagazineDetail = {
  id: string;
  slug: string;
  title: string;
  movieTitle: string;
  subtitle: string;
  publishedLabel: string;
  publishedAt: string | null;
  coverImage: string;
  thumbnail: string;
  bodyHtml: string;
  excerpt: string;
  articleUrl: string;
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

function detailPagePath(row: Pick<MagazineRow, "section" | "public_id" | "is_past">): string {
  const id = encodeURIComponent(row.public_id);
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
    id: row.public_id,
    publicId: row.public_id,
    title: row.title,
    excerpt: row.excerpt?.trim() || "",
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
    SELECT
      seq, public_id, section, is_past, title, movie_title, subtitle,
      published_label, published_at, excerpt, body_html,
      img_thumb, img_cover, source_url, article_url, list_order
    FROM dbo.web_magazine
    WHERE ${where.sql}
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

async function fetchNeighbor(
  pool: sql.ConnectionPool,
  whereSql: string,
  inputs: Array<{ name: string; type: sql.ISqlTypeFactoryWithNoParams; value: unknown }>,
  listOrder: number,
  seq: number,
  direction: "prev" | "next"
): Promise<MagazineNeighbor | null> {
  const req = pool.request();
  for (const inp of inputs) {
    req.input(inp.name, inp.type, inp.value);
  }
  req.input("listOrder", sql.Int, listOrder);
  req.input("seq", sql.Int, seq);

  const cmp =
    direction === "prev"
      ? `(list_order < @listOrder OR (list_order = @listOrder AND seq < @seq))`
      : `(list_order > @listOrder OR (list_order = @listOrder AND seq > @seq))`;
  const order =
    direction === "prev"
      ? `list_order DESC, seq DESC`
      : `list_order ASC, seq ASC`;

  const res = await req.query<MagazineRow>(`
    SELECT TOP 1
      public_id, title, img_thumb, img_cover, section, is_past
    FROM dbo.web_magazine
    WHERE ${whereSql} AND ${cmp}
    ORDER BY ${order}
  `);

  const row = res.recordset[0];
  if (!row) return null;
  return {
    id: row.public_id,
    title: row.title,
    thumbnail: row.img_thumb?.trim() || row.img_cover?.trim() || ""
  };
}

export async function getMagazineDetail(publicId: string): Promise<MagazineDetail | null> {
  const pool = await getPool();
  const main = await pool
    .request()
    .input("publicId", sql.NVarChar, publicId)
    .query<MagazineRow>(`
      SELECT
        seq, public_id, section, is_past, title, movie_title, subtitle,
        published_label, published_at, excerpt, body_html,
        img_thumb, img_cover, source_url, article_url, list_order
      FROM dbo.web_magazine
      WHERE public_id = @publicId
    `);

  const row = main.recordset[0];
  if (!row) return null;

  const where = row.is_past
    ? listWhereClause({ isPast: true })
    : listWhereClause({ section: row.section as MagazineSection, isPast: false });

  const [prev, next] = await Promise.all([
    fetchNeighbor(pool, where.sql, where.inputs, row.list_order, row.seq, "prev"),
    fetchNeighbor(pool, where.sql, where.inputs, row.list_order, row.seq, "next")
  ]);

  const cover = row.img_cover?.trim() || row.img_thumb?.trim() || "";
  const thumb = row.img_thumb?.trim() || cover;

  return {
    id: row.public_id,
    slug: row.public_id,
    title: row.title,
    movieTitle: row.movie_title?.trim() || "",
    subtitle: row.subtitle?.trim() || "",
    publishedLabel: row.published_label?.trim() || "",
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    coverImage: cover,
    thumbnail: thumb,
    bodyHtml: row.body_html || "",
    excerpt: row.excerpt?.trim() || "",
    articleUrl: row.article_url?.trim() || "",
    sourceUrl: row.source_url?.trim() || "",
    section: row.section as MagazineSection,
    isPast: !!row.is_past,
    neighbors: { prev, next }
  };
}

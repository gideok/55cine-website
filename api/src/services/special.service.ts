import sql from "mssql";
import { getPool } from "../db/pool.js";

export type SpecialKind = "exhibition" | "event";

export type SpecialListItem = {
  id: number;
  publicId: string;
  title: string;
  thumbnail: string;
  detailUrl: string;
};

export type SpecialScreening = {
  date: string;
  time: string;
  gv: boolean;
};

export type SpecialFilmItem = {
  title: string;
  image: string;
  info: string;
  director: string;
  cast: string;
  description: string;
  sectionname: string;
  screenings: SpecialScreening[];
};

export type SpecialNeighbor = {
  publicId: string;
  title: string;
  thumbnail: string;
};

export type SpecialDetail = {
  id: string;
  title: string;
  image: string;
  introduction: string;
  bookingUrl: string;
  films: SpecialFilmItem[];
  neighbors?: {
    prev: SpecialNeighbor | null;
    next: SpecialNeighbor | null;
  };
};

type SpecialRow = {
  seq: number;
  public_id: string;
  kind: string;
  title: string;
  body: string | null;
  img_main: string | null;
  booking_url: string | null;
  list_order: number;
};

type ItemRow = {
  item_seq: number;
  title: string | null;
  is_empty_spacer: boolean;
  img_path: string | null;
  title_en: string | null;
  info: string | null;
  running_time_label: string | null;
  director: string | null;
  cast_names: string | null;
  description: string | null;
  section_name: string | null;
};

type ScreeningRow = {
  item_seq: number;
  date_sc: string;
  time_sc: string;
  is_gv: boolean;
};

const DEFAULT_BOOKING_URL =
  "https://www.dtryx.com/cinema/main.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059";

function formatFilmInfoLine(row: {
  title_en?: string | null;
  info?: string | null;
  running_time_label?: string | null;
}): string {
  const chunks: string[] = [];
  if (row.title_en?.trim()) chunks.push(row.title_en.trim());
  if (row.info?.trim()) chunks.push(row.info.trim());
  if (row.running_time_label?.trim()) chunks.push(row.running_time_label.trim());
  return chunks.join(" | ");
}

function listThumbFallback(kind: SpecialKind, publicId: string): string {
  if (kind === "event") {
    const num = publicId.replace(/^ev0*/i, "") || publicId;
    const padded = Number(num) < 100 ? String(Number(num)).padStart(2, "0") : num;
    return `images/special/event/event_thumb_${padded}.jpg`;
  }
  const num = publicId.replace(/^e0*/i, "") || publicId;
  const padded = Number(num) < 100 ? String(Number(num)).padStart(2, "0") : num;
  return `images/special/exhibition/special_exhibition_thumb_${padded}.png`;
}

function detailPagePath(kind: SpecialKind, publicId: string): string {
  if (kind === "event") {
    return `special/event/event_detail.html?id=${encodeURIComponent(publicId)}`;
  }
  return `special/exhibition/exhibition_detail.html?id=${encodeURIComponent(publicId)}`;
}

function mapListItem(row: SpecialRow): SpecialListItem {
  const kind = row.kind as SpecialKind;
  const thumbnail =
    (row.img_main && String(row.img_main).trim()) || listThumbFallback(kind, row.public_id);
  return {
    id: row.list_order,
    publicId: row.public_id,
    title: row.title,
    thumbnail,
    detailUrl: detailPagePath(kind, row.public_id)
  };
}

function mapFilmItem(item: ItemRow, screenings: ScreeningRow[]): SpecialFilmItem {
  if (item.is_empty_spacer || item.title === "EmptyFilms") {
    return {
      title: "EmptyFilms",
      image: "",
      info: "",
      director: "",
      cast: "",
      description: "",
      sectionname: "",
      screenings: []
    };
  }

  const infoLine = formatFilmInfoLine({
    title_en: item.title_en,
    info: item.info,
    running_time_label: item.running_time_label
  });

  return {
    title: item.title?.trim() || "",
    image: item.img_path?.trim() || "",
    info: infoLine,
    director: item.director?.trim() || "",
    cast: item.cast_names?.trim() || "",
    description: item.description?.trim() || "",
    sectionname: item.section_name?.trim() || "",
    screenings: screenings.map((s) => ({
      date: String(s.date_sc).trim(),
      time: String(s.time_sc).trim().slice(0, 5),
      gv: !!s.is_gv
    }))
  };
}

async function fetchSpecialNeighbor(
  pool: sql.ConnectionPool,
  kind: SpecialKind,
  listOrder: number,
  seq: number,
  direction: "prev" | "next"
): Promise<SpecialNeighbor | null> {
  const req = pool.request().input("kind", sql.NVarChar, kind);
  req.input("listOrder", sql.Int, listOrder);
  req.input("seq", sql.Int, seq);

  // prev/next = special-exhibition 목록(list_order DESC) 순서와 동일
  // prev = 목록에서 앞(더 최신), next = 목록에서 뒤(더 이전)
  const cmp =
    direction === "prev"
      ? `(list_order > @listOrder OR (list_order = @listOrder AND seq > @seq))`
      : `(list_order < @listOrder OR (list_order = @listOrder AND seq < @seq))`;
  const order =
    direction === "prev" ? `list_order ASC, seq ASC` : `list_order DESC, seq DESC`;

  const res = await req.query<SpecialRow>(`
    SELECT TOP 1 seq, public_id, kind, title, img_main, list_order
    FROM dbo.web_special
    WHERE kind = @kind AND ${cmp}
    ORDER BY ${order}
  `);

  const row = res.recordset[0];
  if (!row) return null;
  const thumbKind = row.kind as SpecialKind;
  const thumbnail =
    (row.img_main && String(row.img_main).trim()) ||
    listThumbFallback(thumbKind, row.public_id);
  return {
    publicId: row.public_id,
    title: row.title,
    thumbnail
  };
}

export async function getSpecialList(kind: SpecialKind): Promise<SpecialListItem[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("kind", sql.NVarChar, kind)
    .query<SpecialRow>(`
      SELECT seq, public_id, kind, title, body, img_main, booking_url, list_order
      FROM dbo.web_special
      WHERE kind = @kind
      ORDER BY list_order DESC, seq DESC
    `);

  return result.recordset.map(mapListItem);
}

export async function getSpecialDetail(
  publicId: string,
  kind?: SpecialKind
): Promise<SpecialDetail | null> {
  const pool = await getPool();
  const req = pool.request().input("publicId", sql.NVarChar, publicId);
  let where = "public_id = @publicId";
  if (kind) {
    req.input("kind", sql.NVarChar, kind);
    where += " AND kind = @kind";
  }

  const main = await req.query<SpecialRow>(`
    SELECT seq, public_id, kind, title, body, img_main, booking_url, list_order
    FROM dbo.web_special
    WHERE ${where}
  `);

  const row = main.recordset[0];
  if (!row) return null;

  const specialKind = row.kind as SpecialKind;
  const itemsResult = await pool
    .request()
    .input("seq", sql.Int, row.seq)
    .query<ItemRow>(`
      SELECT
        item_seq, title, is_empty_spacer, img_path,
        title_en, info, running_time_label,
        director, cast_names, description, section_name
      FROM dbo.web_special_item
      WHERE special_seq = @seq
      ORDER BY sort_order ASC, item_seq ASC
    `);

  const items = itemsResult.recordset;
  const screeningsByItem = new Map<number, ScreeningRow[]>();

  const scResult = await pool.request().input("seq", sql.Int, row.seq).query<ScreeningRow>(`
    SELECT sc.item_seq, sc.date_sc, sc.time_sc, sc.is_gv
    FROM dbo.web_special_screening sc
    INNER JOIN dbo.web_special_item i ON i.item_seq = sc.item_seq
    WHERE i.special_seq = @seq
    ORDER BY i.sort_order ASC, sc.sort_order ASC, sc.screening_seq ASC
  `);
  for (const sc of scResult.recordset) {
    const list = screeningsByItem.get(sc.item_seq) ?? [];
    list.push(sc);
    screeningsByItem.set(sc.item_seq, list);
  }

  const image =
    (row.img_main && String(row.img_main).trim()) ||
    listThumbFallback(specialKind, row.public_id);

  const films =
    specialKind === "exhibition"
      ? items.map((item) =>
          mapFilmItem(item, screeningsByItem.get(item.item_seq) ?? [])
        )
      : [];

  const [prev, next] = await Promise.all([
    fetchSpecialNeighbor(pool, specialKind, row.list_order, row.seq, "prev"),
    fetchSpecialNeighbor(pool, specialKind, row.list_order, row.seq, "next")
  ]);

  return {
    id: row.public_id,
    title: row.title,
    image,
    introduction: row.body?.trim() || "",
    bookingUrl: row.booking_url?.trim() || DEFAULT_BOOKING_URL,
    films,
    neighbors: { prev, next }
  };
}

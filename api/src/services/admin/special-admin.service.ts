import sql from "mssql";
import { getPool } from "../../db/pool.js";
import type { SpecialKind } from "../special.service.js";

export type AdminSpecialListItem = {
  seq: number;
  publicId: string;
  kind: SpecialKind;
  title: string;
  dateLabel: string | null;
  imgMain: string | null;
  listOrder: number;
};

export type AdminSpecialScreening = {
  date: string;
  time: string;
  gv: boolean;
};

export type AdminSpecialFilmItem = {
  itemSeq?: number;
  title: string;
  image: string;
  titleEn: string;
  info: string;
  runningTimeLabel: string;
  director: string;
  cast: string;
  description: string;
  sectionName: string;
  isEmptySpacer: boolean;
  screenings: AdminSpecialScreening[];
};

export type AdminSpecialDetail = {
  seq: number;
  publicId: string;
  kind: SpecialKind;
  title: string;
  dateLabel: string | null;
  body: string;
  imgMain: string;
  bookingUrl: string;
  listOrder: number;
  films: AdminSpecialFilmItem[];
};

type SpecialRow = {
  seq: number;
  public_id: string;
  kind: string;
  title: string;
  date_label: string | null;
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
  sort_order: number;
};

type ScreeningRow = {
  item_seq: number;
  date_sc: string;
  time_sc: string;
  is_gv: boolean;
  sort_order: number;
};

function mapListItem(row: SpecialRow): AdminSpecialListItem {
  return {
    seq: row.seq,
    publicId: row.public_id,
    kind: row.kind as SpecialKind,
    title: row.title,
    dateLabel: row.date_label?.trim() || null,
    imgMain: row.img_main?.trim() || null,
    listOrder: row.list_order
  };
}

async function loadFilms(pool: sql.ConnectionPool, specialSeq: number): Promise<AdminSpecialFilmItem[]> {
  const itemsRes = await pool.request().input("seq", sql.Int, specialSeq).query<ItemRow>(`
    SELECT item_seq, title, is_empty_spacer, img_path, title_en, info, running_time_label,
           director, cast_names, description, section_name, sort_order
    FROM dbo.web_special_item
    WHERE special_seq = @seq
    ORDER BY sort_order ASC, item_seq ASC
  `);

  const scRes = await pool.request().input("seq", sql.Int, specialSeq).query<ScreeningRow>(`
    SELECT sc.item_seq, sc.date_sc, sc.time_sc, sc.is_gv, sc.sort_order
    FROM dbo.web_special_screening sc
    INNER JOIN dbo.web_special_item i ON i.item_seq = sc.item_seq
    WHERE i.special_seq = @seq
    ORDER BY sc.sort_order ASC, sc.screening_seq ASC
  `);

  const screeningsByItem = new Map<number, AdminSpecialScreening[]>();
  for (const sc of scRes.recordset) {
    const list = screeningsByItem.get(sc.item_seq) ?? [];
    list.push({
      date: String(sc.date_sc).trim(),
      time: String(sc.time_sc).trim().slice(0, 5),
      gv: !!sc.is_gv
    });
    screeningsByItem.set(sc.item_seq, list);
  }

  return itemsRes.recordset.map((item) => ({
    itemSeq: item.item_seq,
    title: item.title?.trim() || "",
    image: item.img_path?.trim() || "",
    titleEn: item.title_en?.trim() || "",
    info: item.info?.trim() || "",
    runningTimeLabel: item.running_time_label?.trim() || "",
    director: item.director?.trim() || "",
    cast: item.cast_names?.trim() || "",
    description: item.description?.trim() || "",
    sectionName: item.section_name?.trim() || "",
    isEmptySpacer: !!item.is_empty_spacer,
    screenings: screeningsByItem.get(item.item_seq) ?? []
  }));
}

export async function getAdminSpecialList(opts: {
  kind?: SpecialKind;
  q?: string;
  page: number;
  pageSize: number;
}): Promise<{
  items: AdminSpecialListItem[];
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
  if (opts.kind) {
    parts.push("kind = @kind");
    req.input("kind", sql.NVarChar, opts.kind);
  }
  if (q) {
    parts.push("(title LIKE @q OR public_id LIKE @q)");
    req.input("q", sql.NVarChar, `%${q}%`);
  }
  const where = parts.length ? parts.join(" AND ") : "1=1";

  const countRes = await req.query<{ total: number }>(`
    SELECT COUNT(*) AS total FROM dbo.web_special WHERE ${where}
  `);
  const total = countRes.recordset[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const listReq = pool.request();
  if (opts.kind) listReq.input("kind", sql.NVarChar, opts.kind);
  if (q) listReq.input("q", sql.NVarChar, `%${q}%`);
  listReq.input("offset", sql.Int, offset);
  listReq.input("pageSize", sql.Int, pageSize);

  const listRes = await listReq.query<SpecialRow>(`
    SELECT seq, public_id, kind, title, date_label, img_main, booking_url, list_order
    FROM dbo.web_special
    WHERE ${where}
    ORDER BY list_order DESC, seq DESC
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

export async function getAdminSpecialByPublicId(
  publicId: string
): Promise<AdminSpecialDetail | null> {
  const pool = await getPool();
  const main = await pool
    .request()
    .input("publicId", sql.NVarChar, publicId)
    .query<SpecialRow>(`
      SELECT seq, public_id, kind, title, date_label, body, img_main, booking_url, list_order
      FROM dbo.web_special WHERE public_id = @publicId
    `);
  const row = main.recordset[0];
  if (!row) return null;

  const films = row.kind === "exhibition" ? await loadFilms(pool, row.seq) : [];

  return {
    seq: row.seq,
    publicId: row.public_id,
    kind: row.kind as SpecialKind,
    title: row.title,
    dateLabel: row.date_label?.trim() || null,
    body: row.body?.trim() || "",
    imgMain: row.img_main?.trim() || "",
    bookingUrl: row.booking_url?.trim() || "",
    listOrder: row.list_order,
    films
  };
}

export type CreateSpecialInput = {
  publicId: string;
  kind: SpecialKind;
  title: string;
  dateLabel?: string | null;
  body?: string | null;
  imgMain?: string | null;
  bookingUrl?: string | null;
  listOrder?: number;
  films?: AdminSpecialFilmItem[];
};

export async function createAdminSpecial(input: CreateSpecialInput): Promise<AdminSpecialDetail> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const insertRes = await new sql.Request(transaction)
      .input("publicId", sql.NVarChar, input.publicId)
      .input("kind", sql.NVarChar, input.kind)
      .input("title", sql.NVarChar, input.title)
      .input("dateLabel", sql.NVarChar, input.dateLabel ?? null)
      .input("body", sql.NVarChar(sql.MAX), input.body ?? null)
      .input("imgMain", sql.NVarChar, input.imgMain ?? null)
      .input("bookingUrl", sql.NVarChar, input.bookingUrl ?? null)
      .input("listOrder", sql.Int, input.listOrder ?? 0)
      .query<{ seq: number }>(`
        INSERT INTO dbo.web_special (public_id, kind, title, date_label, body, img_main, booking_url, list_order)
        OUTPUT INSERTED.seq
        VALUES (@publicId, @kind, @title, @dateLabel, @body, @imgMain, @bookingUrl, @listOrder)
      `);

    const seq = insertRes.recordset[0]?.seq;
    if (!seq) throw new Error("INSERT 실패");

    if (input.kind === "exhibition" && input.films?.length) {
      await replaceFilms(transaction, seq, input.films);
    }

    await transaction.commit();
    const detail = await getAdminSpecialByPublicId(input.publicId);
    if (!detail) throw new Error("생성 후 조회 실패");
    return detail;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function replaceFilms(
  transaction: sql.Transaction,
  specialSeq: number,
  films: AdminSpecialFilmItem[]
): Promise<void> {
  await new sql.Request(transaction)
    .input("seq", sql.Int, specialSeq)
    .query(`DELETE FROM dbo.web_special_item WHERE special_seq = @seq`);

  for (let i = 0; i < films.length; i++) {
    const film = films[i];
    const itemRes = await new sql.Request(transaction)
      .input("specialSeq", sql.Int, specialSeq)
      .input("sortOrder", sql.Int, i)
      .input("title", sql.NVarChar, film.title || null)
      .input("isEmptySpacer", sql.Bit, film.isEmptySpacer ? 1 : 0)
      .input("imgPath", sql.NVarChar, film.image || null)
      .input("titleEn", sql.NVarChar, film.titleEn || null)
      .input("info", sql.NVarChar, film.info || null)
      .input("runningTimeLabel", sql.NVarChar, film.runningTimeLabel || null)
      .input("director", sql.NVarChar, film.director || null)
      .input("castNames", sql.NVarChar, film.cast || null)
      .input("description", sql.NVarChar(sql.MAX), film.description || null)
      .input("sectionName", sql.NVarChar, film.sectionName || null)
      .query<{ item_seq: number }>(`
        INSERT INTO dbo.web_special_item (
          special_seq, sort_order, title, is_empty_spacer, img_path,
          title_en, info, running_time_label, director, cast_names, description, section_name
        )
        OUTPUT INSERTED.item_seq
        VALUES (
          @specialSeq, @sortOrder, @title, @isEmptySpacer, @imgPath,
          @titleEn, @info, @runningTimeLabel, @director, @castNames, @description, @sectionName
        )
      `);

    const itemSeq = itemRes.recordset[0]?.item_seq;
    if (!itemSeq || !film.screenings?.length) continue;

    for (let j = 0; j < film.screenings.length; j++) {
      const sc = film.screenings[j];
      await new sql.Request(transaction)
        .input("itemSeq", sql.Int, itemSeq)
        .input("dateSc", sql.Char(10), sc.date)
        .input("timeSc", sql.Char(5), sc.time)
        .input("isGv", sql.Bit, sc.gv ? 1 : 0)
        .input("sortOrder", sql.Int, j)
        .query(`
          INSERT INTO dbo.web_special_screening (item_seq, date_sc, time_sc, is_gv, sort_order)
          VALUES (@itemSeq, @dateSc, @timeSc, @isGv, @sortOrder)
        `);
    }
  }
}

export type UpdateSpecialInput = {
  title?: string;
  dateLabel?: string | null;
  body?: string | null;
  imgMain?: string | null;
  bookingUrl?: string | null;
  listOrder?: number;
  films?: AdminSpecialFilmItem[];
};

export async function updateAdminSpecial(
  publicId: string,
  input: UpdateSpecialInput
): Promise<AdminSpecialDetail | null> {
  const pool = await getPool();
  const existing = await getAdminSpecialByPublicId(publicId);
  if (!existing) return null;

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const req = new sql.Request(transaction).input("publicId", sql.NVarChar, publicId);
    const fields: string[] = [];

    if (input.title !== undefined) {
      fields.push("title = @title");
      req.input("title", sql.NVarChar, input.title);
    }
    if (input.dateLabel !== undefined) {
      fields.push("date_label = @dateLabel");
      req.input("dateLabel", sql.NVarChar, input.dateLabel);
    }
    if (input.body !== undefined) {
      fields.push("body = @body");
      req.input("body", sql.NVarChar(sql.MAX), input.body);
    }
    if (input.imgMain !== undefined) {
      fields.push("img_main = @imgMain");
      req.input("imgMain", sql.NVarChar, input.imgMain);
    }
    if (input.bookingUrl !== undefined) {
      fields.push("booking_url = @bookingUrl");
      req.input("bookingUrl", sql.NVarChar, input.bookingUrl);
    }
    if (input.listOrder !== undefined) {
      fields.push("list_order = @listOrder");
      req.input("listOrder", sql.Int, input.listOrder);
    }

    if (fields.length) {
      fields.push("updated_at = SYSUTCDATETIME()");
      await req.query(`UPDATE dbo.web_special SET ${fields.join(", ")} WHERE public_id = @publicId`);
    }

    if (input.films !== undefined && existing.kind === "exhibition") {
      await replaceFilms(transaction, existing.seq, input.films);
    }

    await transaction.commit();
    return getAdminSpecialByPublicId(publicId);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function deleteAdminSpecial(publicId: string): Promise<boolean> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input("publicId", sql.NVarChar, publicId)
    .query(`DELETE FROM dbo.web_special WHERE public_id = @publicId`);
  return (res.rowsAffected[0] ?? 0) > 0;
}

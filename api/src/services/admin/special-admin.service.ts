import { randomUUID } from "node:crypto";
import sql from "mssql";
import { getPool } from "../../db/pool.js";
import { DEFAULT_BOOKING_URL, type SpecialKind } from "../special.service.js";
import {
  deleteSpecialSpFiles,
  finalizeSpecialItemImage,
  finalizeSpecialMainImage
} from "./special-assets.service.js";

/** dbo.web_special / web_special_item NVARCHAR 컬럼 길이 — 초과 시 SQL Server truncation 오류 */
export const SPECIAL_FIELD_LIMITS = {
  publicId: 20,
  title: 500,
  dateLabel: 300,
  imgMain: 500,
  itemTitle: 300,
  imgPath: 500,
  titleEn: 300,
  info: 300,
  runningTimeLabel: 120,
  director: 200,
  cast: 1000,
  sectionName: 200,
  dateSc: 10,
  timeSc: 5
} as const;

function clipText(val: string | null | undefined, max: number): string | null {
  if (val == null) return null;
  const s = String(val);
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function makeTempPublicId(): string {
  return `t${randomUUID().replace(/-/g, "").slice(0, 19)}`;
}

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
    parts.push("(title LIKE @q OR public_id LIKE @q OR CAST(seq AS NVARCHAR(20)) LIKE @q)");
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

function mapAdminDetail(row: SpecialRow, films: AdminSpecialFilmItem[]): AdminSpecialDetail {
  return {
    seq: row.seq,
    publicId: row.public_id,
    kind: row.kind as SpecialKind,
    title: row.title,
    dateLabel: row.date_label?.trim() || null,
    body: row.body?.trim() || "",
    imgMain: row.img_main?.trim() || "",
    bookingUrl: row.booking_url?.trim() || DEFAULT_BOOKING_URL,
    listOrder: row.list_order,
    films
  };
}

function formatPublicId(kind: SpecialKind, seq: number): string {
  const n = String(seq).padStart(6, "0");
  return kind === "event" ? `ev${n}` : `e${n}`;
}

async function getNextListOrder(req: sql.Request): Promise<number> {
  const res = await req.query<{ nextOrder: number }>(`
    SELECT ISNULL(MAX(list_order), 0) + 1 AS nextOrder FROM dbo.web_special
  `);
  return res.recordset[0]?.nextOrder ?? 1;
}

export async function getAdminSpecialBySeq(seq: number): Promise<AdminSpecialDetail | null> {
  const pool = await getPool();
  const main = await pool.request().input("seq", sql.Int, seq).query<SpecialRow>(`
      SELECT seq, public_id, kind, title, date_label, body, img_main, booking_url, list_order
      FROM dbo.web_special WHERE seq = @seq
    `);
  const row = main.recordset[0];
  if (!row) return null;

  const films = row.kind === "exhibition" ? await loadFilms(pool, row.seq) : [];
  return mapAdminDetail(row, films);
}

export type SpecialFilmInput = AdminSpecialFilmItem & {
  imageTempPath?: string | null;
  removeImage?: boolean;
};

export type SpecialImageInput = {
  mainImageTempPath?: string | null;
  removeMainImage?: boolean;
};

export type CreateSpecialInput = SpecialImageInput & {
  kind: SpecialKind;
  title: string;
  dateLabel?: string | null;
  body?: string | null;
  imgMain?: string | null;
  films?: SpecialFilmInput[];
};

export type UpdateSpecialInput = SpecialImageInput & {
  title?: string;
  dateLabel?: string | null;
  body?: string | null;
  imgMain?: string | null;
  films?: SpecialFilmInput[];
};

function normalizeSpecialFilms(films: SpecialFilmInput[] | undefined): SpecialFilmInput[] | undefined {
  if (!films) return films;
  return films.map((film) => ({
    ...film,
    title: clipText(film.title, SPECIAL_FIELD_LIMITS.itemTitle) ?? "",
    image: clipText(film.image, SPECIAL_FIELD_LIMITS.imgPath) ?? "",
    titleEn: clipText(film.titleEn, SPECIAL_FIELD_LIMITS.titleEn) ?? "",
    info: clipText(film.info, SPECIAL_FIELD_LIMITS.info) ?? "",
    runningTimeLabel: clipText(film.runningTimeLabel, SPECIAL_FIELD_LIMITS.runningTimeLabel) ?? "",
    director: clipText(film.director, SPECIAL_FIELD_LIMITS.director) ?? "",
    cast: clipText(film.cast, SPECIAL_FIELD_LIMITS.cast) ?? "",
    sectionName: clipText(film.sectionName, SPECIAL_FIELD_LIMITS.sectionName) ?? "",
    screenings: film.screenings?.map((sc) => ({
      ...sc,
      date: clipText(sc.date, SPECIAL_FIELD_LIMITS.dateSc) ?? "",
      time: (clipText(sc.time, SPECIAL_FIELD_LIMITS.timeSc) ?? "").slice(0, SPECIAL_FIELD_LIMITS.timeSc)
    }))
  }));
}

function normalizeSpecialInput<T extends CreateSpecialInput | UpdateSpecialInput>(input: T): T {
  const out = { ...input };
  if ("title" in out && out.title !== undefined) {
    out.title = clipText(out.title, SPECIAL_FIELD_LIMITS.title) ?? "";
  }
  if (out.dateLabel !== undefined) out.dateLabel = clipText(out.dateLabel, SPECIAL_FIELD_LIMITS.dateLabel);
  if (out.imgMain !== undefined) out.imgMain = clipText(out.imgMain, SPECIAL_FIELD_LIMITS.imgMain);
  if (out.films !== undefined) out.films = normalizeSpecialFilms(out.films);
  return out;
}

export async function createAdminSpecial(input: CreateSpecialInput): Promise<AdminSpecialDetail> {
  const data = normalizeSpecialInput(input);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const insertReq = new sql.Request(transaction);
    const listOrder = await getNextListOrder(insertReq);
    const tempPublicId = makeTempPublicId();

    const insertRes = await insertReq
      .input("publicId", sql.NVarChar, tempPublicId)
      .input("kind", sql.NVarChar, data.kind)
      .input("title", sql.NVarChar, data.title)
      .input("dateLabel", sql.NVarChar, data.dateLabel ?? null)
      .input("body", sql.NVarChar(sql.MAX), data.body ?? null)
      .input("imgMain", sql.NVarChar, null)
      .input("bookingUrl", sql.NVarChar, DEFAULT_BOOKING_URL)
      .input("listOrder", sql.Int, listOrder)
      .query<{ seq: number }>(`
        INSERT INTO dbo.web_special (public_id, kind, title, date_label, body, img_main, booking_url, list_order)
        OUTPUT INSERTED.seq
        VALUES (@publicId, @kind, @title, @dateLabel, @body, @imgMain, @bookingUrl, @listOrder)
      `);

    const seq = insertRes.recordset[0]?.seq;
    if (!seq) throw new Error("INSERT 실패");

    const publicId = formatPublicId(data.kind, seq);
    await new sql.Request(transaction)
      .input("seq", sql.Int, seq)
      .input("publicId", sql.NVarChar, publicId)
      .query(`UPDATE dbo.web_special SET public_id = @publicId WHERE seq = @seq`);

    const imgMain = await finalizeSpecialMainImage({
      seq,
      mainImageTempPath: data.mainImageTempPath,
      removeMainImage: data.removeMainImage,
      existingMain: data.imgMain ?? null
    });
    if (imgMain) {
      await new sql.Request(transaction)
        .input("seq", sql.Int, seq)
        .input("imgMain", sql.NVarChar, imgMain)
        .query(`UPDATE dbo.web_special SET img_main = @imgMain WHERE seq = @seq`);
    }

    if (data.kind === "exhibition" && data.films?.length) {
      await replaceFilmsWithAssets(transaction, seq, data.films);
    }

    await transaction.commit();
    const detail = await getAdminSpecialBySeq(seq);
    if (!detail) throw new Error("생성 후 조회 실패");
    return detail;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function replaceFilmsWithAssets(
  transaction: sql.Transaction,
  specialSeq: number,
  films: SpecialFilmInput[]
): Promise<void> {
  await new sql.Request(transaction)
    .input("seq", sql.Int, specialSeq)
    .query(`DELETE FROM dbo.web_special_item WHERE special_seq = @seq`);

  for (let i = 0; i < films.length; i++) {
    const film = films[i];
    const pendingAsset = !!(film.imageTempPath || film.removeImage);
    const initialImg = pendingAsset ? null : film.image || null;

    const itemRes = await new sql.Request(transaction)
      .input("specialSeq", sql.Int, specialSeq)
      .input("sortOrder", sql.Int, i)
      .input("title", sql.NVarChar, film.title || null)
      .input("isEmptySpacer", sql.Bit, film.isEmptySpacer ? 1 : 0)
      .input("imgPath", sql.NVarChar, initialImg)
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
    if (!itemSeq) continue;

    const finalImg = await finalizeSpecialItemImage({
      specialSeq,
      itemSeq,
      imageTempPath: film.imageTempPath,
      removeImage: film.removeImage,
      existingImage: pendingAsset ? null : film.image || null
    });

    if (finalImg !== initialImg) {
      await new sql.Request(transaction)
        .input("itemSeq", sql.Int, itemSeq)
        .input("imgPath", sql.NVarChar, finalImg)
        .query(`UPDATE dbo.web_special_item SET img_path = @imgPath WHERE item_seq = @itemSeq`);
    }

    if (!film.screenings?.length) continue;

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

export async function updateAdminSpecial(
  seq: number,
  input: UpdateSpecialInput
): Promise<AdminSpecialDetail | null> {
  const data = normalizeSpecialInput(input);
  const pool = await getPool();
  const existing = await getAdminSpecialBySeq(seq);
  if (!existing) return null;

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const req = new sql.Request(transaction).input("seq", sql.Int, seq);
    const fields: string[] = [];

    if (data.title !== undefined) {
      fields.push("title = @title");
      req.input("title", sql.NVarChar, data.title);
    }
    if (data.dateLabel !== undefined) {
      fields.push("date_label = @dateLabel");
      req.input("dateLabel", sql.NVarChar, data.dateLabel);
    }
    if (data.body !== undefined) {
      fields.push("body = @body");
      req.input("body", sql.NVarChar(sql.MAX), data.body);
    }
    if (data.mainImageTempPath !== undefined || data.removeMainImage) {
      const imgMain = await finalizeSpecialMainImage({
        seq: existing.seq,
        mainImageTempPath: data.mainImageTempPath,
        removeMainImage: data.removeMainImage,
        existingMain: existing.imgMain
      });
      fields.push("img_main = @imgMain");
      req.input("imgMain", sql.NVarChar, imgMain);
    } else if (data.imgMain !== undefined) {
      fields.push("img_main = @imgMain");
      req.input("imgMain", sql.NVarChar, data.imgMain);
    }
    fields.push("booking_url = @bookingUrl");
    req.input("bookingUrl", sql.NVarChar, DEFAULT_BOOKING_URL);
    if (fields.length) {
      fields.push("updated_at = SYSUTCDATETIME()");
      await req.query(`UPDATE dbo.web_special SET ${fields.join(", ")} WHERE seq = @seq`);
    }

    if (data.films !== undefined && existing.kind === "exhibition") {
      await replaceFilmsWithAssets(transaction, existing.seq, data.films);
    }

    await transaction.commit();
    return getAdminSpecialBySeq(seq);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function deleteAdminSpecial(seq: number): Promise<boolean> {
  const pool = await getPool();

  const existingRes = await pool.request().input("seq", sql.Int, seq).query<{
    seq: number;
    img_main: string | null;
    img_path: string | null;
  }>(`
    SELECT s.seq, s.img_main, i.img_path
    FROM dbo.web_special s
    LEFT JOIN dbo.web_special_item i ON i.special_seq = s.seq
    WHERE s.seq = @seq
  `);

  const existingRows = existingRes.recordset;
  if (!existingRows.length) return false;

  const imagePaths = existingRows.flatMap((row) =>
    [row.img_main, row.img_path].filter((p): p is string => !!p?.trim())
  );

  const res = await pool
    .request()
    .input("seq", sql.Int, seq)
    .query(`DELETE FROM dbo.web_special WHERE seq = @seq`);

  const deleted = (res.rowsAffected[0] ?? 0) > 0;
  if (deleted) {
    await deleteSpecialSpFiles(seq, imagePaths);
  }
  return deleted;
}

/**
 * 화면 표시 순서(위→아래)로 seq 배열을 받아 list_order를 재할당.
 * 해당 seq들의 기존 list_order 값(내림차순)을 그대로 재사용한다.
 */
export async function reorderAdminSpecialList(orderedSeqs: number[]): Promise<{ ok: true; count: number }> {
  const seqs = Array.from(
    new Set(
      orderedSeqs
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  );
  if (seqs.length < 2) {
    return { ok: true, count: seqs.length };
  }

  const pool = await getPool();
  const req = pool.request();
  const placeholders = seqs.map((_, i) => {
    const name = `seq${i}`;
    req.input(name, sql.Int, seqs[i]);
    return `@${name}`;
  });

  const current = await req.query<{ seq: number; list_order: number }>(`
    SELECT seq, list_order
    FROM dbo.web_special
    WHERE seq IN (${placeholders.join(", ")})
  `);

  if (current.recordset.length !== seqs.length) {
    throw new Error("REORDER_SEQ_MISMATCH");
  }

  const orders = current.recordset
    .map((r) => Number(r.list_order) || 0)
    .sort((a, b) => b - a);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (let i = 0; i < seqs.length; i++) {
      await new sql.Request(transaction)
        .input("seq", sql.Int, seqs[i])
        .input("listOrder", sql.Int, orders[i])
        .query(`
          UPDATE dbo.web_special
          SET list_order = @listOrder, updated_at = SYSUTCDATETIME()
          WHERE seq = @seq
        `);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return { ok: true, count: seqs.length };
}

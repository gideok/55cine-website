/**
 * special/exhibition/data, special/event/data JSON → web_special / web_special_item / web_special_screening
 * 이미지: images/special/sp/sp_{mainSeq}_main.{ext}, sp_{mainSeq}_{itemSeq}.{ext}
 *
 * Usage:
 *   node scripts/migrate-special-program.mjs           # dry-run
 *   node scripts/migrate-special-program.mjs --execute
 *   node scripts/migrate-special-program.mjs --execute --force  # 기존 public_id 삭제 후 재적재
 *   node scripts/migrate-special-program.mjs --backfill-info --execute  # info 통합문자열 → 세분화 컬럼
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import { getSqlConfig } from "./db-config.mjs";
import { parseFilmInfoLine } from "./special-film-info-parse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SP_IMG_DIR = path.join(ROOT, "images", "special", "sp");
const EXH_DATA_DIR = path.join(ROOT, "special", "exhibition", "data");
const EXH_IMAGES_DIR = path.join(ROOT, "special", "exhibition", "images");
const EVT_DATA_DIR = path.join(ROOT, "special", "event", "data");

const execute = process.argv.includes("--execute");
const force = process.argv.includes("--force");
const backfillInfo = process.argv.includes("--backfill-info");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function extractDateLabel(title) {
  const t = String(title || "").trim();
  const patterns = [
    /(\d{2}\/\d{2}\([^)]+\)[\s\S]*)$/u,
    /(\d{1,2}\/\d{1,2}\([^)]+\)[\s\S]*)$/u,
    /(\d{4}-\d{2}-\d{2}[\s\S]*)$/u
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function listOrderFromPublicId(publicId, kind) {
  const m = String(publicId).match(/(\d+)$/);
  if (!m) return 0;
  const n = Number(m[1]);
  return kind === "exhibition" ? n : 10000 + n;
}

function resolveSourceFile(imagePath, kind) {
  if (!imagePath) return null;
  const rel = String(imagePath).replace(/^\//, "");
  const candidates = [];
  if (/^https?:\/\//i.test(rel)) return null;
  if (rel.startsWith("images/special/")) {
    candidates.push(path.join(ROOT, rel));
  } else if (rel.startsWith("images/")) {
    if (kind === "exhibition") {
      candidates.push(path.join(EXH_IMAGES_DIR, path.basename(rel)));
      candidates.push(path.join(ROOT, "special", "exhibition", rel));
    }
    if (kind === "event") {
      candidates.push(path.join(ROOT, "images", "special", "event", path.basename(rel)));
    }
    candidates.push(path.join(ROOT, rel));
  } else {
    candidates.push(path.join(EXH_IMAGES_DIR, rel));
    candidates.push(path.join(ROOT, rel));
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function dbImagePath(mainSeq, itemSeq, srcPath) {
  const ext = (path.extname(srcPath || "") || ".jpg").toLowerCase();
  if (itemSeq == null) {
    return `images/special/sp/sp_${mainSeq}_main${ext}`;
  }
  return `images/special/sp/sp_${mainSeq}_${itemSeq}${ext}`;
}

async function copyImage(src, destRel) {
  if (!src) return null;
  const destAbs = path.join(ROOT, destRel.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  if (!execute) return destRel;
  fs.copyFileSync(src, destAbs);
  return destRel;
}

function loadExhibitionFiles() {
  if (!fs.existsSync(EXH_DATA_DIR)) return [];
  return fs
    .readdirSync(EXH_DATA_DIR)
    .filter((f) => /^exhibition-e\d+\.json$/i.test(f))
    .sort()
    .map((f) => ({
      kind: "exhibition",
      filePath: path.join(EXH_DATA_DIR, f),
      data: readJson(path.join(EXH_DATA_DIR, f))
    }));
}

function loadEventFiles() {
  if (!fs.existsSync(EVT_DATA_DIR)) return [];
  return fs
    .readdirSync(EVT_DATA_DIR)
    .filter((f) => /^event-ev\d+\.json$/i.test(f))
    .sort()
    .map((f) => ({
      kind: "event",
      filePath: path.join(EVT_DATA_DIR, f),
      data: readJson(path.join(EVT_DATA_DIR, f))
    }));
}

async function deleteByPublicId(tx, publicId) {
  await new sql.Request(tx)
    .input("publicId", sql.NVarChar, publicId)
    .query(`DELETE FROM dbo.web_special WHERE public_id = @publicId`);
}

async function insertSpecial(tx, row) {
  const res = await new sql.Request(tx)
    .input("publicId", sql.NVarChar, row.publicId)
    .input("kind", sql.NVarChar, row.kind)
    .input("title", sql.NVarChar, row.title)
    .input("dateLabel", sql.NVarChar, row.dateLabel)
    .input("body", sql.NVarChar(sql.MAX), row.body)
    .input("imgMain", sql.NVarChar, row.imgMain)
    .input("bookingUrl", sql.NVarChar, row.bookingUrl)
    .input("listOrder", sql.Int, row.listOrder)
    .query(`
      INSERT INTO dbo.web_special (
        public_id, kind, title, date_label, body, img_main, booking_url, list_order
      )
      OUTPUT INSERTED.seq
      VALUES (
        @publicId, @kind, @title, @dateLabel, @body, @imgMain, @bookingUrl, @listOrder
      );
    `);
  return res.recordset[0].seq;
}

function filmInfoFields(rawInfo) {
  return parseFilmInfoLine(rawInfo);
}

async function insertItem(tx, row) {
  const parsed = row.parsedInfo || filmInfoFields(row.rawInfo);
  const res = await new sql.Request(tx)
    .input("specialSeq", sql.Int, row.specialSeq)
    .input("sortOrder", sql.Int, row.sortOrder)
    .input("title", sql.NVarChar, row.title)
    .input("isEmpty", sql.Bit, row.isEmpty ? 1 : 0)
    .input("imgPath", sql.NVarChar, row.imgPath)
    .input("titleEn", sql.NVarChar, parsed.titleEn)
    .input("info", sql.NVarChar, parsed.info)
    .input("runningMinutes", sql.Int, parsed.runningMinutes)
    .input("runningTimeLabel", sql.NVarChar, parsed.runningTimeLabel)
    .input("director", sql.NVarChar, row.director)
    .input("castNames", sql.NVarChar, row.castNames)
    .input("description", sql.NVarChar(sql.MAX), row.description)
    .input("sectionName", sql.NVarChar, row.sectionName)
    .query(`
      INSERT INTO dbo.web_special_item (
        special_seq, sort_order, title, is_empty_spacer,
        img_path, title_en, info, running_minutes, running_time_label,
        director, cast_names, description, section_name
      )
      OUTPUT INSERTED.item_seq
      VALUES (
        @specialSeq, @sortOrder, @title, @isEmpty,
        @imgPath, @titleEn, @info, @runningMinutes, @runningTimeLabel,
        @director, @castNames, @description, @sectionName
      );
    `);
  return res.recordset[0].item_seq;
}

async function backfillItemInfoRows(pool) {
  const rows = await pool.request().query(`
    SELECT item_seq, info, title_en
    FROM dbo.web_special_item
    WHERE is_empty_spacer = 0
      AND NULLIF(LTRIM(RTRIM(info)), '') IS NOT NULL
  `);

  let updated = 0;
  for (const row of rows.recordset) {
    const raw = String(row.info || "").trim();
    if (!raw.includes("|") && row.title_en) continue;

    const parsed = parseFilmInfoLine(raw);
    if (!parsed.titleEn && !parsed.info && !parsed.runningTimeLabel) continue;

    if (!execute) {
      console.log("backfill item", row.item_seq, parsed);
      updated += 1;
      continue;
    }

    await pool
      .request()
      .input("itemSeq", sql.Int, row.item_seq)
      .input("titleEn", sql.NVarChar, parsed.titleEn)
      .input("info", sql.NVarChar, parsed.info)
      .input("runningMinutes", sql.Int, parsed.runningMinutes)
      .input("runningTimeLabel", sql.NVarChar, parsed.runningTimeLabel)
      .query(`
        UPDATE dbo.web_special_item
        SET
          title_en = @titleEn,
          info = @info,
          running_minutes = @runningMinutes,
          running_time_label = @runningTimeLabel
        WHERE item_seq = @itemSeq;
      `);
    updated += 1;
  }

  return updated;
}

async function insertScreening(tx, row) {
  await new sql.Request(tx)
    .input("itemSeq", sql.Int, row.itemSeq)
    .input("dateSc", sql.Char(10), row.dateSc)
    .input("timeSc", sql.Char(5), row.timeSc)
    .input("isGv", sql.Bit, row.isGv ? 1 : 0)
    .input("sortOrder", sql.Int, row.sortOrder)
    .query(`
      INSERT INTO dbo.web_special_screening (item_seq, date_sc, time_sc, is_gv, sort_order)
      VALUES (@itemSeq, @dateSc, @timeSc, @isGv, @sortOrder);
    `);
}

async function migrateOne(tx, entry, stats) {
  const { kind, data } = entry;
  const publicId = String(data.id || "").trim();
  if (!publicId) {
    stats.skip += 1;
    return;
  }

  const exists = await new sql.Request(tx)
    .input("publicId", sql.NVarChar, publicId)
    .query(`SELECT seq FROM dbo.web_special WHERE public_id = @publicId`);

  if (exists.recordset.length && !force) {
    stats.skip += 1;
    console.log("skip (exists):", publicId);
    return;
  }

  if (exists.recordset.length && force) {
    await deleteByPublicId(tx, publicId);
  }

  const title = String(data.title || "").trim();
  const dateLabel = extractDateLabel(title);
  let mainSrc = resolveSourceFile(data.image, kind);
  if (!mainSrc && kind === "event") {
    const numMatch = publicId.match(/(\d+)$/);
    const num = numMatch ? Number(numMatch[1]) : 0;
    if (num > 0) {
      const thumbGuess = path.join(
        ROOT,
        "images",
        "special",
        "event",
        `event_thumb_${String(num).padStart(2, "0")}.jpg`
      );
      if (fs.existsSync(thumbGuess)) mainSrc = thumbGuess;
    }
  }
  let mainSeq = null;

  if (execute) {
    mainSeq = await insertSpecial(tx, {
      publicId,
      kind,
      title,
      dateLabel,
      body: data.introduction || null,
      imgMain: null,
      bookingUrl: data.bookingUrl || null,
      listOrder: listOrderFromPublicId(publicId, kind)
    });
  } else {
    mainSeq = stats.nextFakeSeq++;
  }

  let imgMain = null;
  if (mainSrc) {
    const destRel = dbImagePath(mainSeq, null, mainSrc);
    await copyImage(mainSrc, destRel);
    imgMain = destRel;
    if (execute) {
      await new sql.Request(tx)
        .input("seq", sql.Int, mainSeq)
        .input("imgMain", sql.NVarChar, imgMain)
        .query(`UPDATE dbo.web_special SET img_main = @imgMain WHERE seq = @seq`);
    }
  } else if (data.image) {
    console.warn("  main image missing:", publicId, data.image);
  }

  const films = Array.isArray(data.films) ? data.films : [];
  let filmSort = 0;
  for (const film of films) {
    filmSort += 1;
    const isEmpty = film && film.title === "EmptyFilms";
    const filmSrc = isEmpty ? null : resolveSourceFile(film.image, "exhibition");

    let itemSeq = null;
    if (execute) {
      itemSeq = await insertItem(tx, {
        specialSeq: mainSeq,
        sortOrder: filmSort,
        title: isEmpty ? null : film.title || null,
        isEmpty,
        imgPath: null,
        rawInfo: film.info || null,
        director: film.director || null,
        castNames: film.cast || null,
        description: film.description || null,
        sectionName: film.sectionname || null
      });
    } else {
      itemSeq = filmSort;
    }

    if (filmSrc && !isEmpty) {
      const destRel = dbImagePath(mainSeq, itemSeq, filmSrc);
      await copyImage(filmSrc, destRel);
      if (execute) {
        await new sql.Request(tx)
          .input("itemSeq", sql.Int, itemSeq)
          .input("imgPath", sql.NVarChar, destRel)
          .query(`UPDATE dbo.web_special_item SET img_path = @imgPath WHERE item_seq = @itemSeq`);
      }
    } else if (film.image && !isEmpty) {
      console.warn("  film image missing:", publicId, film.image);
    }

    const screenings = Array.isArray(film.screenings) ? film.screenings : [];
    let scSort = 0;
    for (const sc of screenings) {
      scSort += 1;
      const dateSc = String(sc.date || "").trim();
      const timeSc = String(sc.time || "").trim();
      if (!dateSc || !timeSc) continue;
      if (execute) {
        await insertScreening(tx, {
          itemSeq,
          dateSc,
          timeSc: timeSc.length >= 5 ? timeSc.slice(0, 5) : timeSc,
          isGv: !!sc.gv,
          sortOrder: scSort
        });
      }
    }
  }

  stats.ok += 1;
  console.log(
    `${execute ? "ok" : "dry"} ${kind} ${publicId} seq=${mainSeq} films=${films.length} main=${imgMain || "(none)"}`
  );
}

async function main() {
  const cfg = getSqlConfig();
  if (!cfg?.server || !cfg?.user) {
    console.error("DB 설정 없음 (프로젝트 루트 .env)");
    process.exit(1);
  }

  if (backfillInfo) {
    const pool = await sql.connect(cfg);
    const n = await backfillItemInfoRows(pool);
    await pool.close();
    console.log(
      "backfill-info:",
      execute ? "applied" : "dry-run",
      "rows:",
      n
    );
    return;
  }

  const entries = [...loadExhibitionFiles(), ...loadEventFiles()];
  if (!entries.length) {
    console.error("마이그레이션할 JSON 없음");
    process.exit(1);
  }

  console.log("Mode:", execute ? "EXECUTE" : "DRY-RUN", force ? "+ FORCE" : "");
  console.log("Entries:", entries.length);

  const stats = { ok: 0, skip: 0, nextFakeSeq: 900000 };

  if (!execute) {
    for (const entry of entries) {
      await migrateOne(null, entry, stats);
    }
    console.log("\nDone (dry-run). Use --execute to apply.");
    console.log(stats);
    return;
  }

  const pool = await sql.connect(cfg);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const entry of entries) {
      await migrateOne(tx, entry, stats);
    }
    await tx.commit();
    console.log("\nCommitted.", stats);
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

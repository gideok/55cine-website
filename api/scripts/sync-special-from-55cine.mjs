/**
 * 55cine.com 기획전 목록·상세 → web_special / web_special_item / web_special_screening
 *
 * Usage:
 *   node scripts/sync-special-from-55cine.mjs --url http://55cine.com/2026/04/03/under03/ --public-id e000001
 *   node scripts/sync-special-from-55cine.mjs --sync-page          # /special/ 상단 10건
 *   node scripts/sync-special-from-55cine.mjs --sync-category --from-page=1 --to-page=35 --purge-exhibition --execute
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import sharp from "sharp";
import { getSqlConfig } from "./db-config.mjs";
import { parseFilmInfoLine } from "./special-film-info-parse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SP_DIR = path.join(ROOT, "images", "special", "sp");
const EXH_DATA_DIR = path.join(ROOT, "special", "exhibition", "data");
const BOOKING_DEFAULT =
  "https://www.dtryx.com/cinema/main.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059";

const execute = process.argv.includes("--execute");
const syncPage = process.argv.includes("--sync-page");
const syncCategory = process.argv.includes("--sync-category");
const purgeExhibition = process.argv.includes("--purge-exhibition");
const urlArg = process.argv.find((a) => a.startsWith("--url="))?.split("=")[1];
const publicIdArg = process.argv.find((a) => a.startsWith("--public-id="))?.split("=")[1];

function readIntArg(name, fallback) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const fromPage = readIntArg("from-page", 1);
const toPage = readIntArg("to-page", 35);
const fetchDelayMs = readIntArg("delay-ms", 250);

function decodeHtml(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizeWpImageUrl(url) {
  if (!url) return "";
  return String(url)
    .replace(/^https?:\/\/i[0-9]\.wp\.com\/55cine\.com\//i, "http://55cine.com/")
    .replace(/\?.*$/, "");
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "55cine-website-sync/1.0" },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function yearFromPostUrl(url) {
  const m = String(url).match(/\/(\d{4})\/\d{2}\/\d{2}\//);
  return m ? Number(m[1]) : new Date().getFullYear();
}

function extractDateLabel(title, extraDateText) {
  const extra = String(extraDateText || "").trim();
  if (extra) return extra.replace(/\s+/g, " ").trim();

  const t = String(title || "").trim();
  const patterns = [
    /(\d{2}\/\d{2}\([^)]+\)(?:\s*~\s*\d{1,2}\/\d{1,2}\([^)]+\))?[\s\S]*)$/u,
    /(\d{1,2}\/\d{1,2}\([^)]+\)(?:\s*~\s*\d{1,2}\/\d{1,2}\([^)]+\))?[\s\S]*)$/u,
    /(\d{2}\/\d{2}\([^)]+\)[\s\S]*)$/u,
    /(\d{1,2}\/\d{1,2}\([^)]+\)[\s\S]*)$/u
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function parseEntryTitleHtml(html) {
  const m = html.match(/<h2[^>]*class="entry-title"[^>]*>([\s\S]*?)<\/h2>/i);
  if (!m) return { title: null, dateFromFont: null };

  let raw = m[1];
  let dateFromFont = null;
  const fontClosed = raw.match(/<font[^>]*>([\s\S]*?)<\/font>/i);
  if (fontClosed) {
    dateFromFont = stripTags(fontClosed[1].replace(/<br\s*\/?>/gi, " ")).trim() || null;
    raw = raw.replace(/<font[\s\S]*?<\/font>/gi, "");
  } else {
    const fontOpen = raw.match(/<font[^>]*>([\s\S]*)$/i);
    if (fontOpen) {
      dateFromFont = stripTags(fontOpen[1].replace(/<br\s*\/?>/gi, " ")).trim() || null;
      raw = raw.replace(/<font[^>]*>[\s\S]*$/i, "");
    }
  }

  raw = raw.replace(/<br\s*\/?>/gi, " ");
  raw = raw.replace(/<\/br>/gi, " ");

  const bracketTokens = [];
  raw = raw.replace(/<([^\s\/<>][^<>]*)>/g, (_, inner) => {
    const t = inner.trim();
    if (!t || /^font$/i.test(t)) return " ";
    const token = `\u0000BRK${bracketTokens.length}\u0000`;
    bracketTokens.push(`<${t}>`);
    return token;
  });
  raw = raw.replace(/<\/[^>]+>/g, "");

  let title = decodeHtml(stripTags(raw)).replace(/\s+/g, " ").trim();
  for (let i = 0; i < bracketTokens.length; i++) {
    title = title.replace(`\u0000BRK${i}\u0000`, bracketTokens[i]);
  }
  return { title, dateFromFont };
}

function extractEntryContentHtml(html) {
  const m = html.match(
    /<div class="entry-content">([\s\S]*?)<\/div>\s*<nav class="navigation post-navigation"/i
  );
  return m ? m[1] : "";
}

function htmlBlockToPlainText(html) {
  let content = String(html || "");
  content = content.replace(/<br\s*\/?>/gi, "\n");
  content = content.replace(/<\/p>/gi, "\n");
  content = content.replace(/<hr[^>]*>/gi, "\n");
  content = content.replace(/<\/h[1-6]>/gi, "\n");
  content = content.replace(/<\/tr>/gi, "\n");
  content = content.replace(/<\/li>/gi, "\n");
  content = content.replace(/<td[^>]*>/gi, " ");
  content = content.replace(/<th[^>]*>/gi, " ");
  return decodeHtml(stripTags(content))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractIntroduction(html) {
  let entry = extractEntryContentHtml(html);
  if (!entry) {
    const alertMatch = html.match(/class="stag-alert[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    return alertMatch ? stripTags(alertMatch[1]) : "";
  }

  entry = entry.replace(/<div class="wp-block-image">[\s\S]*?<\/div>/gi, "");
  entry = entry.replace(/<div id=['"]jp-relatedposts['"][\s\S]*?<\/div>/gi, "");
  return htmlBlockToPlainText(entry);
}

function parseScheduleFromToggleTitle(text, year) {
  const re = /(\d{1,2})\/(\d{1,2})\([^)]*\)\s*(\d{1,2}:\d{2})/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const mm = String(m[1]).padStart(2, "0");
    const dd = String(m[2]).padStart(2, "0");
    out.push({
      date: `${year}-${mm}-${dd}`,
      time: m[3].length >= 5 ? m[3].slice(0, 5) : m[3],
      gv: /GV/i.test(text)
    });
  }
  return out;
}

function parseFigcaption(figHtml) {
  const raw = stripTags(figHtml.replace(/<br\s*\/?>/gi, "\n"));
  const lines = figHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => decodeHtml(l).trim())
    .filter(Boolean);

  let titleKo = "";
  let titleEn = "";
  let year = "";
  let genre = "";
  let minutes = "";
  let rating = "";
  let description = "";

  const head = lines[0] || raw;
  const pipeParts = head.split("|").map((s) => s.trim());
  if (pipeParts[0]) {
    const koEn = pipeParts[0].match(/^(.+?)\s*\(\s*([^,]+)\s*,\s*(\d{4})\s*\)/u);
    if (koEn) {
      titleKo = koEn[1].trim();
      titleEn = koEn[2].trim();
      year = koEn[3].trim();
    } else {
      titleKo = pipeParts[0].replace(/\s*\([^)]*\)\s*$/, "").trim();
    }
  }
  if (pipeParts[1]) genre = pipeParts[1];
  if (pipeParts[2]) minutes = pipeParts[2].replace(/[^\d분초\s]/g, "").trim() || pipeParts[2];
  if (pipeParts[3]) rating = pipeParts[3];

  const minMatch = head.match(/(\d+)\s*분/u);
  if (minMatch && !minutes) minutes = `${minMatch[1]}분`;

  description = lines.slice(1).join(" ").trim();
  if (!description) {
    const afterRating = raw.split(rating).pop();
    if (rating && afterRating) description = afterRating.trim();
  }

  const infoLine = buildInfoLine(titleEn, year, genre, minutes, rating);
  const parsed = parseFilmInfoLine(infoLine);

  return {
    titleKo,
    titleEn: parsed.titleEn || titleEn,
    info: parsed.info || genre,
    runningMinutes: parsed.runningMinutes,
    runningTimeLabel: parsed.runningTimeLabel || minutes,
    description
  };
}

function buildInfoLine(titleEn, year, genre, minutes, rating) {
  const chunks = [];
  if (titleEn) chunks.push(year ? `${titleEn} ,${year}` : titleEn);
  if (genre) chunks.push(genre);
  if (minutes) chunks.push(minutes);
  if (rating) chunks.push(rating);
  return chunks.join(" | ");
}

function parseFilmFromFigcaption(figHtml) {
  const flat = figHtml.replace(/<br\s*\/?>/gi, "\n");
  const lines = flat
    .replace(/<strong>/gi, "")
    .replace(/<\/strong>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => decodeHtml(l).trim())
    .filter(Boolean);

  if (!lines.length) return null;

  if (lines[0].includes("|")) {
    const meta = parseFigcaption(figHtml);
    const titleYear = lines[0].split("|")[0].trim();
    const titleMatch =
      titleYear.match(/^(.+?)\s*\(\s*[^,]+,\s*(\d{4})\s*\)/u) ||
      titleYear.match(/^(.+?)\s*\((\d{4})\)/u) ||
      titleYear.match(/^(.+?)\s*\(/u);
    return {
      title: meta.titleKo || (titleMatch ? titleMatch[1].trim() : titleYear),
      titleEn: meta.titleEn,
      info: meta.info,
      runningMinutes: meta.runningMinutes,
      runningTimeLabel: meta.runningTimeLabel,
      director: "",
      cast: "",
      description: meta.description,
      screenings: []
    };
  }

  let title = lines[0];
  const titleYear = title.match(/^(.+?)\s*\((\d{4})\)\s*$/u);
  if (titleYear) title = `${titleYear[1].trim()} (${titleYear[2]})`;

  let director = "";
  let cast = "";
  for (const line of lines.slice(1)) {
    if (/^감독:/.test(line)) director = line.replace(/^감독:\s*/, "").trim();
    if (/^출연:/.test(line)) cast = line.replace(/^출연:\s*/, "").trim();
  }

  let description = "";
  let creditIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^감독:/.test(lines[i]) || /^출연:/.test(lines[i])) creditIdx = i;
  }
  if (creditIdx >= 0) description = lines.slice(creditIdx + 1).join(" ").trim();
  else description = lines.slice(1).join(" ").trim();

  return {
    title,
    titleEn: null,
    info: null,
    runningMinutes: null,
    runningTimeLabel: null,
    director,
    cast,
    description,
    screenings: []
  };
}

function parseStagToggleFilms(html, year) {
  const films = [];
  const toggleRe =
    /stag-toggle-title">((?:&lt;[^&]+&gt;|[^<])+?)<\/span>[\s\S]*?<figure class="aligncenter">([\s\S]*?)<\/figure>/gi;
  let block;
  while ((block = toggleRe.exec(html))) {
    const toggleRaw = decodeHtml(block[1]).trim();
    const figHtml = block[2];
    const titleMatch = toggleRaw.match(/<([^>]+)>/);
    if (!titleMatch) continue;
    const filmTitle = titleMatch[1].trim();
    const screenings = parseScheduleFromToggleTitle(toggleRaw, year);
    const imgMatch = figHtml.match(/<img[^>]+src="([^"]+)"/i);
    const capMatch = figHtml.match(/<figcaption>([\s\S]*?)<\/figcaption>/i);
    const meta = capMatch ? parseFigcaption(capMatch[1]) : {};
    const creditMeta = capMatch ? parseFilmFromFigcaption(capMatch[1]) : null;
    films.push({
      title: meta.titleKo || filmTitle,
      imageUrl: normalizeWpImageUrl(imgMatch?.[1] || ""),
      titleEn: meta.titleEn,
      info: meta.info,
      runningMinutes: meta.runningMinutes,
      runningTimeLabel: meta.runningTimeLabel,
      director: creditMeta?.director || "",
      cast: creditMeta?.cast || "",
      description: meta.description || creditMeta?.description || "",
      screenings
    });
  }
  return films;
}

function parseWpBlockFilms(html) {
  const films = [];
  const entry = extractEntryContentHtml(html) || html;
  const re =
    /<div class="wp-block-image">[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<figcaption>([\s\S]*?)<\/figcaption>[\s\S]*?<\/figure>\s*<\/div>/gi;
  let block;
  while ((block = re.exec(entry))) {
    const parsed = parseFilmFromFigcaption(block[2]);
    if (!parsed?.title) continue;
    films.push({
      ...parsed,
      imageUrl: normalizeWpImageUrl(block[1])
    });
  }
  return films;
}

function mergeFilmLists(stagFilms, wpFilms) {
  if (!stagFilms.length) return wpFilms;
  if (!wpFilms.length) return stagFilms;
  if (stagFilms.length === wpFilms.length) {
    return stagFilms.map((sf, i) => ({
      ...sf,
      imageUrl: wpFilms[i].imageUrl || sf.imageUrl,
      description: sf.description || wpFilms[i].description,
      director: sf.director || wpFilms[i].director,
      cast: sf.cast || wpFilms[i].cast,
      titleEn: sf.titleEn || wpFilms[i].titleEn,
      info: sf.info || wpFilms[i].info,
      runningMinutes: sf.runningMinutes ?? wpFilms[i].runningMinutes,
      runningTimeLabel: sf.runningTimeLabel || wpFilms[i].runningTimeLabel
    }));
  }
  return stagFilms;
}

function parseDetailPage(html, pageUrl) {
  const year = yearFromPostUrl(pageUrl);
  const { title: entryTitle, dateFromFont } = parseEntryTitleHtml(html);
  const ogTitle = decodeHtml(html.match(/property="og:title" content="([^"]*)"/i)?.[1] || "");
  const title = (entryTitle || ogTitle.replace(/\s*\|\s*오오극장\s*$/u, "")).trim();
  const introduction = extractIntroduction(html);
  const ogImage = normalizeWpImageUrl(
    html.match(/property="og:image" content="([^"]*)"/i)?.[1] || ""
  );
  const bookingHref = html.match(/href="(https:\/\/www\.dtryx\.com\/cinema\/main\.do[^"]*)"/i)?.[1];
  const bookingUrl = bookingHref ? decodeHtml(bookingHref) : BOOKING_DEFAULT;

  const stagFilms = parseStagToggleFilms(html, year);
  const wpFilms = parseWpBlockFilms(html);
  const films = mergeFilmLists(stagFilms, wpFilms);

  return { title, dateFromFont, introduction, ogImage, bookingUrl, films, year };
}

function loadSourceUrlMap() {
  const dataPath = path.join(ROOT, "data", "special-program-data.js");
  const text = fs.readFileSync(dataPath, "utf8");
  const map = new Map();
  const re =
    /"id":\s*(\d+)[\s\S]*?"detailUrl":\s*"[^"]*id=([^"]+)"[\s\S]*?"sourceUrl":\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(text))) {
    map.set(m[3].replace(/\/$/, "") + "/", {
      publicId: m[2],
      listOrder: Number(m[1])
    });
  }
  return map;
}

function parseSpecialPageUrls(html) {
  const re = /href="(http:\/\/55cine\.com\/\d{4}\/\d{2}\/\d{2}\/[^"#?]+\/?)"/gi;
  const seen = new Set();
  const urls = [];
  let m;
  while ((m = re.exec(html))) {
    const u = m[1].replace(/\/$/, "") + "/";
    if (seen.has(u)) continue;
    seen.add(u);
    urls.push(u);
  }
  return urls;
}

function categoryPageUrl(page) {
  if (page <= 1) return "http://55cine.com/category/special/";
  return `http://55cine.com/category/special/page/${page}/`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectCategorySpecialUrls(from, to) {
  const all = [];
  const seen = new Set();
  for (let page = from; page <= to; page++) {
    const html = await fetchHtml(categoryPageUrl(page));
    const urls = parseSpecialPageUrls(html);
    console.log(`category page ${page}: ${urls.length} article link(s)`);
    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      all.push(url);
    }
    if (page < to) await sleep(fetchDelayMs);
  }
  return all;
}

function publicIdFromListIndex(index, total) {
  const n = total - index;
  return `e${String(n).padStart(6, "0")}`;
}

async function purgeExhibitionRows(pool) {
  const before = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM dbo.web_special WHERE kind = N'exhibition'
  `);
  const cnt = before.recordset[0]?.cnt ?? 0;
  if (!cnt) {
    console.log("purge: exhibition rows 0 — skip");
    return 0;
  }
  const res = await pool.request().query(`
    DELETE FROM dbo.web_special WHERE kind = N'exhibition'
  `);
  const deleted = res.rowsAffected[0] ?? 0;
  console.log(`purge: deleted exhibition web_special ${deleted} row(s)`);
  return deleted;
}

function purgeExhibitionJsonFiles() {
  if (!fs.existsSync(EXH_DATA_DIR)) return 0;
  const files = fs
    .readdirSync(EXH_DATA_DIR)
    .filter((f) => /^exhibition-e\d+\.json$/i.test(f));
  if (!execute) {
    console.log(`purge-json dry-run: would remove ${files.length} file(s)`);
    return files.length;
  }
  for (const f of files) {
    fs.unlinkSync(path.join(EXH_DATA_DIR, f));
  }
  console.log(`purge-json: removed ${files.length} exhibition JSON file(s)`);
  return files.length;
}

function dbImagePath(mainSeq, itemSeq, ext) {
  const e = (ext || ".jpg").toLowerCase();
  if (itemSeq == null) return `images/special/sp/sp_${mainSeq}_main${e}`;
  return `images/special/sp/sp_${mainSeq}_${itemSeq}${e}`;
}

async function downloadToPath(remoteUrl, destRel) {
  if (!remoteUrl) return null;
  const abs = path.join(ROOT, destRel.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (!execute) return destRel;
  const res = await fetch(remoteUrl, {
    headers: { "User-Agent": "55cine-website-sync/1.0" }
  });
  if (!res.ok) throw new Error(`Image ${res.status} ${remoteUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = path.extname(new URL(remoteUrl).pathname) || ".jpg";
  if (ext === ".webp") {
    await sharp(buf).webp({ quality: 82 }).toFile(abs);
  } else {
    fs.writeFileSync(abs, buf);
  }
  return destRel;
}

async function getSeqByPublicId(pool, publicId) {
  const r = await pool
    .request()
    .input("publicId", sql.NVarChar, publicId)
    .query(`SELECT seq FROM dbo.web_special WHERE public_id = @publicId`);
  return r.recordset[0]?.seq ?? null;
}

async function upsertSpecial(pool, publicId, listOrder, detail, sourceUrl) {
  const dateLabel = extractDateLabel(detail.title, detail.dateFromFont);

  if (!execute) {
    console.log(
      "dry",
      publicId,
      detail.title,
      "films:",
      detail.films.length,
      detail.films.map((f) => f.title).join(", ")
    );
    return 0;
  }

  let seq = await getSeqByPublicId(pool, publicId);

  if (seq) {
    await pool
      .request()
      .input("seq", sql.Int, seq)
      .input("title", sql.NVarChar, detail.title)
      .input("dateLabel", sql.NVarChar, dateLabel)
      .input("body", sql.NVarChar(sql.MAX), detail.introduction)
      .input("bookingUrl", sql.NVarChar, detail.bookingUrl)
      .input("listOrder", sql.Int, listOrder)
      .query(`
        UPDATE dbo.web_special
        SET title = @title, date_label = @dateLabel, body = @body,
            booking_url = @bookingUrl, list_order = @listOrder,
            updated_at = SYSUTCDATETIME()
        WHERE seq = @seq
      `);
    await pool
      .request()
      .input("seq", sql.Int, seq)
      .query(`DELETE FROM dbo.web_special_item WHERE special_seq = @seq`);
  } else {
    const ins = await pool
      .request()
      .input("publicId", sql.NVarChar, publicId)
      .input("title", sql.NVarChar, detail.title)
      .input("dateLabel", sql.NVarChar, dateLabel)
      .input("body", sql.NVarChar(sql.MAX), detail.introduction)
      .input("bookingUrl", sql.NVarChar, detail.bookingUrl)
      .input("listOrder", sql.Int, listOrder)
      .query(`
        INSERT INTO dbo.web_special (
          public_id, kind, title, date_label, body, booking_url, list_order
        )
        OUTPUT INSERTED.seq
        VALUES (
          @publicId, N'exhibition', @title, @dateLabel, @body, @bookingUrl, @listOrder
        )
      `);
    seq = ins.recordset[0].seq;
  }

  let mainImageRel = null;
  const mainExt = path.extname(new URL(detail.ogImage || "http://x/x.jpg").pathname) || ".jpg";
  if (detail.ogImage) {
    mainImageRel = dbImagePath(seq, null, mainExt);
    await downloadToPath(detail.ogImage, mainImageRel);
    await pool
      .request()
      .input("seq", sql.Int, seq)
      .input("img", sql.NVarChar, mainImageRel)
      .query(`UPDATE dbo.web_special SET img_main = @img WHERE seq = @seq`);
  }

  const filmImageRels = [];
  let sort = 0;
  for (const film of detail.films) {
    sort += 1;
    const insItem = await pool
      .request()
      .input("specialSeq", sql.Int, seq)
      .input("sortOrder", sql.Int, sort)
      .input("title", sql.NVarChar, film.title)
      .input("titleEn", sql.NVarChar, film.titleEn)
      .input("info", sql.NVarChar, film.info)
      .input("runningMinutes", sql.Int, film.runningMinutes)
      .input("runningTimeLabel", sql.NVarChar, film.runningTimeLabel)
      .input("director", sql.NVarChar, film.director || null)
      .input("castNames", sql.NVarChar, film.cast || null)
      .input("description", sql.NVarChar(sql.MAX), film.description)
      .query(`
        INSERT INTO dbo.web_special_item (
          special_seq, sort_order, title, is_empty_spacer,
          title_en, info, running_minutes, running_time_label,
          director, cast_names, description, section_name
        )
        OUTPUT INSERTED.item_seq
        VALUES (
          @specialSeq, @sortOrder, @title, 0,
          @titleEn, @info, @runningMinutes, @runningTimeLabel,
          @director, @castNames, @description, NULL
        )
      `);
    const itemSeq = insItem.recordset[0].item_seq;
    let filmImgRel = "";

    if (film.imageUrl) {
      const ext = path.extname(new URL(film.imageUrl).pathname) || ".jpg";
      filmImgRel = dbImagePath(seq, itemSeq, ext === ".png" ? ".jpg" : ext);
      await downloadToPath(film.imageUrl, filmImgRel);
      await pool
        .request()
        .input("itemSeq", sql.Int, itemSeq)
        .input("img", sql.NVarChar, filmImgRel)
        .query(`UPDATE dbo.web_special_item SET img_path = @img WHERE item_seq = @itemSeq`);
    }
    filmImageRels.push(filmImgRel);

    let scSort = 0;
    for (const sc of film.screenings) {
      scSort += 1;
      await pool
        .request()
        .input("itemSeq", sql.Int, itemSeq)
        .input("dateSc", sql.Char(10), sc.date)
        .input("timeSc", sql.Char(5), sc.time)
        .input("isGv", sql.Bit, sc.gv ? 1 : 0)
        .input("sortOrder", sql.Int, scSort)
        .query(`
          INSERT INTO dbo.web_special_screening (item_seq, date_sc, time_sc, is_gv, sort_order)
          VALUES (@itemSeq, @dateSc, @timeSc, @isGv, @sortOrder)
        `);
    }
  }

  writeExhibitionJson(publicId, detail, mainImageRel, filmImageRels);
  console.log("ok", publicId, "seq=", seq, "films=", detail.films.length);
  return seq;
}

function listThumbPath(publicId) {
  const num = String(publicId).replace(/^e0*/, "") || publicId;
  const padded = Number(num) < 100 ? String(Number(num)).padStart(2, "0") : num;
  return `images/special/exhibition/special_exhibition_thumb_${padded}.png`;
}

function writeExhibitionJson(publicId, detail, mainImageRel, filmImageRels) {
  const payload = {
    id: publicId,
    title: detail.title,
    image: mainImageRel || listThumbPath(publicId),
    introduction: detail.introduction,
    bookingUrl: detail.bookingUrl,
    films: detail.films.map((f, idx) => ({
      title: f.title,
      image: filmImageRels[idx] || "",
      info: buildInfoLine(f.titleEn, "", f.info, f.runningTimeLabel, ""),
      director: f.director || "",
      cast: f.cast || "",
      description: f.description,
      sectionname: "",
      screenings: f.screenings.map((s) => ({
        date: s.date,
        time: s.time,
        gv: s.gv
      }))
    }))
  };
  const outPath = path.join(EXH_DATA_DIR, `exhibition-${publicId}.json`);
  fs.mkdirSync(EXH_DATA_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function main() {
  const cfg = getSqlConfig();
  if (!cfg?.server || !cfg?.user) {
    console.error("DB 설정 없음");
    process.exit(1);
  }

  const jobs = [];

  if (syncCategory) {
    const urls = await collectCategorySpecialUrls(fromPage, toPage);
    const total = urls.length;
    urls.forEach((url, idx) => {
      const publicId = publicIdFromListIndex(idx, total);
      jobs.push({ url, publicId, listOrder: total - idx });
    });
  } else if (syncPage) {
    const html = await fetchHtml("http://55cine.com/special/");
    const urls = parseSpecialPageUrls(html);
    const map = loadSourceUrlMap();
    let nextId = 25;
    urls.forEach((url, idx) => {
      const key = url.replace(/\/$/, "") + "/";
      const hit = map.get(key);
      const publicId = hit?.publicId || `e${String(nextId++).padStart(6, "0")}`;
      const listOrder = urls.length - idx;
      jobs.push({ url, publicId, listOrder });
    });
  } else if (urlArg) {
    jobs.push({
      url: urlArg,
      publicId: publicIdArg || "e000001",
      listOrder: listOrderFromPublicId(publicIdArg || "e000001", "exhibition")
    });
  } else {
    console.error(
      "Use --sync-category | --sync-page | --url=... --public-id=e000001 [--purge-exhibition] [--execute]"
    );
    process.exit(1);
  }

  console.log(
    "Mode:",
    execute ? "EXECUTE" : "DRY-RUN",
    "jobs:",
    jobs.length,
    purgeExhibition ? "(purge exhibition)" : ""
  );

  const pool = execute ? await sql.connect(cfg) : null;
  try {
    if (purgeExhibition) {
      purgeExhibitionJsonFiles();
      if (pool) await purgeExhibitionRows(pool);
    }

    let ok = 0;
    let fail = 0;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        if (i > 0) await sleep(fetchDelayMs);
        const html = await fetchHtml(job.url);
        const detail = parseDetailPage(html, job.url);
        await upsertSpecial(pool, job.publicId, job.listOrder, detail, job.url);
        ok += 1;
        if ((i + 1) % 10 === 0 || i + 1 === jobs.length) {
          console.log(`progress ${i + 1}/${jobs.length} (ok=${ok}, fail=${fail})`);
        }
      } catch (err) {
        fail += 1;
        console.error("FAIL", job.publicId, job.url, err.message || err);
      }
    }
    console.log(`done: ok=${ok}, fail=${fail}, total=${jobs.length}`);
  } finally {
    if (pool) await pool.close();
  }
}

function listOrderFromPublicId(publicId, kind) {
  const m = String(publicId).match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

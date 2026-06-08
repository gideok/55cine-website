/**
 * 55cinema.tistory.com → web_magazine + JSON 보강
 *
 * Usage:
 *   node scripts/sync-magazine-from-tistory.mjs --seq=67 --execute
 *   node scripts/sync-magazine-from-tistory.mjs --empty-only --execute
 *   node scripts/sync-magazine-from-tistory.mjs --audit
 *   node scripts/sync-magazine-from-tistory.mjs --backfill-created-at --execute
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";
import sql from "mssql";
import { getSqlConfig } from "./db-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BODY_IMG_DIR = path.join(ROOT, "images", "magazine", "body");
const PAST_IMG_DIR = path.join(ROOT, "images", "magazine", "past-articles");
const PAST_DATA_DIR = path.join(ROOT, "magazine", "past-articles", "data");

const execute = process.argv.includes("--execute");
const auditOnly = process.argv.includes("--audit");
const emptyOnly = process.argv.includes("--empty-only");
const importMissing = process.argv.includes("--import-missing");
const backfillCreatedAt = process.argv.includes("--backfill-created-at");
const seqArg = process.argv.find((a) => a.startsWith("--seq="));
const targetSeq = seqArg ? Number(seqArg.split("=")[1]) : null;
const sectionArg = process.argv.find((a) => a.startsWith("--section="));
const targetSection = sectionArg ? sectionArg.split("=")[1] : null;

const BASE = "https://55cinema.tistory.com";
const DELAY_MS = 350;

const CATEGORY_URLS = [
  { section: "preview", url: `${BASE}/category/%EC%83%81%EC%98%81%EC%9E%91%20%ED%94%84%EB%A6%AC%EB%B7%B0` },
  { section: "serial", url: `${BASE}/category/%EC%9E%A5%EB%A5%B4%20%EB%B6%88%EB%AC%B8%21%20%EB%8C%80%EA%B5%AC%EB%8F%85%EB%A6%BD%EC%98%81%ED%99%94` },
  { section: "gv-moment", url: `${BASE}/category/GV%20%EB%AA%A8%EB%A8%BC%ED%8A%B8` },
  { section: "past", url: `${BASE}/category/%EC%A7%80%EB%82%9C%20%EA%B8%B0%EC%82%AC` }
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 (55cine-sync/1.0)" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          fetchText(next).then(resolve).catch(reject);
          return;
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s) {
  return decodeHtml(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractBodyHtml(html) {
  const openTags = [
    '<div class="tt_article_useless_p_margin contents_style">',
    '<div class="contents_style">'
  ];

  let startIdx = -1;
  let openTag = "";
  for (const tag of openTags) {
    const idx = html.indexOf(tag);
    if (idx >= 0 && (startIdx < 0 || idx < startIdx)) {
      startIdx = idx;
      openTag = tag;
    }
  }
  if (startIdx < 0) return "";

  const contentStart = startIdx + openTag.length;
  const endMarkers = [
    '<div class="container_postbtn',
    '<div class="container_postbtn ',
    '<div class="related-articles',
    '<div id="entry'
  ];

  let endIdx = html.length;
  for (const marker of endMarkers) {
    const i = html.indexOf(marker, contentStart);
    if (i > contentStart && i < endIdx) endIdx = i;
  }
  if (endIdx === html.length) {
    const sysIdx = html.indexOf("<!-- System - START -->", contentStart);
    if (sysIdx > contentStart) endIdx = sysIdx;
  }

  let body = html.slice(contentStart, endIdx).trim();
  body = body.replace(/<\/div>\s*$/i, "").trim();
  return body;
}

function normalizeRemoteUrl(url) {
  if (!url) return "";
  url = decodeHtml(url);
  if (url.startsWith("//")) return "https:" + url;
  return url;
}

function isExcludedImageUrl(url) {
  if (!url) return true;
  if (/^data:/i.test(url)) return true;
  if (/no-image|tistory_admin\/static/i.test(url)) return true;
  if (/img1\.daumcdn\.net\/thumb\//i.test(url)) return true;
  return false;
}

function extractBodyImageUrls(bodyHtml) {
  const urls = [];
  const seen = new Set();

  function add(url) {
    const normalized = normalizeRemoteUrl(url);
    if (isExcludedImageUrl(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  }

  const figures = [
    ...bodyHtml.matchAll(/<figure[^>]*class="[^"]*imageblock[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi)
  ];

  if (figures.length) {
    figures.forEach((fig) => {
      const block = fig[1];
      const dataUrl = block.match(/data-url=["']([^"']+)["']/i);
      if (dataUrl) {
        add(dataUrl[1]);
        return;
      }
      const img = block.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (img) add(img[1]);
    });
    return urls;
  }

  [...bodyHtml.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].forEach((m) => add(m[1]));
  return urls;
}

function extractOgImage(html) {
  const m = html.match(/property="og:image" content="([^"]+)"/i);
  if (!m) return "";
  let url = decodeHtml(m[1]);
  if (/img1\.daumcdn\.net\/thumb\//i.test(url)) {
    const fname = url.match(/fname=([^&]+)/i);
    if (fname) {
      try {
        url = decodeURIComponent(fname[1]);
      } catch {
        /* keep */
      }
    }
  }
  return normalizeRemoteUrl(url);
}

function extractTistoryDateText(html) {
  const patterns = [
    /<(?:span|p|div|time)[^>]*\bclass=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|p|div|time)>/i,
    /\bclass=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]*?)<\//i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && stripTags(m[1])) return stripTags(m[1]);
  }
  return "";
}

function parseTistoryCreatedAt(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = m[4] != null ? Number(m[4]) : 0;
  const mi = m[5] != null ? Number(m[5]) : 0;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00+09:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractArticle(html, sourceUrl) {
  const ogTitle = html.match(/property="og:title" content="([^"]+)"/);
  const title = decodeHtml((ogTitle && ogTitle[1]) || "")
    .replace(/\s*:\s*매거진.*$/, "")
    .trim();

  const published =
    (html.match(/property="article:published_time" content="([^"]+)"/) ||
      html.match(/name="published_time" content="([^"]+)"/) ||
      [])[1] || "";

  const dateText = extractTistoryDateText(html);
  const createdAt = parseTistoryCreatedAt(dateText);

  const bodyHtml = extractBodyHtml(html);
  const imgUrls = extractBodyImageUrls(bodyHtml);
  const ogImage = extractOgImage(html);
  if (!imgUrls.length && ogImage && !isExcludedImageUrl(ogImage)) {
    imgUrls.push(ogImage);
  }

  const excerpt = stripTags(bodyHtml).slice(0, 220);
  return { title, published, dateText, createdAt, bodyHtml, imgUrls, excerpt, sourceUrl, ogImage };
}

function extFromUrl(url) {
  const m = url.match(/\.(jpe?g|png|gif|webp)(\?|$)/i);
  return m ? "." + m[1].toLowerCase().replace("jpeg", "jpg") : ".jpg";
}

async function downloadImage(remoteUrl, destAbs) {
  remoteUrl = normalizeRemoteUrl(remoteUrl);
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  if (!execute) return destAbs;

  return new Promise((resolve, reject) => {
    const lib = remoteUrl.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destAbs);
    lib
      .get(remoteUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          try {
            fs.unlinkSync(destAbs);
          } catch {
            /* noop */
          }
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, remoteUrl).href;
          downloadImage(next, destAbs).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          reject(new Error("HTTP " + res.statusCode));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(destAbs)));
      })
      .on("error", reject);
  });
}

function stripBackgroundStyles(html) {
  if (!html) return "";
  let out = html.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (_m, q, style) => {
    const cleaned = style
      .split(";")
      .map((p) => p.trim())
      .filter((p) => p && !p.split(":")[0].trim().toLowerCase().startsWith("background"))
      .join("; ");
    return cleaned ? ` style=${q}${cleaned}${q}` : "";
  });
  out = out.replace(/\sbgcolor=(["'])[^"']*\1/gi, "");
  out = out.replace(/\s+onerror="[^"]*"/gi, "");
  out = out.replace(/\s+srcset="[^"]*"/gi, "");
  return out;
}

function rewriteBodyHtml(html, pairs) {
  let out = stripBackgroundStyles(html);
  for (const { remote, local } of pairs) {
    if (!remote || !local) continue;
    out = out.split(remote).join(local);
    const enc = remote.replace(/&/g, "&amp;");
    if (enc !== remote) out = out.split(enc).join(local);
  }
  return out;
}

function bodyImageDestRel(seq, idx, ext) {
  return `images/magazine/body/wm_${seq}_${idx}${ext}`;
}

function pastThumbDestRel(seq, idx, ext) {
  return `images/magazine/past-articles/${seq}-${String(idx).padStart(2, "0")}${ext}`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function jsonPathForRow(row) {
  if (row.is_past) return path.join(PAST_DATA_DIR, `${row.seq}.json`);
  const folder =
    row.section === "serial" ? "serial" : row.section === "gv-moment" ? "gv-moment" : "preview";
  return path.join(ROOT, "magazine", folder, "data", `${row.seq}.json`);
}

async function collectCategoryUrls(catUrl, maxPages = 30) {
  const urls = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 ? catUrl : `${catUrl}?page=${page}`;
    const html = await fetchText(url);
    const matches = [...html.matchAll(/href="(\/entry\/[^"?#]+)"/g)];
    if (!matches.length) break;
    matches.forEach((m) => urls.add(BASE + m[1]));
    await sleep(150);
  }
  return [...urls];
}

async function loadDbRows(pool) {
  const clauses = [];
  if (targetSeq) clauses.push(`seq = ${Number(targetSeq)}`);
  else if (emptyOnly) clauses.push(`LEN(ISNULL(body_html,'')) = 0`);
  if (targetSection) clauses.push(`section = '${targetSection.replace(/'/g, "''")}'`);

  const where = clauses.length ? clauses.join(" AND ") : "1=1";

  const res = await pool.request().query(`
    SELECT seq, section, is_past, title, source_url, img_thumb, img_cover
    FROM dbo.web_magazine
    WHERE ${where}
    ORDER BY seq
  `);
  return res.recordset;
}

async function syncOne(pool, row) {
  const sourceUrl = row.source_url?.trim();
  if (!sourceUrl) {
    console.warn("skip (no source_url):", row.seq);
    return false;
  }

  console.log("fetch", row.seq, sourceUrl);
  await sleep(DELAY_MS);
  const html = await fetchText(sourceUrl);
  const parsed = extractArticle(html, sourceUrl);

  if (!parsed.bodyHtml && !parsed.imgUrls.length) {
    console.warn("empty parse:", row.seq);
    return false;
  }

  const pairs = [];
  const attachments = [];

  for (let i = 0; i < parsed.imgUrls.length; i++) {
    const remote = parsed.imgUrls[i];
    const ext = extFromUrl(remote);
    const bodyRel = bodyImageDestRel(row.seq, i + 1, ext);
    const bodyAbs = path.join(ROOT, bodyRel.replace(/\//g, path.sep));

    try {
      await downloadImage(remote, bodyAbs);
      pairs.push({ remote, local: bodyRel });
      attachments.push({ path: bodyRel, alt: parsed.title });

      if (row.is_past) {
        const pastRel = pastThumbDestRel(row.seq, i + 1, ext);
        const pastAbs = path.join(ROOT, pastRel.replace(/\//g, path.sep));
        if (execute) fs.copyFileSync(bodyAbs, pastAbs);
        if (i === 0) attachments[0].path = pastRel;
      }
    } catch (err) {
      console.error("  img fail", row.seq, remote.slice(0, 80), err.message);
    }
  }

  const bodyHtml = rewriteBodyHtml(parsed.bodyHtml, pairs);
  const keepListThumb =
    row.img_thumb &&
    ((row.section === "serial" && /images\/magazine\/serial\//.test(row.img_thumb)) ||
      (row.section === "gv-moment" && /images\/magazine\/gv-moment\//.test(row.img_thumb)));
  const thumbRel = row.is_past && attachments[0]
    ? attachments[0].path
    : keepListThumb
      ? row.img_thumb
      : pairs[0]?.local || attachments[0]?.path || row.img_thumb || "";
  const coverRel = keepListThumb ? row.img_cover || row.img_thumb : thumbRel;
  const publishedAt = parsed.published ? new Date(parsed.published) : null;
  const createdAt = parsed.createdAt || publishedAt;

  const jsonPayload = {
    id: row.seq,
    slug: String(row.seq),
    title: parsed.title || row.title,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : "",
    publishedLabel: formatDate(parsed.published),
    excerpt: parsed.excerpt,
    coverImage: coverRel,
    thumbnail: coverRel,
    bodyHtml,
    attachments: attachments.map((a) => ({ path: a.path, alt: parsed.title })),
    sourceUrl
  };
  if (!row.is_past) {
    jsonPayload.movieTitle = parseMovieTitle(jsonPayload.title);
    jsonPayload.subtitle = parseSubtitle(jsonPayload.title);
  }

  const jsonPath = jsonPathForRow(row);
  if (execute && fs.existsSync(path.dirname(jsonPath))) {
    let existing = {};
    if (fs.existsSync(jsonPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      } catch {
        /* noop */
      }
    }
    const merged = { ...existing, ...jsonPayload };
    if (keepListThumb) {
      merged.thumbnail = row.img_thumb;
      merged.coverImage = row.img_cover || row.img_thumb;
    }
    if (existing.numericId != null) merged.numericId = existing.numericId;
    if (existing.date) merged.date = existing.date;
    fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  }

  if (execute) {
    await pool
      .request()
      .input("seq", sql.Int, row.seq)
      .input("title", sql.NVarChar, jsonPayload.title)
      .input("publishedLabel", sql.NVarChar, jsonPayload.publishedLabel || null)
      .input("publishedAt", sql.DateTime2, publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null)
      .input("createdAt", sql.DateTime2, createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null)
      .input("bodyHtml", sql.NVarChar(sql.MAX), bodyHtml)
      .input("imgThumb", sql.NVarChar, thumbRel || null)
      .input("imgCover", sql.NVarChar, coverRel || null)
      .query(`
        UPDATE dbo.web_magazine
        SET title = @title, published_label = @publishedLabel, published_at = @publishedAt,
            created_at = COALESCE(@createdAt, created_at),
            body_html = @bodyHtml, img_thumb = @imgThumb, img_cover = @imgCover,
            updated_at = SYSUTCDATETIME()
        WHERE seq = @seq
      `);
  }

  console.log(
    execute ? "ok" : "dry",
    row.seq,
    "body=" + bodyHtml.length,
    "imgs=" + pairs.length,
    "thumb=" + (thumbRel || "-")
  );
  return true;
}

function normalizeSourceKey(url) {
  if (!url) return "";
  try {
    return decodeURI(url.replace(/\/$/, "").trim());
  } catch {
    return url.replace(/\/$/, "").trim();
  }
}

function buildSourceIndex(rows) {
  const bySource = new Map();
  for (const row of rows) {
    const key = normalizeSourceKey(row.source_url);
    if (key) bySource.set(key, row);
  }
  return bySource;
}

function parseMovieTitle(title) {
  const m = String(title || "").match(/<([^>]+)>/);
  return m ? m[1].trim() : null;
}

function parseSubtitle(title) {
  const t = String(title || "");
  const dash = t.indexOf(" - ");
  return dash >= 0 ? t.slice(dash + 3).trim() : null;
}

const IMPORT_SECTIONS = [
  {
    section: "preview",
    catUrl: CATEGORY_URLS[0].url,
    dataDir: path.join(ROOT, "magazine", "preview", "data"),
    isPast: false
  },
  {
    section: "serial",
    catUrl: CATEGORY_URLS[1].url,
    dataDir: path.join(ROOT, "magazine", "serial", "data"),
    isPast: false
  }
];

async function importOneNew(pool, cfg, sourceUrl) {
  console.log("import", sourceUrl);
  await sleep(DELAY_MS);
  const html = await fetchText(sourceUrl);
  const parsed = extractArticle(html, sourceUrl);
  if (!parsed.bodyHtml && !parsed.imgUrls.length) {
    console.warn("  skip empty");
    return false;
  }

  const publishedAt = parsed.published ? new Date(parsed.published) : null;
  const createdAt = parsed.createdAt || publishedAt || new Date();

  let seq = 0;
  if (execute) {
    const ins = await pool
      .request()
      .input("section", sql.NVarChar, cfg.section)
      .input("isPast", sql.Bit, 0)
      .input("title", sql.NVarChar, parsed.title)
      .input("movieTitle", sql.NVarChar, parseMovieTitle(parsed.title))
      .input("subtitle", sql.NVarChar, parseSubtitle(parsed.title))
      .input("publishedLabel", sql.NVarChar, formatDate(parsed.published) || parsed.dateText || null)
      .input("publishedAt", sql.DateTime2, publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null)
      .input("createdAt", sql.DateTime2, createdAt)
      .input("bodyHtml", sql.NVarChar(sql.MAX), "")
      .input("imgThumb", sql.NVarChar, null)
      .input("imgCover", sql.NVarChar, null)
      .input("sourceUrl", sql.NVarChar, sourceUrl)
      .query(`
        INSERT INTO dbo.web_magazine (
          section, is_past, title, movie_title, subtitle,
          published_label, published_at, created_at, body_html,
          img_thumb, img_cover, source_url
        )
        OUTPUT INSERTED.seq
        VALUES (
          @section, @isPast, @title, @movieTitle, @subtitle,
          @publishedLabel, @publishedAt, @createdAt, @bodyHtml,
          @imgThumb, @imgCover, @sourceUrl
        )
      `);
    seq = ins.recordset[0].seq;
  } else {
    seq = 9999;
  }

  const row = { seq, section: cfg.section, is_past: cfg.isPast };
  return syncOne(pool, { ...row, source_url: sourceUrl, title: parsed.title });
}

async function runImportMissing(pool) {
  const dbRes = await pool.request().query(`
    SELECT seq, section, is_past, source_url
    FROM dbo.web_magazine
  `);
  const bySource = buildSourceIndex(dbRes.recordset);

  let imported = 0;
  for (const cfg of IMPORT_SECTIONS) {
    const urls = await collectCategoryUrls(cfg.catUrl);
    const missing = urls.filter((u) => !bySource.has(normalizeSourceKey(u)));
    console.log(`\n${cfg.section}: import ${missing.length} missing`);
    for (const url of missing) {
      try {
        if (await importOneNew(pool, cfg, url)) {
          imported += 1;
          bySource.set(normalizeSourceKey(url), { seq: 0 });
        }
      } catch (err) {
        console.error("FAIL import", url, err.message);
      }
    }
  }
  console.log("\nImported:", imported);
}

async function backfillCreatedAtOne(pool, row) {
  const sourceUrl = row.source_url?.trim();
  if (!sourceUrl) {
    console.warn("skip (no source_url):", row.seq);
    return false;
  }

  console.log("backfill", row.seq, sourceUrl);
  await sleep(DELAY_MS);
  const html = await fetchText(sourceUrl);
  const dateText = extractTistoryDateText(html);
  const createdAt = parseTistoryCreatedAt(dateText);
  if (!createdAt) {
    console.warn("no .date parse:", row.seq, dateText || "(empty)");
    return false;
  }

  if (execute) {
    await pool
      .request()
      .input("seq", sql.Int, row.seq)
      .input("createdAt", sql.DateTime2, createdAt)
      .query(`
        UPDATE dbo.web_magazine
        SET created_at = @createdAt, updated_at = SYSUTCDATETIME()
        WHERE seq = @seq
      `);
  }

  console.log(execute ? "ok" : "dry", row.seq, createdAt.toISOString(), dateText);
  return true;
}

async function runBackfillCreatedAt(pool) {
  const clauses = [];
  if (targetSeq) clauses.push(`seq = ${Number(targetSeq)}`);
  if (targetSection) clauses.push(`section = '${targetSection.replace(/'/g, "''")}'`);
  const where = clauses.length ? clauses.join(" AND ") : "LEN(ISNULL(source_url,'')) > 0";

  const res = await pool.request().query(`
    SELECT seq, section, is_past, source_url
    FROM dbo.web_magazine
    WHERE ${where}
    ORDER BY seq
  `);

  console.log("backfill targets:", res.recordset.length, execute ? "(execute)" : "(dry-run)");
  let ok = 0;
  for (const row of res.recordset) {
    try {
      if (await backfillCreatedAtOne(pool, row)) ok += 1;
    } catch (err) {
      console.error("FAIL backfill", row.seq, err.message);
    }
  }
  console.log("\nBackfilled:", ok, "/", res.recordset.length);
}

async function runAudit(pool) {
  const dbRes = await pool.request().query(`
    SELECT seq, section, is_past, source_url, LEN(ISNULL(body_html,'')) as body_len
    FROM dbo.web_magazine
  `);
  const bySource = buildSourceIndex(dbRes.recordset);

  const emptyBody = dbRes.recordset.filter((r) => !r.body_len);
  console.log("\n=== DB 빈 본문 ===", emptyBody.length);
  emptyBody.forEach((r) => console.log(" ", r.seq, r.section, r.is_past ? "past" : ""));

  for (const cat of CATEGORY_URLS) {
    console.log("\n=== Tistory category:", cat.section, "===");
    const urls = await collectCategoryUrls(cat.url);
    const missing = [];
    for (const u of urls) {
      if (!bySource.has(normalizeSourceKey(u))) missing.push(u);
    }
    console.log("  tistory entries:", urls.length);
    console.log("  not in DB:", missing.length);
    missing.slice(0, 15).forEach((u) => console.log("   -", u));
    if (missing.length > 15) console.log("   ...");
  }
}

async function main() {
  const cfg = getSqlConfig();
  if (!cfg?.server) {
    console.error("DB 설정 없음");
    process.exit(1);
  }

  const pool = await sql.connect(cfg);

  if (auditOnly) {
    await runAudit(pool);
    await pool.close();
    return;
  }

  if (importMissing) {
    await runImportMissing(pool);
    await runAudit(pool);
    await pool.close();
    return;
  }

  if (backfillCreatedAt) {
    await runBackfillCreatedAt(pool);
    await pool.close();
    return;
  }

  const rows = await loadDbRows(pool);
  console.log("sync targets:", rows.length, execute ? "(execute)" : "(dry-run)");

  let ok = 0;
  for (const row of rows) {
    try {
      if (await syncOne(pool, row)) ok += 1;
    } catch (err) {
      console.error("FAIL", row.seq, err.message);
    }
  }

  console.log("\nSynced:", ok, "/", rows.length);
  await runAudit(pool);
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

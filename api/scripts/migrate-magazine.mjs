/**
 * magazine preview/serial/gv-moment/past-articles JSON → web_magazine
 * body images → images/magazine/body/wm_{seq}_{n}.{ext}
 *
 * Usage:
 *   node scripts/migrate-magazine.mjs           # dry-run
 *   node scripts/migrate-magazine.mjs --execute
 *   node scripts/migrate-magazine.mjs --execute --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import { getSqlConfig } from "./db-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BODY_IMG_DIR = path.join(ROOT, "images", "magazine", "body");

const execute = process.argv.includes("--execute");
const force = process.argv.includes("--force");

const SECTION_DIRS = [
  { section: "preview", dir: path.join(ROOT, "magazine", "preview", "data"), isPast: false },
  { section: "serial", dir: path.join(ROOT, "magazine", "serial", "data"), isPast: false },
  { section: "gv-moment", dir: path.join(ROOT, "magazine", "gv-moment", "data"), isPast: false },
  {
    section: "preview",
    dir: path.join(ROOT, "magazine", "past-articles", "data"),
    isPast: true,
    idPrefix: /^pa\d+\.json$/i
  }
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadListOrderMap(dataDir) {
  const indexPath = path.join(dataDir, "index.json");
  if (!fs.existsSync(indexPath)) return new Map();
  const index = readJson(indexPath);
  const map = new Map();
  (index.items || []).forEach((item, idx) => {
    if (item.id) map.set(String(item.id).toLowerCase(), idx + 1);
  });
  return map;
}

function resolveSourceFile(relPath) {
  if (!relPath || /^https?:\/\//i.test(relPath)) return null;
  const rel = String(relPath).replace(/^\//, "");
  const candidates = [
    path.join(ROOT, rel),
    path.join(ROOT, "images", "magazine", path.basename(rel))
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function bodyImageDestRel(seq, idx, ext) {
  const e = (ext || ".jpg").toLowerCase();
  return `images/magazine/body/wm_${seq}_${idx}${e}`;
}

function copyBodyImage(srcAbs, destRel) {
  if (!srcAbs || !fs.existsSync(srcAbs)) return null;
  const destAbs = path.join(ROOT, destRel.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  if (execute) fs.copyFileSync(srcAbs, destAbs);
  return destRel;
}

function rewriteBodyHtmlImages(bodyHtml, seq, jsonDir) {
  if (!bodyHtml) return { html: "", copied: 0 };

  let idx = 0;
  let copied = 0;

  const replaceSrc = (html, src) => {
    if (!src || /^https?:\/\//i.test(src)) return src;
    idx += 1;
    let abs = resolveSourceFile(src);
    if (!abs && jsonDir) {
      abs = path.join(jsonDir, path.basename(src));
      if (!fs.existsSync(abs)) abs = null;
    }
    if (!abs) return src;
    const ext = path.extname(abs) || ".jpg";
    const destRel = bodyImageDestRel(seq, idx, ext);
    const saved = copyBodyImage(abs, destRel);
    if (saved) copied += 1;
    return saved || src;
  };

  let html = bodyHtml;

  html = html.replace(/(<img\b[^>]*\ssrc=["'])([^"']+)(["'][^>]*>)/gi, (_, pre, src, post) => {
    return pre + replaceSrc(html, src) + post;
  });

  html = html.replace(/(<img\b[^>]*\ssrc=)([^\s>]+)([^>]*>)/gi, (_, pre, src, post) => {
    const cleaned = src.replace(/^["']|["']$/g, "");
    return pre + replaceSrc(html, cleaned) + post;
  });

  html = html.replace(/data-url=["']([^"']+)["']/gi, (match, url) => {
    if (/^https?:\/\//i.test(url)) return match;
    const next = replaceSrc(html, url);
    return `data-url="${next}"`;
  });

  return { html, copied };
}

function listArticleFiles(dataDir, idPrefix) {
  if (!fs.existsSync(dataDir)) return [];
  return fs
    .readdirSync(dataDir)
    .filter((f) => {
      if (!/^[a-z]{2}\d+\.json$/i.test(f)) return false;
      if (idPrefix && !idPrefix.test(f)) return false;
      return true;
    })
    .sort();
}

async function deleteAllMagazine(pool) {
  if (!execute) {
    console.log("force: would DELETE FROM web_magazine");
    return;
  }
  await pool.request().query(`DELETE FROM dbo.web_magazine`);
}

async function insertArticle(pool, row) {
  if (!execute) {
    console.log("dry insert", row.publicId, row.section, "isPast=", row.isPast, row.title.slice(0, 40));
    return row.seqHint ?? 0;
  }

  const res = await pool
    .request()
    .input("publicId", sql.NVarChar, row.publicId)
    .input("section", sql.NVarChar, row.section)
    .input("isPast", sql.Bit, row.isPast ? 1 : 0)
    .input("title", sql.NVarChar, row.title)
    .input("movieTitle", sql.NVarChar, row.movieTitle)
    .input("subtitle", sql.NVarChar, row.subtitle)
    .input("publishedLabel", sql.NVarChar, row.publishedLabel)
    .input("publishedAt", sql.DateTime2, row.publishedAt)
    .input("excerpt", sql.NVarChar, row.excerpt)
    .input("bodyHtml", sql.NVarChar(sql.MAX), row.bodyHtml)
    .input("imgThumb", sql.NVarChar, row.imgThumb)
    .input("imgCover", sql.NVarChar, row.imgCover)
    .input("sourceUrl", sql.NVarChar, row.sourceUrl)
    .input("articleUrl", sql.NVarChar, row.articleUrl)
    .input("listOrder", sql.Int, row.listOrder)
    .query(`
      INSERT INTO dbo.web_magazine (
        public_id, section, is_past, title, movie_title, subtitle,
        published_label, published_at, excerpt, body_html,
        img_thumb, img_cover, source_url, article_url, list_order
      )
      OUTPUT INSERTED.seq
      VALUES (
        @publicId, @section, @isPast, @title, @movieTitle, @subtitle,
        @publishedLabel, @publishedAt, @excerpt, @bodyHtml,
        @imgThumb, @imgCover, @sourceUrl, @articleUrl, @listOrder
      )
    `);
  return res.recordset[0].seq;
}

async function updateBodyHtml(pool, seq, bodyHtml) {
  if (!execute) return;
  await pool
    .request()
    .input("seq", sql.Int, seq)
    .input("bodyHtml", sql.NVarChar(sql.MAX), bodyHtml)
    .query(`UPDATE dbo.web_magazine SET body_html = @bodyHtml, updated_at = SYSUTCDATETIME() WHERE seq = @seq`);
}

function parsePublishedAt(data) {
  const raw = data.publishedAt || data.published_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapJsonToRow(data, section, isPast, listOrder) {
  const publicId = String(data.id || data.slug || "").trim().toLowerCase();
  return {
    publicId,
    section,
    isPast,
    title: String(data.title || "").trim(),
    movieTitle: data.movieTitle ? String(data.movieTitle).trim() : null,
    subtitle: data.subtitle ? String(data.subtitle).trim() : null,
    publishedLabel: (data.publishedLabel || data.date || "").trim() || null,
    publishedAt: parsePublishedAt(data),
    excerpt: data.excerpt ? String(data.excerpt).trim().slice(0, 2000) : null,
    bodyHtml: data.bodyHtml || "",
    imgThumb: (data.thumbnail || data.coverImage || "").trim() || null,
    imgCover: (data.coverImage || data.thumbnail || "").trim() || null,
    sourceUrl: data.sourceUrl ? String(data.sourceUrl).trim() : null,
    articleUrl: data.articleUrl ? String(data.articleUrl).trim() : null,
    listOrder
  };
}

async function migrateSection(pool, entry, stats) {
  const { section, dir, isPast, idPrefix } = entry;
  const orderMap = loadListOrderMap(dir);
  const files = listArticleFiles(dir, idPrefix);

  for (const file of files) {
    const data = readJson(path.join(dir, file));
    const publicId = String(data.id || data.slug || "").trim().toLowerCase();
    if (!publicId) {
      stats.skip += 1;
      continue;
    }

    const exists = await pool
      .request()
      .input("publicId", sql.NVarChar, publicId)
      .query(`SELECT seq FROM dbo.web_magazine WHERE public_id = @publicId`);

    if (exists.recordset.length && !force) {
      stats.skip += 1;
      console.log("skip (exists):", publicId);
      continue;
    }

    if (exists.recordset.length && force) {
      if (execute) {
        await pool
          .request()
          .input("publicId", sql.NVarChar, publicId)
          .query(`DELETE FROM dbo.web_magazine WHERE public_id = @publicId`);
      }
    }

    const numMatch = publicId.match(/(\d+)$/);
    const fallbackOrder = numMatch ? Number(numMatch[1]) : stats.inserted + 1;
    const listOrder = orderMap.get(publicId) ?? fallbackOrder;

    const row = mapJsonToRow(data, section, isPast, listOrder);
    const seq = await insertArticle(pool, row);

    const { html, copied } = rewriteBodyHtmlImages(row.bodyHtml, seq || 1, dir);
    if (copied > 0 && seq) {
      await updateBodyHtml(pool, seq, html);
    }

    stats.inserted += 1;
    if (execute) {
      console.log("ok", publicId, "seq=", seq, "bodyImgs=", copied);
    }
  }
}

async function main() {
  const cfg = getSqlConfig();
  if (!cfg?.server || !cfg?.user) {
    console.error("DB 설정 없음");
    process.exit(1);
  }

  const pool = await sql.connect(cfg);
  const stats = { inserted: 0, skip: 0 };

  if (force) await deleteAllMagazine(pool);

  for (const entry of SECTION_DIRS) {
    console.log("\n==", entry.section, entry.isPast ? "(past)" : "", entry.dir);
    await migrateSection(pool, entry, stats);
  }

  await pool.close();
  console.log("\nDone.", stats, execute ? "" : "(dry-run)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

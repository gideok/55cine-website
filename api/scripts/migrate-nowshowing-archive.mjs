/**
 * 55cine.com/category/nowshowing/page/2+ 과거 상영작 → web_program 마이그레이션
 *
 * 사용:
 *   node scripts/migrate-nowshowing-archive.mjs [--start-page=2] [--force] [--dry-run] [--limit=N]
 *
 * 이미지: img1 = 원본(wp_{seq}_1), img_thumb = 40×40(thumb_wp_{seq}_1)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import sharp from "sharp";
import { getSqlConfig } from "./db-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const WP_DIR = path.join(ROOT, "images", "movies", "wp");
const BASE = "http://55cine.com";
const THUMB_SIZE = 40;

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const startPage = Number(args.find((a) => a.startsWith("--start-page="))?.split("=")[1] || 2);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || 0);
const fromCache = args.includes("--from-cache");
const CACHE_FILE = path.join(__dirname, "../.cache-nowshowing-urls.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]+>/g, " "));
}

function normalizeDownloadUrl(url) {
  return String(url)
    .replace(/^https?:\/\/i[0-9]\.wp\.com\/55cine\.com\//i, `${BASE}/`)
    .replace(/\?.*$/, "")
    .replace(/^https:\/\/55cine\.com/i, BASE);
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "55cine-website-migration/1.0" },
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function extractArchiveLinks(html) {
  const re = /href="(http:\/\/55cine\.com\/\d{4}\/\d{2}\/\d{2}\/[^"#?]+\/?)"/gi;
  const links = new Set();
  let m;
  while ((m = re.exec(html))) {
    const u = m[1].replace(/\/$/, "") + "/";
    if (!u.includes("/category/") && !u.includes("/page/")) links.add(u);
  }
  return [...links];
}

function slugFromUrl(url) {
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || "";
}

function cleanTitleFromOg(ogTitle) {
  return String(ogTitle || "")
    .replace(/\s*\d{2}\/\d{2}\([^)]*\)[\s\S]*$/u, "")
    .replace(/\s*\(종영\)\s*$/u, "")
    .replace(/\s*\|\s*오오극장\s*$/u, "")
    .trim();
}

function extractInfoBeforeFirstDot(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const dot = text.indexOf("·");
  if (dot === -1) return text;
  return text.slice(0, dot).trim();
}

/** figcaption: 감독: / 출연: (또는 배우) 다음 줄들 → synopsis */
function parseFigcaption(figHtml) {
  if (!figHtml) return { director: "", cast: "", synopsis: "" };

  const text = decodeHtml(figHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let director = "";
  let cast = "";
  const synopsisLines = [];
  let metaDone = false;

  for (const line of lines) {
    if (/^감독/i.test(line)) {
      director = line.replace(/^감독\s*:?\s*/i, "").trim();
      continue;
    }
    if (/^출연/i.test(line)) {
      cast = line.replace(/^출연\s*:?\s*/i, "").trim();
      metaDone = true;
      continue;
    }
    if (/^배우/i.test(line)) {
      cast = line.replace(/^배우\s*:?\s*/i, "").trim();
      metaDone = true;
      continue;
    }
    if (/^상영일정/i.test(line) || line.includes("상영일정")) break;
    if (metaDone) synopsisLines.push(line);
  }

  return {
    director,
    cast: cast.replace(/\s*\|\s*/g, ", ").replace(/,\s*,/g, ","),
    synopsis: synopsisLines.join("\n\n").trim()
  };
}

function extractEntryThumbnailUrl(html) {
  const block = html.match(/entry-thumbnail[\s\S]*?<\/figure>/i)?.[0] || "";
  const src = block.match(/<img[^>]+src="([^"]+)"/i)?.[1];
  return src ? normalizeDownloadUrl(src) : null;
}

function parseDetailPage(html, url) {
  const slug = slugFromUrl(url);
  const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] || "";

  const trailerYoutubeId =
    html.match(/youtube\.com\/embed\/([^"?&]+)/i)?.[1] ||
    html.match(/youtu\.be\/([^"?&]+)/i)?.[1] ||
    "";

  const alertHtml = html.match(/stag-alert[\s\S]*?<\/p>/i)?.[0] || "";
  const metaPlain = stripTags(alertHtml).replace(/\s+/g, " ").trim();
  const pipeParts = metaPlain.split("|").map((s) => s.trim());
  const titlePart = pipeParts[0] || "";
  const titleEn = titlePart.match(/\(([^,)]+)/)?.[1]?.trim() || "";
  const titleKo = cleanTitleFromOg(ogTitle) || titlePart.replace(/\([^)]*\)/, "").trim();
  const info = extractInfoBeforeFirstDot(pipeParts[1] || "");

  const figHtml = html.match(/<figcaption>([\s\S]*?)<\/figcaption>/i)?.[1] || "";
  const { director, cast, synopsis } = parseFigcaption(figHtml);

  const imageUrl = extractEntryThumbnailUrl(html);

  return {
    slug,
    url,
    titleKo,
    titleEn,
    director,
    cast,
    info,
    synopsis,
    trailerYoutubeId,
    imageUrl
  };
}

async function findProgId(pool, titleKo) {
  const exact = await pool
    .request()
    .input("name", sql.NVarChar, titleKo)
    .query(
      `SELECT TOP (1) prog_id, name FROM dbo.prog_base WHERE LTRIM(RTRIM(name)) = @name`
    );
  if (exact.recordset[0]) return exact.recordset[0];

  const like = await pool
    .request()
    .input("name", sql.NVarChar, titleKo.slice(0, Math.min(12, titleKo.length)) + "%")
    .query(
      `SELECT TOP (1) prog_id, name FROM dbo.prog_base WHERE LTRIM(RTRIM(name)) LIKE @name ORDER BY LEN(name)`
    );
  return like.recordset[0] ?? null;
}

async function downloadImage(url, destAbs) {
  const res = await fetch(normalizeDownloadUrl(url), { redirect: "follow" });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.writeFileSync(destAbs, buf);
}

async function writePosterImages(seq, imageUrl) {
  const originalRel = `images/movies/wp/wp_${seq}_1.jpg`;
  const thumbRel = `images/movies/wp/thumb_wp_${seq}_1.jpg`;
  const originalAbs = path.join(ROOT, originalRel);
  const thumbAbs = path.join(ROOT, thumbRel);

  await downloadImage(imageUrl, originalAbs);
  await sharp(originalAbs)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(thumbAbs);

  return { img1: originalRel, img_thumb: thumbRel };
}

async function collectArchiveUrls() {
  const all = new Map();
  let page = startPage;
  while (page < 200) {
    const url = `${BASE}/category/nowshowing/page/${page}/`;
    let html;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      console.warn("STOP page", page, e.message);
      break;
    }
    const links = extractArchiveLinks(html);
    if (!links.length) {
      console.log("End at page", page, "(no posts)");
      break;
    }
    for (const link of links) {
      if (!all.has(link)) all.set(link, { url: link, page });
    }
    console.log(`Page ${page}: ${links.length} posts (total ${all.size})`);
    page++;
    await sleep(400);
  }
  return [...all.values()];
}

async function main() {
  const cfg = getSqlConfig();
  if (!cfg) {
    console.error(".env DB 설정 필요");
    process.exit(1);
  }

  fs.mkdirSync(WP_DIR, { recursive: true });

  let entries;
  if (fromCache && fs.existsSync(CACHE_FILE)) {
    entries = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    console.log(`Loaded ${entries.length} URLs from cache`);
  } else {
    console.log(`Collecting archive from page ${startPage}…`);
    entries = await collectArchiveUrls();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2), "utf8");
    console.log(`Cached ${entries.length} URLs → ${CACHE_FILE}`);
  }
  const targets = limit > 0 ? entries.slice(0, limit) : entries;
  console.log(`Migrate ${targets.length} titles (dryRun=${dryRun}, force=${force})\n`);

  const pool = dryRun ? null : await sql.connect(cfg);
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const { url, page } of targets) {
    try {
      await sleep(500);
      const html = await fetchHtml(url);
      const movie = parseDetailPage(html, url);
      console.log(`\n[page ${page}] ${movie.titleKo} (${movie.slug})`);

      if (dryRun) {
        console.log("  director:", movie.director);
        console.log("  cast:", movie.cast);
        console.log("  info:", movie.info);
        console.log("  img1:", movie.imageUrl);
        console.log(
          "  synopsis:",
          movie.synopsis ? movie.synopsis.slice(0, 120) + "…" : "(empty)"
        );
        ok++;
        continue;
      }

      const prog = await findProgId(pool, movie.titleKo);
      if (!prog) {
        console.warn("  SKIP no prog_base:", movie.titleKo);
        skipped++;
        continue;
      }

      const existing = await pool
        .request()
        .input("progId", sql.Int, prog.prog_id)
        .query(`SELECT seq, slug, director, info FROM dbo.web_program WHERE prog_id = @progId`);

      let seq = existing.recordset[0]?.seq;

      if (!seq) {
        const ins = await pool
          .request()
          .input("progId", sql.Int, prog.prog_id)
          .input("slug", sql.NVarChar, movie.slug)
          .query(`
            INSERT INTO dbo.web_program (prog_id, slug, detail_url)
            OUTPUT INSERTED.seq
            VALUES (@progId, @slug, NULL)
          `);
        seq = ins.recordset[0].seq;
      }

      let img1 = null;
      let imgThumb = null;
      if (movie.imageUrl) {
        try {
          const paths = await writePosterImages(seq, movie.imageUrl);
          img1 = paths.img1;
          imgThumb = paths.img_thumb;
        } catch (e) {
          console.warn("  IMAGE FAIL:", e.message);
        }
      }

      await pool
        .request()
        .input("seq", sql.Int, seq)
        .input("slug", sql.NVarChar, movie.slug)
        .input("director", sql.NVarChar, movie.director || null)
        .input("cast", sql.NVarChar, movie.cast || null)
        .input("info", sql.NVarChar, movie.info || null)
        .input("synopsis", sql.NVarChar(sql.MAX), movie.synopsis || null)
        .input("trailer", sql.NVarChar, movie.trailerYoutubeId || null)
        .input("img1", sql.NVarChar, img1)
        .input("imgThumb", sql.NVarChar, imgThumb)
        .query(`
          UPDATE dbo.web_program SET
            slug = @slug,
            director = @director,
            cast_names = @cast,
            info = @info,
            synopsis = @synopsis,
            trailer_url = @trailer,
            img1 = COALESCE(@img1, img1),
            img_thumb = COALESCE(@imgThumb, img_thumb)
          WHERE seq = @seq
        `);

      console.log(
        `  OK prog_id=${prog.prog_id} seq=${seq}`,
        img1 ? `img1=${img1}` : "",
        imgThumb ? `thumb=${imgThumb}` : ""
      );
      ok++;
    } catch (e) {
      console.error("  FAIL", url, e.message);
      failed++;
    }
  }

  if (pool) await pool.close();
  console.log(`\nDone. ok=${ok}, skipped=${skipped}, failed=${failed}, scanned=${targets.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

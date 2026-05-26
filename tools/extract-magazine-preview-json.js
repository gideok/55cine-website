/**
 * magazine-preview-detail-01~24.html → magazine/preview/data/*.json
 * 실행: node tools/extract-magazine-preview-json.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "magazine", "preview", "data");
const DATA_JS = path.join(ROOT, "data", "magazine-preview-data.js");

function decodeHtmlEntities(s) {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function loadListMeta() {
  const window = {};
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(DATA_JS, "utf8"));
  if (!Array.isArray(window.MAGAZINE_PREVIEW_DATA)) {
    throw new Error("MAGAZINE_PREVIEW_DATA not found");
  }
  return window.MAGAZINE_PREVIEW_DATA;
}

function extractDetailHtml(html, numericId) {
  const id = "pv" + String(numericId).padStart(3, "0");

  const titleTag = html.match(/<title>([^<]*)<\/title>/i);
  const fullTitle = titleTag ? decodeHtmlEntities(titleTag[1].replace(/\s*-\s*55CINE\s*$/i, "").trim()) : "";

  const movieTitle = decodeHtmlEntities(
    (html.match(/<h1[^>]*class="detail-title"[^>]*>([\s\S]*?)<\/h1>/i) || ["", ""])[1]
      .replace(/<[^>]+>/g, "")
      .trim()
  );

  const subtitle = decodeHtmlEntities(
    (html.match(/<p class="detail-subtitle">([\s\S]*?)<\/p>/i) || ["", ""])[1]
      .replace(/<[^>]+>/g, "")
      .trim()
  );

  const publishedLabel = decodeHtmlEntities(
    (html.match(/<p class="detail-meta">([\s\S]*?)<\/p>/i) || ["", ""])[1]
      .replace(/<[^>]+>/g, "")
      .trim()
  );

  const coverMatch = html.match(/<figure class="detail-cover"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
  const coverImage = coverMatch ? coverMatch[1] : `images/magazine/preview_thumb_${String(numericId).padStart(2, "0")}.png`;

  const bodyMatch = html.match(/<section class="detail-body">([\s\S]*?)<\/section>/i);
  let bodyHtml = bodyMatch ? bodyMatch[1].trim() : "";
  bodyHtml = bodyHtml.replace(/\s+white-space:\s*pre-line/gi, "");

  return {
    id,
    slug: id,
    numericId,
    title: fullTitle || (subtitle ? `${movieTitle} — ${subtitle}` : movieTitle),
    movieTitle,
    subtitle,
    publishedLabel,
    coverImage,
    thumbnail: coverImage,
    bodyHtml
  };
}

function main() {
  const listMeta = loadListMeta();
  const byNumeric = {};
  listMeta.forEach((row) => {
    byNumeric[row.id] = row;
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const indexItems = [];

  for (let n = 1; n <= 24; n++) {
    const file = path.join(ROOT, `magazine-preview-detail-${String(n).padStart(2, "0")}.html`);
    if (!fs.existsSync(file)) {
      console.warn("skip missing", file);
      continue;
    }
    const html = fs.readFileSync(file, "utf8");
    const article = extractDetailHtml(html, n);
    const meta = byNumeric[n] || {};
    article.title = meta.title || article.title;
    article.excerpt = meta.excerpt || "";
    article.thumbnail = meta.thumbnail || article.thumbnail;
    article.articleUrl = meta.articleUrl || "";
    article.sourceUrl = meta.articleUrl;

    const outPath = path.join(OUT_DIR, `${article.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(article, null, 2) + "\n", "utf8");

    indexItems.push({
      id: article.id,
      numericId: n,
      title: article.title,
      excerpt: article.excerpt,
      thumbnail: article.thumbnail
    });
    console.log("wrote", article.id);
  }

  const index = {
    section: "magazine-preview",
    label: "프리뷰",
    items: indexItems
  };
  fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log("index.json", indexItems.length, "items");
}

main();

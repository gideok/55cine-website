/**
 * magazine/serial/magazine-serial-detail-01~24.html → test/magazine/serial/data/*.json
 * 실행: node tools/extract-magazine-serial-json.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERIAL_DIR = path.join(ROOT, "magazine", "serial");
const OUT_DIR = path.join(ROOT, "test", "magazine", "serial", "data");
const DATA_JS = path.join(ROOT, "data", "magazine-serial-data.js");

function decodeHtmlEntities(s) {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function normalizeAssetPaths(html) {
  return html
    .replace(/\.\.\/\.\.\/images\//g, "images/")
    .replace(/\.\.\/images\//g, "images/");
}

function normalizeBodyHtml(html) {
  let out = normalizeAssetPaths(html);
  out = out.replace(/\s+onerror="[^"]*"/gi, "");
  out = out.replace(/\s+srcset="[^"]*"/gi, "");
  out = out.replace(/text-align:\s*(?:left|right|center|start|end)(?:\s*!important)?/gi, "");
  return out.trim();
}

function loadListMeta() {
  const window = {};
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(DATA_JS, "utf8"));
  if (!Array.isArray(window.MAGAZINE_SERIAL_DATA)) {
    throw new Error("MAGAZINE_SERIAL_DATA not found");
  }
  return window.MAGAZINE_SERIAL_DATA;
}

function extractDetailHtml(html, numericId) {
  const id = "sr" + String(numericId).padStart(3, "0");

  const titleTag = html.match(/<title>([^<]*)<\/title>/i);
  const pageTitle = titleTag ? decodeHtmlEntities(titleTag[1].replace(/\s*-\s*55CINE\s*$/i, "").trim()) : "";

  const h1Title = decodeHtmlEntities(
    (html.match(/<h1[^>]*class="detail-title"[^>]*>([\s\S]*?)<\/h1>/i) || ["", ""])[1]
      .replace(/<[^>]+>/g, "")
      .trim()
  );

  const publishedLabel = decodeHtmlEntities(
    (html.match(/<p class="detail-meta">([\s\S]*?)<\/p>/i) || ["", ""])[1]
      .replace(/<[^>]+>/g, "")
      .trim()
  );

  const coverMatch = html.match(/<figure class="detail-cover"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
  let coverImage = coverMatch ? normalizeAssetPaths(coverMatch[1]) : "";
  if (!coverImage) {
    coverImage = `images/magazine/serial/serial_thumb_${String(numericId).padStart(2, "0")}.png`;
  }

  const bodyMatch = html.match(/<section class="detail-body">([\s\S]*?)<\/section>/i);
  const bodyHtml = bodyMatch ? normalizeBodyHtml(bodyMatch[1]) : "";

  return {
    id,
    slug: id,
    numericId,
    title: h1Title || pageTitle,
    publishedLabel,
    date: publishedLabel,
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
    const file = path.join(SERIAL_DIR, `magazine-serial-detail-${String(n).padStart(2, "0")}.html`);
    if (!fs.existsSync(file)) {
      console.warn("skip missing", file);
      continue;
    }
    const html = fs.readFileSync(file, "utf8");
    const article = extractDetailHtml(html, n);
    const meta = byNumeric[n] || {};
    article.title = meta.title || article.title;
    article.date = meta.date || article.publishedLabel;
    article.publishedLabel = article.date;
    article.thumbnail = meta.thumbnail || article.thumbnail;
    article.coverImage = meta.thumbnail || article.coverImage;
    article.sourceUrl = meta.sourceUrl || "";

    const outPath = path.join(OUT_DIR, `${article.id}.json`);
    fs.writeFileSync(outPath, JSON.stringify(article, null, 2) + "\n", "utf8");

    indexItems.push({
      id: article.id,
      numericId: n,
      title: article.title,
      date: article.date,
      thumbnail: article.thumbnail
    });
    console.log("wrote", article.id);
  }

  const index = {
    section: "magazine-serial",
    label: "연재",
    items: indexItems
  };
  fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log("index.json", indexItems.length, "items");
}

main();

/**
 * Tistory 「지난 기사」 74건 크롤 → test/magazine/past-articles/data/
 * - 본문(contents_style) HTML·이미지만 수집
 * - container_postbtn / Related Articles / OG 썸네일 제외
 * 실행: node tools/crawl-past-articles.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "test", "magazine", "past-articles", "data");
const IMG_DIR = path.join(ROOT, "images", "magazine", "past-articles");
const CAT_URL =
  "https://55cinema.tistory.com/category/%EC%A7%80%EB%82%9C%20%EA%B8%B0%EC%82%AC";
const BASE = "https://55cinema.tistory.com";
const DELAY_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 (55cine-crawler)" } }, (res) => {
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

function normalizeRemoteUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  return url;
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

function clearDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((name) => {
    fs.unlinkSync(path.join(dir, name));
  });
}

async function collectEntryUrls() {
  const urls = new Set();
  for (let page = 1; page <= 30; page++) {
    const url = page === 1 ? CAT_URL : CAT_URL + "?page=" + page;
    const html = await fetchText(url);
    const matches = [...html.matchAll(/href="(\/entry\/[^"?#]+)"/g)];
    if (!matches.length) break;
    matches.forEach((m) => urls.add(BASE + m[1]));
    await sleep(200);
  }
  return [...urls];
}

/** 본문 영역만: contents_style ~ container_postbtn 직전 */
function extractBodyHtml(html) {
  const openTag = '<div class="tt_article_useless_p_margin contents_style">';
  const startIdx = html.indexOf(openTag);
  if (startIdx < 0) return "";

  const contentStart = startIdx + openTag.length;
  const endMarkers = [
    '<div class="container_postbtn',
    '<div class="container_postbtn ',
    '<div id="entry',
  ];

  let endIdx = html.length;
  for (const marker of endMarkers) {
    const i = html.indexOf(marker, contentStart);
    if (i > contentStart && i < endIdx) endIdx = i;
  }

  return html.slice(contentStart, endIdx).trim();
}

function isExcludedImageUrl(url) {
  if (!url) return true;
  if (/^data:/i.test(url)) return true;
  if (/no-image|tistory_admin\/static/i.test(url)) return true;
  if (/img1\.daumcdn\.net\/thumb\//i.test(url)) return true;
  return false;
}

/** 본문 HTML 안 imageblock / img 순서대로 실제 이미지 URL만 */
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
    ...bodyHtml.matchAll(/<figure[^>]*class="[^"]*imageblock[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi),
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

function extractArticle(html, sourceUrl) {
  const ogTitle = html.match(/property="og:title" content="([^"]+)"/);
  const title = decodeHtml((ogTitle && ogTitle[1]) || "")
    .replace(/\s*:\s*매거진.*$/, "")
    .trim();

  const published =
    (html.match(/property="article:published_time" content="([^"]+)"/) ||
      html.match(/name="published_time" content="([^"]+)"/) ||
      [])[1] || "";

  const bodyHtml = extractBodyHtml(html);
  const imgUrls = extractBodyImageUrls(bodyHtml);
  const excerpt = stripTags(bodyHtml).slice(0, 220);

  return { title, published, bodyHtml, imgUrls, excerpt, sourceUrl };
}

function extFromUrl(url) {
  const m = url.match(/\.(jpe?g|png|gif|webp)(\?|$)/i);
  return m ? "." + m[1].toLowerCase().replace("jpeg", "jpg") : ".jpg";
}

async function downloadImage(remoteUrl, destPath) {
  remoteUrl = normalizeRemoteUrl(remoteUrl);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(remoteUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          try {
            fs.unlinkSync(destPath);
          } catch (e) {
            /* noop */
          }
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, remoteUrl).href;
          downloadImage(next, destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          reject(new Error("HTTP " + res.statusCode));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(destPath)));
      })
      .on("error", reject);
  });
}

function cleanStyleValue(styleContent) {
  return styleContent
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const prop = part.split(":")[0].trim().toLowerCase();
      return !prop.startsWith("background");
    })
    .join("; ")
    .trim();
}

function stripBackgroundStyles(html) {
  if (!html) return "";
  let out = html.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (_match, quote, styleContent) => {
    const cleaned = cleanStyleValue(styleContent);
    if (!cleaned) return "";
    return ` style=${quote}${cleaned}${quote}`;
  });
  out = out.replace(/\sbgcolor=(["'])[^"']*\1/gi, "");
  out = out.replace(/\sbgcolor=[^\s>]+/gi, "");
  return out;
}

function stripBrokenImageHandlers(html) {
  return html
    .replace(/\s+onerror="[^"]*"/gi, "")
    .replace(/\s+srcset="[^"]*"/gi, "");
}

function rewriteBodyHtml(html, orderedPairs) {
  let out = stripBrokenImageHandlers(html);
  orderedPairs.forEach(({ remote, local }) => {
    if (!remote || !local) return;
    out = out.split(remote).join(local);
    const enc = remote.replace(/&/g, "&amp;");
    if (enc !== remote) out = out.split(enc).join(local);
    const ampRemote = remote.replace(/&/g, "&amp;");
    out = out.split(ampRemote).join(local);
  });
  return stripBackgroundStyles(out);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "/" + m + "/" + day;
}

async function main() {
  console.log("Removing previous images and JSON…");
  clearDirectory(IMG_DIR);
  clearDirectory(OUT_DIR);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(IMG_DIR, { recursive: true });

  console.log("Collecting entry URLs from", CAT_URL);
  const entryUrls = await collectEntryUrls();
  console.log("Found", entryUrls.length, "articles");

  const listItems = [];
  const articles = [];

  for (let i = 0; i < entryUrls.length; i++) {
    const sourceUrl = entryUrls[i];
    const id = "pa" + String(i + 1).padStart(3, "0");

    process.stderr.write("[" + (i + 1) + "/" + entryUrls.length + "] " + id + "\n");
    await sleep(DELAY_MS);

    let html;
    try {
      html = await fetchText(sourceUrl);
    } catch (err) {
      console.error("FAIL fetch", sourceUrl, err.message);
      continue;
    }

    const parsed = extractArticle(html, sourceUrl);
    const orderedPairs = [];
    const attachments = [];

    for (let imgIdx = 0; imgIdx < parsed.imgUrls.length; imgIdx++) {
      const remote = parsed.imgUrls[imgIdx];
      const ext = extFromUrl(remote);
      const fileName = id + "-" + String(imgIdx + 1).padStart(2, "0") + ext;
      const relPath = "images/magazine/past-articles/" + fileName;
      const absPath = path.join(ROOT, relPath);

      try {
        await downloadImage(remote, absPath);
        await sleep(120);
      } catch (err) {
        console.error("  img fail", id, remote.slice(0, 72), err.message);
        continue;
      }

      orderedPairs.push({ remote, local: relPath });
      attachments.push({
        path: relPath,
        alt: parsed.title + (parsed.imgUrls.length > 1 ? " " + (imgIdx + 1) : ""),
      });
    }

    const coverLocal = attachments[0] ? attachments[0].path : "";
    const bodyHtml = rewriteBodyHtml(parsed.bodyHtml, orderedPairs);

    const article = {
      id,
      slug: id,
      title: parsed.title,
      publishedAt: parsed.published,
      publishedLabel: formatDate(parsed.published),
      excerpt: parsed.excerpt,
      coverImage: coverLocal,
      bodyHtml,
      attachments,
      sourceUrl,
    };

    articles.push(article);
    listItems.push({
      id,
      slug: id,
      title: parsed.title,
      excerpt: parsed.excerpt,
      thumbnail: coverLocal,
      publishedLabel: article.publishedLabel,
    });

    fs.writeFileSync(
      path.join(OUT_DIR, id + ".json"),
      JSON.stringify(article, null, 2) + "\n",
      "utf8"
    );
  }

  const index = {
    version: 1,
    updatedAt: new Date().toISOString(),
    total: listItems.length,
    items: listItems,
  };

  fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
  fs.writeFileSync(
    path.join(OUT_DIR, "articles-bundle.json"),
    JSON.stringify({ articles }, null, 2) + "\n",
    "utf8"
  );

  const imgCount = fs.readdirSync(IMG_DIR).length;
  console.log("Done:", listItems.length, "articles,", imgCount, "images");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

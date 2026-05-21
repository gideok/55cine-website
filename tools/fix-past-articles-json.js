/**
 * 크롤 JSON 본문·요약 정리
 * node tools/fix-past-articles-json.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "test", "magazine", "past-articles", "data");
const IMG_DIR = path.join(ROOT, "images", "magazine", "past-articles");

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

function cleanBodyHtml(html) {
  if (!html) return "";
  var m = html.match(
    /<div class="tt_article_useless_p_margin contents_style">([\s\S]*?)<\/div>\s*(?:<!-- System|<div class="container_postbtn")/
  );
  if (m) return m[1].trim();
  m = html.match(/<div class="entry-content"[^>]*>[\s\S]*?<div class="tt_article_useless_p_margin contents_style">([\s\S]*?)<\/div>/);
  if (m) return m[1].trim();
  return html;
}

function cleanExcerpt(bodyHtml, title) {
  var text = stripTags(bodyHtml);
  text = text.replace(/^지난 기사\/지난 리뷰\s*/i, "");
  if (title) {
    var t = stripTags(title);
    if (text.indexOf(t) === 0) text = text.slice(t.length).trim();
  }
  text = text.replace(/^ousam\s*/i, "");
  text = text.replace(/\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*\d{1,2}:\d{2}\s*/g, "");
  return text.slice(0, 220);
}

function normalizeImgSrc(html) {
  return html.replace(/src="\/\//g, 'src="https://');
}

function cleanStyleValue(styleContent) {
  return styleContent
    .split(";")
    .map(function (part) {
      return part.trim();
    })
    .filter(function (part) {
      if (!part) return false;
      var prop = part.split(":")[0].trim().toLowerCase();
      return prop.indexOf("background") !== 0;
    })
    .join("; ")
    .trim();
}

function stripBackgroundStyles(html) {
  if (!html) return "";
  var out = html.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, function (match, quote, styleContent) {
    var cleaned = cleanStyleValue(styleContent);
    if (!cleaned) return "";
    return ' style=' + quote + cleaned + quote;
  });
  out = out.replace(/\sbgcolor=(["'])[^"']*\1/gi, "");
  out = out.replace(/\sbgcolor=[^\s>]+/gi, "");
  return out;
}

function getArticleImageFiles(articleId) {
  if (!fs.existsSync(IMG_DIR)) return [];
  return fs
    .readdirSync(IMG_DIR)
    .filter(function (name) {
      return name.indexOf(articleId + "-") === 0;
    })
    .sort()
    .map(function (name) {
      return "images/magazine/past-articles/" + name;
    });
}

function stripBrokenImageHandlers(html) {
  return html
    .replace(/\s+onerror="[^"]*"/gi, "")
    .replace(/\s+srcset="[^"]*"/gi, "");
}

function remapBodyImages(html, imageFiles, coverImage) {
  if (!html) return "";
  var files = imageFiles.length ? imageFiles.slice() : coverImage ? [coverImage] : [];
  if (!files.length) return stripBrokenImageHandlers(html);

  var idx = 0;
  return stripBrokenImageHandlers(html).replace(/src="([^"]+)"/gi, function (_match, src) {
    if (/no-image/i.test(src)) {
      var fallback = files[Math.min(idx, files.length - 1)];
      idx += 1;
      return 'src="' + fallback + '"';
    }
    if (/^https?:\/\//i.test(src) || src.indexOf("//") === 0) {
      var remote = files[Math.min(idx, files.length - 1)];
      idx += 1;
      return 'src="' + remote + '"';
    }
    var local = files[Math.min(idx, files.length - 1)];
    idx += 1;
    return 'src="' + local + '"';
  });
}

function syncAttachments(article, imageFiles) {
  article.attachments = imageFiles.map(function (filePath, i) {
    return {
      path: filePath,
      alt: article.title + (imageFiles.length > 1 ? " " + (i + 1) : "")
    };
  });
  if (!article.coverImage && imageFiles[0]) {
    article.coverImage = imageFiles[imageFiles.length - 1];
  }
}

const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "index.json"), "utf8"));
const items = [];

index.items.forEach(function (item) {
  var filePath = path.join(DATA_DIR, item.id + ".json");
  if (!fs.existsSync(filePath)) return;
  var article = JSON.parse(fs.readFileSync(filePath, "utf8"));
  article.slug = item.id;
  article.bodyHtml = normalizeImgSrc(cleanBodyHtml(article.bodyHtml));
  var imageFiles = getArticleImageFiles(item.id);
  article.bodyHtml = remapBodyImages(article.bodyHtml, imageFiles, article.coverImage);
  article.bodyHtml = stripBackgroundStyles(article.bodyHtml);
  syncAttachments(article, imageFiles);
  if (article.coverImage && imageFiles.indexOf(article.coverImage) === -1) {
    article.coverImage = imageFiles[imageFiles.length - 1] || article.coverImage;
  }
  article.excerpt = cleanExcerpt(article.bodyHtml, article.title);
  item.slug = item.id;
  item.excerpt = article.excerpt;
  fs.writeFileSync(filePath, JSON.stringify(article, null, 2) + "\n", "utf8");
  items.push(item);
});

index.items = items;
index.total = items.length;
fs.writeFileSync(path.join(DATA_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");

var bundleArticles = items.map(function (item) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, item.id + ".json"), "utf8"));
});
fs.writeFileSync(
  path.join(DATA_DIR, "articles-bundle.json"),
  JSON.stringify({ articles: bundleArticles }, null, 2) + "\n",
  "utf8"
);

console.log("Fixed", items.length, "articles");

/**
 * 현재 상영 slug HTML → movie-detail.html?slug= 리다이렉트 stub
 *
 * 사용: node tools/sync-now-playing-slug-redirects.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "movies/now-playing/data/now-playing-movies.json");
const OUT_DIR = path.join(ROOT, "movies/now-playing");
const TEMPLATE_NAME = "movie-detail.html";

function redirectHtml(slug) {
  const q = "../movie-detail.html?slug=" + encodeURIComponent(slug);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0;url=${q}" />
  <link rel="canonical" href="${q}" />
  <title>리다이렉트 — 55CINE</title>
  <script>location.replace("${q}");</script>
</head>
<body>
  <p><a href="${q}">영화 상세로 이동</a></p>
</body>
</html>
`;
}

const catalog = JSON.parse(fs.readFileSync(DATA, "utf8"));
const movies = Array.isArray(catalog.movies) ? catalog.movies : [];
const activeSlugs = new Set();

movies.forEach(function (movie) {
  if (!movie.slug) return;
  activeSlugs.add(movie.slug);
  const out = path.join(OUT_DIR, movie.slug + ".html");
  fs.writeFileSync(out, redirectHtml(movie.slug), "utf8");
  console.log("redirect", path.relative(ROOT, out));
});

let removed = 0;
fs.readdirSync(OUT_DIR).forEach(function (name) {
  if (!name.endsWith(".html")) return;
  if (name === TEMPLATE_NAME) return;
  const slug = name.slice(0, -5);
  if (activeSlugs.has(slug)) return;
  fs.unlinkSync(path.join(OUT_DIR, name));
  console.log("removed", path.relative(ROOT, path.join(OUT_DIR, name)));
  removed += 1;
});

console.log("Done:", activeSlugs.size, "redirect(s), removed", removed, "stale file(s)");

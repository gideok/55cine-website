/**
 * 현재 상영작만 slug HTML 생성 + 종료된 slug 파일 정리(prune)
 *
 * 사용: node tools/sync-now-playing-slug-pages.js
 *
 * SEO URL을 slug 파일 없이 쓰려면 웹서버 rewrite로
 *   /movies/now-playing/{slug}.html → movie-detail.html
 * 한 파일만 배포해도 됩니다 (아래 getMovieSlug 가 ?slug= 도 지원).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "test/movies/now-playing/data/now-playing-movies.json");
const TEMPLATE = path.join(ROOT, "test/movies/now-playing/movie-detail.html");
const OUT_DIR = path.join(ROOT, "test/movies/now-playing");
const TEMPLATE_NAME = "movie-detail.html";

const catalog = JSON.parse(fs.readFileSync(DATA, "utf8"));
const template = fs.readFileSync(TEMPLATE, "utf8");
const movies = Array.isArray(catalog.movies) ? catalog.movies : [];
const activeSlugs = new Set();

movies.forEach(function (movie) {
  if (!movie.slug) return;
  activeSlugs.add(movie.slug);
  const out = path.join(OUT_DIR, movie.slug + ".html");
  fs.writeFileSync(out, template, "utf8");
  console.log("wrote", path.relative(ROOT, out));
});

var removed = 0;
fs.readdirSync(OUT_DIR).forEach(function (name) {
  if (!name.endsWith(".html")) return;
  if (name === TEMPLATE_NAME) return;
  var slug = name.slice(0, -5);
  if (activeSlugs.has(slug)) return;
  fs.unlinkSync(path.join(OUT_DIR, name));
  console.log("removed", path.relative(ROOT, path.join(OUT_DIR, name)));
  removed += 1;
});

console.log("Done: active", activeSlugs.size, "slug pages, removed", removed, "stale file(s)");

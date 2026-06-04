/**
 * now-playing / upcoming / past movies JSON → web_program 상세 필드 시드
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import { getSqlConfig } from "./db-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const JSON_FILES = [
  "movies/now-playing/data/now-playing-movies.json",
  "movies/now-playing/data/upcoming-movies.json",
  "movies/now-playing/data/past-movies.json"
];

/** 화면 표시는 info · runningtime분 · 등급이미지 — DB info 는 첫 '·' 앞(장르 등)만 */
function extractInfoField(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const dot = text.indexOf("·");
  if (dot === -1) return text;
  return text.slice(0, dot).trim();
}

function collectMovies() {
  const bySlug = new Map();
  for (const rel of JSON_FILES) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const m of data.movies || []) {
      if (!m.slug) continue;
      if (!bySlug.has(m.slug)) bySlug.set(m.slug, m);
    }
  }
  return bySlug;
}

async function findProgId(pool, movie) {
  const bySlug = await pool
    .request()
    .input("slug", sql.NVarChar, movie.slug)
    .query(`SELECT prog_id FROM dbo.web_program WHERE slug = @slug`);
  if (bySlug.recordset[0]) return bySlug.recordset[0].prog_id;

  const byName = await pool
    .request()
    .input("name", sql.NVarChar, movie.titleKo)
    .query(`SELECT TOP 1 prog_id FROM dbo.prog_base WHERE LTRIM(RTRIM(name)) = @name`);
  return byName.recordset[0]?.prog_id ?? null;
}

async function main() {
  const movies = collectMovies();
  const pool = await sql.connect(getSqlConfig());
  let updated = 0;
  let skipped = 0;

  for (const [slug, movie] of movies) {
    const progId = await findProgId(pool, movie);
    if (!progId) {
      console.warn("SKIP no prog:", slug, movie.titleKo);
      skipped++;
      continue;
    }

    const infoText = extractInfoField(movie.info);

    await pool
      .request()
      .input("progId", sql.Int, progId)
      .input("slug", sql.NVarChar, slug)
      .input("director", sql.NVarChar, movie.director || null)
      .input("cast", sql.NVarChar, movie.cast || null)
      .input("info", sql.NVarChar, infoText || null)
      .input("synopsis", sql.NVarChar(sql.MAX), movie.synopsis || null)
      .input("trailer", sql.NVarChar, movie.trailerYoutubeId || null)
      .query(`
        IF EXISTS (SELECT 1 FROM dbo.web_program WHERE prog_id = @progId)
          UPDATE dbo.web_program SET
            slug = COALESCE(slug, @slug),
            director = @director,
            cast_names = @cast,
            info = @info,
            synopsis = @synopsis,
            trailer_url = @trailer
          WHERE prog_id = @progId
        ELSE
          INSERT INTO dbo.web_program (prog_id, slug, director, cast_names, info, synopsis, trailer_url)
          VALUES (@progId, @slug, @director, @cast, @info, @synopsis, @trailer)
      `);

    console.log("OK", slug, "prog_id", progId, infoText ? `info="${infoText}"` : "");
    updated++;
  }

  await pool.close();
  console.log(`\nDone. updated=${updated}, skipped=${skipped}, total=${movies.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

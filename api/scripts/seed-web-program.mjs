/**
 * 포스터 파일이 있는 상영작 → web_program 생성 + wp_{seq}_{n} 이미지 복사
 * 사용: node scripts/seed-web-program.mjs [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import { getSqlConfig } from "./db-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const WP_DIR = path.join(ROOT, "images", "movies", "wp");
const force = process.argv.includes("--force");

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return [];
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  return data.movies || [];
}

function collectCatalog() {
  const bySlug = new Map();
  const sources = [
    "movies/now-playing/data/now-playing-movies.json",
    "movies/now-playing/data/upcoming-movies.json",
    "movies/now-playing/data/past-movies.json"
  ];
  for (const rel of sources) {
    for (const m of readJson(rel)) {
      if (!m.slug || !m.titleKo || !m.poster) continue;
      if (!bySlug.has(m.slug)) bySlug.set(m.slug, m);
    }
  }
  return Array.from(bySlug.values());
}

function extFromPoster(posterPath) {
  const ext = path.extname(posterPath);
  return ext && ext.length <= 5 ? ext.toLowerCase() : ".jpg";
}

function normalizeName(name) {
  return String(name || "").trim();
}

async function findProgId(pool, titleKo) {
  const exact = await pool
    .request()
    .input("name", sql.NVarChar, titleKo)
    .query(
      `SELECT TOP (1) prog_id, name FROM dbo.prog_base WHERE LTRIM(RTRIM(name)) = @name`
    );
  if (exact.recordset[0]) return exact.recordset[0].prog_id;

  const prefix = await pool
    .request()
    .input("name", sql.NVarChar, titleKo + "%")
    .query(
      `SELECT TOP (1) prog_id, name FROM dbo.prog_base WHERE LTRIM(RTRIM(name)) LIKE @name ORDER BY LEN(name)`
    );
  return prefix.recordset[0]?.prog_id ?? null;
}

async function main() {
  const cfg = getSqlConfig();
  if (!cfg) {
    console.error(".env DB 설정 필요");
    process.exit(1);
  }

  fs.mkdirSync(WP_DIR, { recursive: true });
  const catalog = collectCatalog();
  const pool = await sql.connect(cfg);
  let created = 0;
  let skipped = 0;

  for (const movie of catalog) {
    const srcRel = movie.poster.replace(/^\//, "");
    const srcAbs = path.join(ROOT, srcRel);
    if (!fs.existsSync(srcAbs)) {
      console.warn("SKIP (no file):", movie.titleKo, srcRel);
      skipped++;
      continue;
    }

    const progId = await findProgId(pool, movie.titleKo);
    if (!progId) {
      console.warn("SKIP (no prog_base):", movie.titleKo);
      skipped++;
      continue;
    }

    const existing = await pool
      .request()
      .input("progId", sql.Int, progId)
      .query(`SELECT seq FROM dbo.web_program WHERE prog_id = @progId`);

    if (existing.recordset[0] && !force) {
      console.log("EXISTS:", movie.titleKo, "seq", existing.recordset[0].seq);
      skipped++;
      continue;
    }

    if (existing.recordset[0] && force) {
      await pool
        .request()
        .input("progId", sql.Int, progId)
        .query(`DELETE FROM dbo.web_program WHERE prog_id = @progId`);
    }

    const insert = await pool
      .request()
      .input("progId", sql.Int, progId)
      .input("slug", sql.NVarChar, movie.slug)
      .query(`
        INSERT INTO dbo.web_program (prog_id, slug, detail_url, img_thumb, img1, img2, img3, img4, img5)
        OUTPUT INSERTED.seq
        VALUES (@progId, @slug, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
      `);

    const seq = insert.recordset[0].seq;
    const ext = extFromPoster(srcRel);
    const fileName = `wp_${seq}_1${ext}`;
    const destRel = `images/movies/wp/${fileName}`;
    const destAbs = path.join(ROOT, destRel);

    fs.copyFileSync(srcAbs, destAbs);

    await pool
      .request()
      .input("seq", sql.Int, seq)
      .input("thumb", sql.NVarChar, destRel)
      .query(`UPDATE dbo.web_program SET img_thumb = @thumb WHERE seq = @seq`);

    console.log("OK:", movie.titleKo, `prog_id=${progId}`, `seq=${seq}`, destRel);
    created++;
  }

  await pool.close();
  console.log(`\nDone. created=${created}, skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

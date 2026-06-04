/**
 * web_program.img1(원본 wp_*) → 40×40 thumb_wp_* 생성 후 img_thumb 갱신
 * img1 = 목록·상세 원본, img_thumb = GNB 시간표용 40×40
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
const THUMB_SIZE = 40;

function thumbNameFromSource(relPath) {
  const base = path.basename(relPath);
  if (!/^wp_/i.test(base)) return null;
  return "thumb_" + base.replace(/\.(jpe?g|png|webp)$/i, ".jpg");
}

async function main() {
  const cfg = getSqlConfig();
  if (!cfg) {
    console.error(".env DB 설정 필요");
    process.exit(1);
  }

  const pool = await sql.connect(cfg);

  const rows = (
    await pool.request().query(`
      SELECT seq, prog_id, slug, img_thumb, img1
      FROM dbo.web_program
      WHERE img1 IS NOT NULL AND img1 LIKE 'images/movies/wp/wp_%'
    `)
  ).recordset;

  let generated = 0;
  for (const row of rows) {
    const srcRel = String(row.img1).trim();
    const thumbFile = thumbNameFromSource(srcRel);
    if (!thumbFile) continue;

    const srcAbs = path.join(ROOT, srcRel);
    if (!fs.existsSync(srcAbs)) {
      console.warn("SKIP missing:", srcRel);
      continue;
    }

    const destRel = `images/movies/wp/${thumbFile}`;
    const destAbs = path.join(ROOT, destRel);

    await sharp(srcAbs)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
      .jpeg({ quality: 72, mozjpeg: true })
      .toFile(destAbs);

    await pool
      .request()
      .input("seq", sql.Int, row.seq)
      .input("imgThumb", sql.NVarChar, destRel)
      .query(`UPDATE dbo.web_program SET img_thumb = @imgThumb WHERE seq = @seq`);

    console.log("OK", row.slug || row.prog_id, destRel);
    generated++;
  }

  await pool.close();
  console.log(`\nDone. thumbnails=${generated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

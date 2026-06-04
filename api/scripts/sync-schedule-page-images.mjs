/**
 * 6/4 이후 시간표 상영작 + comingsoon(상자 속의 양, 이반리) — web_program·JSON 포스터 동기화
 * node scripts/sync-schedule-page-images.mjs [--force]
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

/** titleKo → slug, 55cine 포스터 URL, 목록 구간 */
const MOVIES = [
  { titleKo: "그녀가 돌아온 날", slug: "the-day-she-returns", section: "now-playing", imageUrl: "http://i2.wp.com/55cine.com/wp-content/uploads/2026/04/42d7e0c2ffa9403883539aac8bedba4c.jpg" },
  { titleKo: "남태령", slug: "namtaeryeong", section: "now-playing", imageUrl: "http://i0.wp.com/55cine.com/wp-content/uploads/2026/05/10da8e6f6b60442e8ca75c70fb4b8bee.jpg" },
  { titleKo: "달걀 원정대", slug: "riddle-of-fire", section: "now-playing", imageUrl: "http://i2.wp.com/55cine.com/wp-content/uploads/2026/04/sdsdssdadsd.jpg" },
  {
    titleKo: "세계의 주인",
    slug: "the-world-of-love",
    section: "now-playing",
    imageUrl: null,
    localPoster: "images/movies/now-playing/the-world-of-love-poster.jpg"
  },
  { titleKo: "순례자들은 왜 돌아오지 않는가", slug: "pilgrim", section: "now-playing", imageUrl: "http://i1.wp.com/55cine.com/wp-content/uploads/2026/05/u_poster.jpg" },
  { titleKo: "너바나 더 밴드", slug: "nirvanna-the-band-the-show-the-movie", section: "now-playing", imageUrl: "http://i2.wp.com/55cine.com/wp-content/uploads/2026/05/57892189db184a0aa75b55ffd9ebbd99.jpg", titleMatch: "너바나" },
  { titleKo: "교생실습", slug: "teaching-practice", section: "now-playing", imageUrl: "http://i2.wp.com/55cine.com/wp-content/uploads/2026/05/2516bc1679374eb79bd5997a1219154a.jpg" },
  { titleKo: "뒷자리에 태워줘", slug: "pillion", section: "now-playing", imageUrl: "http://i2.wp.com/55cine.com/wp-content/uploads/2026/05/m_poster.jpg" },
  { titleKo: "누룩", slug: "the-yeast", section: "now-playing", imageUrl: "http://i1.wp.com/55cine.com/wp-content/uploads/2026/04/sssddd.jpg" },
  { titleKo: "유레카", slug: "eureka", section: "now-playing", imageUrl: null },
  { titleKo: "상자 속의 양", slug: "sheep-in-the-box", section: "upcoming", imageUrl: "http://i2.wp.com/55cine.com/wp-content/uploads/2026/05/e474a1a8c38747e29ba12b53ef980b2d.jpg" },
  { titleKo: "이반리 장만옥", slug: "manok", section: "upcoming", imageUrl: "http://i1.wp.com/55cine.com/wp-content/uploads/2026/05/2848faa39bab4525b736b9274c3826e1.jpg" }
];

async function findProgId(pool, movie) {
  const exact = await pool
    .request()
    .input("name", sql.NVarChar, movie.titleKo)
    .query(`SELECT TOP (1) prog_id FROM dbo.prog_base WHERE LTRIM(RTRIM(name)) = @name`);
  if (exact.recordset[0]) return exact.recordset[0].prog_id;

  const prefix = movie.titleMatch || movie.titleKo;
  const like = await pool
    .request()
    .input("name", sql.NVarChar, prefix + "%")
    .query(`SELECT TOP (1) prog_id FROM dbo.prog_base WHERE LTRIM(RTRIM(name)) LIKE @name ORDER BY LEN(name)`);
  return like.recordset[0]?.prog_id ?? null;
}

function normalizeDownloadUrl(url) {
  return String(url)
    .replace(/^https?:\/\/i[0-9]\.wp\.com\/55cine\.com\//i, "http://55cine.com/")
    .replace(/^https:\/\/55cine\.com/i, "http://55cine.com");
}

async function downloadImage(url, destAbs) {
  const res = await fetch(normalizeDownloadUrl(url));
  if (!res.ok) throw new Error(`download failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.writeFileSync(destAbs, buf);
}

async function upsertWebProgram(pool, movie, progId) {
  const existing = await pool
    .request()
    .input("progId", sql.Int, progId)
    .query(`SELECT seq, img_thumb FROM dbo.web_program WHERE prog_id = @progId`);

  if (existing.recordset[0] && !force && existing.recordset[0].img_thumb) {
    return existing.recordset[0];
  }

  if (existing.recordset[0] && force) {
    await pool.request().input("progId", sql.Int, progId).query(`DELETE FROM dbo.web_program WHERE prog_id = @progId`);
  }

  const ins = await pool
    .request()
    .input("progId", sql.Int, progId)
    .input("slug", sql.NVarChar, movie.slug)
    .query(`
      INSERT INTO dbo.web_program (prog_id, slug, detail_url, img_thumb, img1, img2, img3, img4, img5)
      OUTPUT INSERTED.seq
      VALUES (@progId, @slug, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
    `);

  const seq = ins.recordset[0].seq;
  let thumbPath = null;

  if (movie.imageUrl) {
    const ext = ".jpg";
    thumbPath = `images/movies/wp/wp_${seq}_1${ext}`;
    await downloadImage(movie.imageUrl, path.join(ROOT, thumbPath));
  } else if (movie.localPoster && fs.existsSync(path.join(ROOT, movie.localPoster))) {
    const ext = path.extname(movie.localPoster) || ".jpg";
    thumbPath = `images/movies/wp/wp_${seq}_1${ext}`;
    fs.copyFileSync(path.join(ROOT, movie.localPoster), path.join(ROOT, thumbPath));
    await pool
      .request()
      .input("seq", sql.Int, seq)
      .input("thumb", sql.NVarChar, thumbPath)
      .query(`UPDATE dbo.web_program SET img_thumb = @thumb WHERE seq = @seq`);
  }

  return { seq, img_thumb: thumbPath };
}

function readJsonFile(rel) {
  const p = path.join(ROOT, rel);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJsonFile(rel, data) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2) + "\n", "utf8");
}

function applyPosterToMovies(movies, slug, poster) {
  return movies.map((m) => (m.slug === slug && poster ? { ...m, poster } : m));
}

async function loadWebProgramBySlug(pool) {
  const r = await pool.request().query(`
    SELECT prog_id, slug, img_thumb, img1, detail_url
    FROM dbo.web_program
    WHERE slug IS NOT NULL
  `);
  const map = new Map();
  for (const row of r.recordset) {
    map.set(row.slug, row);
  }
  return map;
}

async function main() {
  const cfg = getSqlConfig();
  if (!cfg) {
    console.error(".env DB 설정 필요");
    process.exit(1);
  }

  fs.mkdirSync(WP_DIR, { recursive: true });
  const pool = await sql.connect(cfg);

  for (const movie of MOVIES) {
    const progId = await findProgId(pool, movie);
    if (!progId) {
      console.warn("SKIP prog_base:", movie.titleKo);
      continue;
    }
    try {
      const row = await upsertWebProgram(pool, movie, progId);
      console.log("OK", movie.titleKo, `seq=${row.seq}`, row.img_thumb || "(no image)");
    } catch (e) {
      console.error("FAIL", movie.titleKo, e.message);
    }
  }

  const bySlug = await loadWebProgramBySlug(pool);

  const nowList = {
    movies: [
      { slug: "the-day-she-returns", titleKo: "그녀가 돌아온 날", titleEn: "The Day She Returns" },
      { slug: "namtaeryeong", titleKo: "남태령", titleEn: "The Longest Night: Namtaeryeong" },
      { slug: "riddle-of-fire", titleKo: "달걀 원정대", titleEn: "Riddle of Fire" },
      { slug: "the-world-of-love", titleKo: "세계의 주인", titleEn: "The World of Love" },
      { slug: "pilgrim", titleKo: "순례자들은 왜 돌아오지 않는가", titleEn: "Why Don't Pilgrims Return" },
      { slug: "nirvanna-the-band-the-show-the-movie", titleKo: "너바나 더 밴드", titleEn: "Nirvanna the Band the Show the Movie" },
      { slug: "teaching-practice", titleKo: "교생실습", titleEn: "Teaching Practice" },
      { slug: "pillion", titleKo: "뒷자리에 태워줘", titleEn: "Pillion" },
      { slug: "the-yeast", titleKo: "누룩", titleEn: "The Yeast" },
      { slug: "eureka", titleKo: "유레카", titleEn: "Eureka" }
    ].map((m) => ({
      ...m,
      poster: bySlug.get(m.slug)?.img1 || "images/schedule-poster-placeholder.svg"
    }))
  };

  const upcomingList = {
    movies: [
      { slug: "sheep-in-the-box", titleKo: "상자 속의 양", titleEn: "Sheep in The Box" },
      { slug: "manok", titleKo: "이반리 장만옥", titleEn: "Manok" }
    ].map((m) => ({
      ...m,
      poster: bySlug.get(m.slug)?.img1 || "images/schedule-poster-placeholder.svg"
    }))
  };

  writeJsonFile("movies/now-playing/data/now-playing-list.json", nowList);
  writeJsonFile("movies/now-playing/data/upcoming-list.json", upcomingList);

  const detailAdds = {
    pilgrim: {
      slug: "pilgrim",
      titleKo: "순례자들은 왜 돌아오지 않는가",
      titleEn: "Why Don't the Pilgrims Return",
      director: "—",
      cast: "—",
      info: "다큐멘터리 · 61분 ·",
      ratingImage: "images/rate_12.png",
      ratingAlt: "12세이상관람가",
      releaseDate: "2026.6.4",
      synopsis: "6월 4일부터 오오극장 상영.",
      trailerYoutubeId: "",
      screenings: []
    },
    eureka: {
      slug: "eureka",
      titleKo: "유레카",
      titleEn: "Eureka",
      director: "리스andro 코스타",
      cast: "—",
      info: "드라마 · 218분 ·",
      ratingImage: "images/rate_15.png",
      ratingAlt: "15세이상관람가",
      releaseDate: "2026.6.6",
      synopsis: "6월 6일부터 오오극장 상영.",
      trailerYoutubeId: "",
      screenings: []
    },
    "sheep-in-the-box": {
      slug: "sheep-in-the-box",
      titleKo: "상자 속의 양",
      titleEn: "Sheep in The Box",
      director: "고레에다 히로카즈",
      cast: "아야세 하루카, 다이고",
      info: "드라마, SF · 126분 31초 ·",
      ratingImage: "images/rate_12.png",
      ratingAlt: "12세이상관람가",
      releaseDate: "2026.6.10",
      synopsis:
        "7세 설정으로 태어난 휴머노이드 로봇. 어느 날, 엄마 아빠가 생겼다. 엄마라 부르는 여자, 아저씨라 부르는 남자가 있는 따뜻한 2층 집에서 계속 사랑받으며 살 수 있을까?",
      trailerYoutubeId: "",
      screenings: [{ dateLabel: "06.10.(수)", timeLabel: "13:35" }, { dateLabel: "06.10.(수)", timeLabel: "20:05" }]
    },
    manok: {
      slug: "manok",
      titleKo: "이반리 장만옥",
      titleEn: "Manok",
      director: "이유진",
      cast: "양말복, 성재윤, 박완규, 김정영, 색자",
      info: "드라마 · 108분 9초 ·",
      ratingImage: "images/rate_12.png",
      ratingAlt: "12세이상관람가",
      releaseDate: "2026.6.10",
      synopsis:
        "서울에서 망하고 고향 이반리로 돌아온 만옥. 재기하려 발버둥 치지만 전남편이 이장으로 군림하며 방해하자, 직접 이장 선거에 출사표를 던진다.",
      trailerYoutubeId: "",
      screenings: [{ dateLabel: "06.10.(수)", timeLabel: "11:30" }, { dateLabel: "06.10.(수)", timeLabel: "18:00" }]
    },
    pillion: {
      slug: "pillion",
      titleKo: "뒷자리에 태워줘",
      titleEn: "Pillion",
      director: "해리 라이튼",
      cast: "해리 멜링, 알렉산더 스카스가",
      info: "드라마 · 107분 ·",
      ratingImage: "images/rate_19.png",
      ratingAlt: "청소년관람불가",
      releaseDate: "2026.6.5",
      synopsis: "레이의 뒷자리에 타면서 시작된 사랑의 여정.",
      trailerYoutubeId: "8VG2dxkwE3w",
      screenings: []
    }
  };

  function mergeDetailMovies(movies, slugSet) {
    const slugs = new Set(movies.map((m) => m.slug));
    for (const [slug, row] of bySlug) {
      const add = detailAdds[slug];
      if (!add) continue;
      const poster = row.img1 || row.img_thumb || "images/schedule-poster-placeholder.svg";
      if (slugs.has(slug)) {
        movies = applyPosterToMovies(movies, slug, poster);
      } else if (slugSet.has(slug)) {
        movies.push({ ...add, poster });
      }
    }
    return movies;
  }

  const np = readJsonFile("movies/now-playing/data/now-playing-movies.json");
  const npSlugs = new Set(nowList.movies.map((m) => m.slug));
  writeJsonFile("movies/now-playing/data/now-playing-movies.json", {
    movies: mergeDetailMovies(np.movies || [], npSlugs)
  });

  const up = readJsonFile("movies/now-playing/data/upcoming-movies.json");
  const upSlugs = new Set(upcomingList.movies.map((m) => m.slug));
  writeJsonFile("movies/now-playing/data/upcoming-movies.json", {
    movies: mergeDetailMovies(
      (up.movies || []).filter((m) => upSlugs.has(m.slug)),
      upSlugs
    )
  });

  await pool.close();
  console.log("\nJSON updated: now-playing-list, upcoming-list, *-movies.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

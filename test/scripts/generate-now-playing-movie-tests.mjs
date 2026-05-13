/**
 * movies/now-playing/*.html → test/movies/now-playing/*.html (ti-shell + mono)
 * 실행: node test/scripts/generate-now-playing-movie-tests.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.join(ROOT, "movies", "now-playing");
const OUT_DIR = path.join(ROOT, "test", "movies", "now-playing");

const SLUGS = [
  "riddle-of-fire",
  "the-day-she-returns",
  "tango-at-dawn",
  "the-voice-of-hind-rajab",
  "the-yeast",
  "have-you-seen-the-land-of-the-red",
  "dear-juhee",
  "the-world-of-love"
];

function extractTabSuffix(html) {
  const m = html.match(/getElementById\("movie-tab-synopsis-([^"]+)"\)/);
  return m ? m[1] : "";
}

function buildShell({ title, mainInner, tabSuffix }) {
  const tabScript = `
    (function () {
      var movieTabSynopsis = document.getElementById("movie-tab-synopsis-${tabSuffix}");
      var movieTabTrailer = document.getElementById("movie-tab-trailer-${tabSuffix}");
      var moviePanelSynopsis = document.getElementById("movie-tabpanel-synopsis-${tabSuffix}");
      var moviePanelTrailer = document.getElementById("movie-tabpanel-trailer-${tabSuffix}");
      if (!movieTabSynopsis || !movieTabTrailer || !moviePanelSynopsis || !moviePanelTrailer) return;

      function activateMovieDetailTab(which) {
        var isSynopsis = which === "synopsis";
        movieTabSynopsis.setAttribute("aria-selected", isSynopsis ? "true" : "false");
        movieTabTrailer.setAttribute("aria-selected", !isSynopsis ? "true" : "false");
        movieTabSynopsis.tabIndex = isSynopsis ? 0 : -1;
        movieTabTrailer.tabIndex = !isSynopsis ? 0 : -1;
        moviePanelSynopsis.hidden = !isSynopsis;
        moviePanelTrailer.hidden = isSynopsis;
      }

      movieTabSynopsis.addEventListener("click", function () {
        activateMovieDetailTab("synopsis");
      });
      movieTabTrailer.addEventListener("click", function () {
        activateMovieDetailTab("trailer");
      });
    })();
`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — 테스트 UI · 55CINE</title>
  <link rel="icon" href="../../../favicon.ico" sizes="48x48 32x32 16x16" />
  <link rel="shortcut icon" href="../../../favicon.ico" type="image/x-icon" />
  <link rel="stylesheet" href="../../../components/site-common.css" />
  <link rel="stylesheet" href="../../css/test-ti-fonts.css" />
  <link rel="stylesheet" href="../../css/test-ti-fonts-display.css" />
  <link rel="stylesheet" href="../../css/test-ti-shell.css" />
  <link rel="stylesheet" href="../../css/test-ti-site-footer.css" />
  <link rel="stylesheet" href="../../../components/movie-detail-layout.css" />
  <link rel="stylesheet" href="../../css/test-ti-movie-detail-test.css" />
</head>
<body class="ti">
  <div class="ti-shell">
    <div class="ti-left">
      <div class="ti-left-top">
        <a class="ti-home" href="../../../index.html">← Home / index</a>
        <nav class="ti-gnb" aria-label="사이트 메뉴 (아코디언)">
          <details>
            <summary>오오극장</summary>
            <ul>
              <li><a href="../../theater-info.html">소개</a></li>
              <li><a href="../../viewing-guide.html">관람 안내</a></li>
              <li><a href="../../membership.html">멤버십</a></li>
              <li><a href="../../daegwan.html">대관</a></li>
              <li><a href="../../osinneun-gil.html">오시는 길</a></li>
            </ul>
          </details>
          <details open>
            <summary>상영작</summary>
            <ul>
              <li><a class="ti-current" href="../../now-playing-test.html" aria-current="page">현재 상영작</a></li>
              <li><a href="#">상영 예정작</a></li>
              <li><a href="#">지난 상영작</a></li>
            </ul>
          </details>
          <details>
            <summary>예매</summary>
            <ul>
              <li><a href="#">예매하기</a></li>
            </ul>
          </details>
          <details>
            <summary>기획전·행사</summary>
            <ul>
              <li><a href="../../special-exhibition-test.html">기획전</a></li>
              <li><a href="#">행사</a></li>
            </ul>
          </details>
          <details>
            <summary>매거진 삼삼오오</summary>
            <ul>
              <li><a href="../../magazine-preview-test.html">프리뷰</a></li>
              <li><a href="../../../magazine-serial.html">연재</a></li>
              <li><a href="../../../gv-moment.html">GV 모먼트</a></li>
              <li><a href="#">지난 기사</a></li>
            </ul>
          </details>
          <details>
            <summary>테스트</summary>
            <ul>
              <li><a href="../../test-intro.html">테스트인트로</a></li>
              <li><a href="../../special-exhibition-test.html">기획전</a></li>
              <li><a href="../../now-playing-test.html">현재 상영작</a></li>
              <li><a href="../../movie-detail-test.html">영화 상세 (샘플)</a></li>
              <li><a href="../../magazine-preview-test.html">매거진 프리뷰</a></li>
            </ul>
          </details>
        </nav>
      </div>
      <div class="ti-left-bottom">
        <h2 class="ti-sched-title">이번주 시간표</h2>
        <div class="ti-day-tabs" id="tiDayTabs" role="tablist" aria-label="요일 선택"></div>
        <div class="ti-sched-scroll" id="tiSchedulePanels"></div>
      </div>
      <footer
        class="ti-footer ti-footer--slot-pc site-footer"
        data-ti-site-footer
        data-ti-asset-base="../../../"
        aria-label="사이트 정보"
      ></footer>
    </div>
    <aside class="ti-right ti-md-panel" aria-label="영화 상세 본문">
      <div class="ti-md-scroll ti-md-test-wrap">
${mainInner}
      </div>
    </aside>
    <footer
      class="ti-footer ti-footer--slot-mobile site-footer"
      data-ti-site-footer
      data-ti-asset-base="../../../"
      aria-label="사이트 정보"
    ></footer>
  </div>

  <script src="../../js/test-ti-site-footer-include.js"></script>
  <script>
    window.TEST_TI_ASSET_BASE = "../../../";
  </script>
  <script src="../../../data/week-schedule-data.js"></script>
  <script src="../../js/test-ti-week-schedule.js"></script>
  <script>${tabScript}</script>
</body>
</html>
`;
}

function transformMain(inner) {
  let s = inner;
  s = s.replace(/href="\.\.\/\.\.\/now-playing\.html"/g, 'href="../../now-playing-test.html"');
  s = s.replace(/\.\.\/\.\.\/images\//g, "../../../images/");
  return s;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  let t = m ? m[1].trim() : "영화 상세";
  t = t.replace(/\s*—\s*현재 상영작\s*—\s*55CINE\s*$/i, "").trim();
  return t || "영화 상세";
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const slug of SLUGS) {
  const srcPath = path.join(SRC_DIR, `${slug}.html`);
  const html = fs.readFileSync(srcPath, "utf8");
  const mainM = html.match(/<main>\s*([\s\S]*?)\s*<\/main>/i);
  if (!mainM) {
    console.error("No <main> in", srcPath);
    process.exit(1);
  }
  const title = extractTitle(html);
  const tabSuffix = extractTabSuffix(html);
  if (!tabSuffix) {
    console.error("No tab suffix in", slug);
    process.exit(1);
  }
  const mainInner = transformMain(mainM[1].trim());
  const out = buildShell({ title, mainInner, tabSuffix });
  const outPath = path.join(OUT_DIR, `${slug}.html`);
  fs.writeFileSync(outPath, out, "utf8");
  console.log("Wrote", path.relative(ROOT, outPath));
}

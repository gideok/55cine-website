/**
 * 공통 헤더·푸터 주입 (components/header.html, components/footer.html)
 * HTTP(s)로 열면 fetch로 최신 HTML을 불러오고, file:// 로 열면 브라우저 보안상
 * fetch가 실패하므로 아래 EMBEDDED_* 내장 마크업을 사용합니다.
 *
 * >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
 * SYNC 필수: header.html / footer.html 을 바꾼 뒤에는 반드시 이 파일의
 *            EMBEDDED_HEADER / EMBEDDED_FOOTER 문자열도 동일하게 맞출 것.
 *            (한쪽만 수정하면 file:// 또는 fetch 실패 시 마크업이 어긋납니다.)
 * <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 */
(function () {
  var scripts = document.getElementsByTagName("script");
  var baseUrl = "";
  for (var i = scripts.length - 1; i >= 0; i--) {
    if (scripts[i].src && scripts[i].src.indexOf("site-chrome.js") !== -1) {
      baseUrl = new URL(".", scripts[i].src).href;
      break;
    }
  }

  var EMBEDDED_HEADER =
    '<header class="site-header">' +
    '<div class="header-top">' +
    '<div class="header-brand-tools">' +
    '<a href="index.html" class="logo"><img src="images/logo.png" width="142" height="100" alt="55CINE 오오극장" decoding="async" /> 독립영화전용관 오오극장</a>' +
    "<!-- 폰트 선택 UI (Spoqa Han Sans Neo 고정으로 비활성)" +
    '<label class="font-test-select-wrap" for="siteFontSelect">' +
    '<span class="visually-hidden">폰트 테스트</span>' +
    '<select id="siteFontSelect" class="font-test-select" aria-label="폰트 테스트">' +
    '<option value="noto">Noto Sans</option>' +
    '<option value="asta">Asta Sans</option>' +
    '<option value="dohyeon">Do Hyun</option>' +
    '<option value="pretendard">Pretendard</option>' +
    '<option value="spoqa">Spoqa Han Sans Neo</option>' +
    "</select>" +
    "</label>" +
    "-->" +
    "</div>" +
    '<button type="button" class="btn-menu" id="gnbToggle" aria-controls="gnb-panel" aria-expanded="false" aria-label="메뉴 열기">MENU</button>' +
    '<div id="gnb-panel" class="gnb-panel">' +
    '<nav class="gnb" aria-label="주 메뉴">' +
    '<ul class="gnb-depth1-list">' +
    '<li class="gnb-item">' +
    '<a class="gnb-depth1" href="#">오오극장</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="theater-info.html">소개</a></li>' +
    '<li><a href="viewing-guide.html">관람 안내</a></li>' +
    '<li><a href=\"membership.html\">멤버십</a></li>' +
    '<li><a href="daegwan.html">대관</a></li>' +
    '<li><a href="osinneun-gil.html">오시는 길</a></li>' +
    '' +
    "</ul>" +
    "</div>" +
    "</li>" +
    '<li class="gnb-item">' +
    '<a class="gnb-depth1" href="now-playing.html">상영작</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="now-playing.html">현재 상영작</a></li>' +
    '<li><a href="#">상영 예정작</a></li>' +
    '<li><a href="#">지난 상영작</a></li>' +
    "</ul>" +
    "</div>" +
    "</li>" +
    '<li class="gnb-item">' +
    '<a class="gnb-depth1" href="#">예매</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="#">예매하기</a></li>' +
    "</ul>" +
    "</div>" +
    "</li>" +
    '<li class="gnb-item">' +
    '<a class="gnb-depth1" href="special-exhibition.html">기획전·행사</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="special-exhibition.html">기획전</a></li>' +
    '<li><a href="#">행사</a></li>' +
    "</ul>" +
    "</div>" +
    "</li>" +
    '<li class="gnb-item">' +
    '<a class="gnb-depth1" href="magazine-preview.html">매거진 삼삼오오</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="magazine-preview.html">프리뷰</a></li>' +
    '<li><a href=\"magazine-serial.html\">연재</a></li>' +
    '<li><a href="gv-moment.html">GV 모먼트</a></li>' +
    '<li><a href="#">지난 기사</a></li>' +
    "</ul>" +
    "</div>" +
    "</li>" +
    '<li class="gnb-item">' +
    '<a class="gnb-depth1" href="#">테스트</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="test/test-intro.html">테스트인트로</a></li>' +
    '<li><a href="test/special-exhibition-test.html">기획전</a></li>' +
    "</ul>" +
    "</div>" +
    "</li>" +
    "</ul>" +
    "</nav>" +
    "</div>" +
    "</div>" +
    "</header>";

  var EMBEDDED_FOOTER =
    '<footer class="site-footer">' +
    '<div class="biz">' +
    '<div class="footer-logo-box" aria-hidden="true">' +
    '<img src="images/logo_footer_transparent.png" alt="" width="1536" height="1024" decoding="async" />' +
    "</div>" +
    '<div class="footer-text">' +
    "<p>사업자등록번호 <strong>369-82-00211</strong></p>" +
    "<p>대구경북영화영상사회적협동조합</p>" +
    "<p>대표 <strong>손영득</strong></p>" +
    "<p>대구광역시 중구 국채보상로 537<br />(수동 1-6번지), 곽병원과 만경관 사이</p>" +
    "<p>T. <strong>053 425 3553</strong></p>" +
    '<p class="copyright">Copyright © All Rights Reserved 오오극장 2026</p>' +
    '<nav class="footer-sns" aria-label="소셜 미디어">' +
    '<a class="footer-sns__link" href="https://www.instagram.com/55cine/" target="_blank" rel="noopener noreferrer">' +
    '<svg class="footer-sns__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2c2.717 0 3.056.01 4.122.06 1.064.049 1.79.218 2.428.465.654.254 1.206.598 1.758 1.15.552.552.896 1.104 1.15 1.758.247.637.416 1.364.465 2.428.048 1.066.06 1.405.06 4.122 0 2.717-.012 3.056-.06 4.122-.049 1.064-.218 1.79-.465 2.428-.254.654-.598 1.206-1.15 1.758-.552.552-1.104.896-1.758 1.15-.637.247-1.364.416-2.428.465-1.066.048-1.405.06-4.122.06-2.717 0-3.056-.012-4.122-.06-1.064-.049-1.79-.218-2.428-.465-.654-.254-1.206-.598-1.758-1.15-.552-.552-.896-1.104-1.15-1.758-.247-.637-.416-1.364-.465-2.428C2.015 15.056 2 14.717 2 12s.015-3.056.06-4.122.218-1.79.465-2.428.254-.654.598-1.206 1.15-1.758.552-.552 1.104-.896 1.758-1.15.637-.247 1.364-.416 2.428-.465C8.944 2.015 9.283 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm6.5-.25a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z"/></svg>' +
    '<span>인스타그램 <span class="footer-sns__handle">@55cine</span></span></a>' +
    '<span class="footer-sns__sep" aria-hidden="true">·</span>' +
    '<a class="footer-sns__link" href="https://www.facebook.com/55cine" target="_blank" rel="noopener noreferrer">' +
    '<svg class="footer-sns__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M24 12.073C24 5.446 18.627 0 12 0S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>' +
    '<span>페이스북 <span class="footer-sns__handle">@55cine</span></span></a>' +
    '<span class="footer-sns__sep" aria-hidden="true">·</span>' +
    '<a class="footer-sns__link" href="https://x.com/55cinema" target="_blank" rel="noopener noreferrer">' +
    '<svg class="footer-sns__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' +
    '<span>X <span class="footer-sns__handle">@55cinema</span></span></a>' +
    "</nav>" +
    "</div>" +
    "</div>" +
    "</footer>";

  function load(name) {
    return fetch(new URL(name, baseUrl)).then(function (r) {
      if (!r.ok) throw new Error(name + ": " + r.status);
      return r.text();
    });
  }

  /**
   * 헤더·푸터의 링크·이미지는 사이트 루트 기준이지만, 문자열상 상대경로만 두었기 때문에
   * 서브폴더(예: gv/moment/*.html, special/exhibition/*.html)에서 열면 현재 디렉터리 기준으로
   * 잘못 해석된다. components/site-chrome.js 의 부모 디렉터리를 사이트 루트로 보고 절대 URL로 고친다.
   */
  function getSiteRootHref() {
    var scripts = document.getElementsByTagName("script");
    var chromeSrc = "";
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf("site-chrome.js") !== -1) {
        chromeSrc = scripts[i].src;
        break;
      }
    }
    if (!chromeSrc) return "";
    var scriptDir = new URL(".", chromeSrc);
    var siteRoot = new URL("..", scriptDir);
    var href = siteRoot.href;
    return href.charAt(href.length - 1) === "/" ? href : href + "/";
  }

  function rewriteChromeRootRelativeUrls() {
    var root = getSiteRootHref();
    if (!root) return;
    var nodes = document.querySelectorAll(".site-header a[href], .site-header img[src], .site-footer a[href], .site-footer img[src]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var attr = el.tagName === "A" ? "href" : "src";
      var raw = el.getAttribute(attr);
      if (!raw || raw === "#" || raw.charAt(0) === "#") continue;
      if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(raw)) continue;
      if (raw.indexOf("//") === 0) continue;
      try {
        el.setAttribute(attr, new URL(raw, root).href);
      } catch (err) {
        /* noop */
      }
    }
  }

  function applyChrome(headerHtml, footerHtml) {
    var hm = document.getElementById("site-header-mount");
    var fm = document.getElementById("site-footer-mount");
    if (hm && headerHtml) hm.outerHTML = headerHtml;
    if (fm && footerHtml) fm.outerHTML = footerHtml;
    rewriteChromeRootRelativeUrls();
    document.dispatchEvent(new CustomEvent("sitechrome:ready"));
  }

  var hm = document.getElementById("site-header-mount");
  var fm = document.getElementById("site-footer-mount");
  if (!hm && !fm) {
    document.dispatchEvent(new CustomEvent("sitechrome:ready"));
    return;
  }

  var isFile = typeof location !== "undefined" && location.protocol === "file:";

  if (isFile) {
    applyChrome(EMBEDDED_HEADER, EMBEDDED_FOOTER);
    return;
  }

  Promise.all([hm ? load("header.html") : Promise.resolve(null), fm ? load("footer.html") : Promise.resolve(null)])
    .then(function (parts) {
      applyChrome(parts[0] || EMBEDDED_HEADER, parts[1] || EMBEDDED_FOOTER);
    })
    .catch(function (err) {
      console.warn("[site-chrome] fetch 실패, 내장 마크업을 사용합니다.", err);
      applyChrome(EMBEDDED_HEADER, EMBEDDED_FOOTER);
    });
})();

/**
 * 공통 헤더·푸터 주입 (components/header.html, components/footer.html)
 * HTTP(s)로 열면 fetch로 최신 HTML을 불러오고, file:// 로 열면 브라우저 보안상
 * fetch가 실패하므로 아래 EMBEDDED_* 내장 마크업을 사용합니다.
 * 헤더·푸터를 수정할 때는 header.html / footer.html 과 EMBEDDED_* 를 함께 맞춰 주세요.
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
    '<a href="demo.html" class="logo"><img src="images/logo.png" width="142" height="100" alt="55CINE 오오극장" decoding="async" /> 독립영화전용관 오오극장</a>' +
    '<label class="font-test-select-wrap" for="siteFontSelect">' +
    '<span class="visually-hidden">폰트 테스트</span>' +
    '<select id="siteFontSelect" class="font-test-select" aria-label="폰트 테스트">' +
    '<option value="noto">Noto Sans</option>' +
    '<option value="asta">Asta Sans</option>' +
    '<option value="dohyeon">Do Hyun</option>' +
    '<option value="pretendard">Pretendard</option>' +
    '<option value="spoqa">Spoqa Han Sans</option>' +
    "</select>" +
    "</label>" +
    "</div>" +
    '<button type="button" class="btn-menu" id="gnbToggle" aria-controls="gnb-panel" aria-expanded="false" aria-label="메뉴 열기">MENU</button>' +
    '<div id="gnb-panel" class="gnb-panel">' +
    '<nav class="gnb" aria-label="주 메뉴">' +
    '<ul class="gnb-depth1-list">' +
    '<li class="gnb-item">' +
    '<a class="gnb-depth1" href="#">오오극장</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="#">오오극장 소개</a></li>' +
    '<li><a href="#">관람 안내</a></li>' +
    '<li><a href="#">멤버십</a></li>' +
    '<li><a href="daegwan.html">대관</a></li>' +
    '<li><a href="#">오시는 길</a></li>' +
    '<li><a href="#">공지사항</a></li>' +
    "</ul>" +
    "</div>" +
    "</li>" +
    '<li class="gnb-item">' +
    '<a class="gnb-depth1" href="demo.html#hero">상영작</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="demo.html#hero">현재 상영작</a></li>' +
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
    '<a class="gnb-depth1" href="#">기획전·행사</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="#">기획전</a></li>' +
    '<li><a href="#">행사</a></li>' +
    "</ul>" +
    "</div>" +
    "</li>" +
    '<li class="gnb-item">' +
    '<a class="gnb-depth1" href="#">매거진 삼삼오오</a>' +
    '<div class="gnb-dropdown">' +
    '<ul class="gnb-depth2 gnb-dropdown-inner">' +
    '<li><a href="#">프리뷰</a></li>' +
    '<li><a href="#">연재</a></li>' +
    '<li><a href="#">GV 모먼트</a></li>' +
    '<li><a href="#">지난 기사</a></li>' +
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
    '<img src="images/logo_footer.png" alt="" width="526" height="948" decoding="async" />' +
    "</div>" +
    '<div class="footer-text">' +
    "<p>사업자등록번호 <strong>369-82-00211</strong></p>" +
    "<p>대구경북영화영상사회적협동조합</p>" +
    "<p>대표 <strong>손영득</strong></p>" +
    "<p>대구광역시 중구 국채보상로 537<br />(수동 1-6번지), 곽병원과 만경관 사이</p>" +
    "<p>T. <strong>053 425 3553</strong></p>" +
    '<p class="copyright">Copyright © All Rights Reserved 오오극장 2026</p>' +
    "</div>" +
    "</div>" +
    "</footer>";

  function load(name) {
    return fetch(new URL(name, baseUrl)).then(function (r) {
      if (!r.ok) throw new Error(name + ": " + r.status);
      return r.text();
    });
  }

  function applyChrome(headerHtml, footerHtml) {
    var hm = document.getElementById("site-header-mount");
    var fm = document.getElementById("site-footer-mount");
    if (hm && headerHtml) hm.outerHTML = headerHtml;
    if (fm && footerHtml) fm.outerHTML = footerHtml;
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

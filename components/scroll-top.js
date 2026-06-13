/**
 * 페이지를 일정 이상 아래로 스크롤하면 우측 하단에 TOP 버튼 표시.
 * 영화 상세 페이지에서는 그 위에 [예매] 링크를 함께 표시합니다.
 * 모든 정적 페이지에서 components/scroll-top.js 를 defer 로 불러오면 동작합니다.
 */
(function () {
  var BTN_ID = "siteScrollTopBtn";
  var WRAP_ID = "siteScrollTopFabWrap";
  var TICKET_ID = "siteTicketFabBtn";
  var SHOW_AFTER = 240;
  var TICKET_HREF =
    "https://www.dtryx.com/cinema/main.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059";

  if (document.getElementById(BTN_ID) || document.getElementById(WRAP_ID)) {
    return;
  }

  function isMovieDetailPage() {
    var p = String(location.pathname || "").replace(/\\/g, "/");
    if (/movie-detail(-type2)?\.html$/i.test(p)) return true;
    if (/\/movies\/now-playing\/.+\.html$/i.test(p)) return true;
    return false;
  }

  function scrollTopIconUrl() {
    var cs = document.currentScript;
    if (cs && cs.src) {
      try {
        return new URL("../images/scroll-top.png", cs.src).href;
      } catch (e) {
        /* ignore */
      }
    }
    return "images/scroll-top.png";
  }

  var movieDetail = isMovieDetailPage();
  var scrollTopIcon = scrollTopIconUrl();

  var style = document.createElement("style");
  style.textContent =
    "#" +
    BTN_ID +
    "{" +
    "position:fixed;" +
    "right:max(16px,env(safe-area-inset-right));" +
    "bottom:max(20px,env(safe-area-inset-bottom));" +
    "z-index:95;" +
    "display:flex;" +
    "align-items:center;" +
    "justify-content:center;" +
    "width:56px;" +
    "height:56px;" +
    "padding:0;" +
    "border:none;" +
    "border-radius:50%;" +
    "background:transparent;" +
    "cursor:pointer;" +
    "opacity:0;" +
    "visibility:hidden;" +
    "transform:translateY(12px);" +
    "transition:opacity .22s ease,visibility .22s ease,transform .22s ease;" +
    "}" +
    "#" +
    BTN_ID +
    " img{" +
    "display:block;" +
    "width:56px;" +
    "height:56px;" +
    "object-fit:contain;" +
    "pointer-events:none;" +
    "}" +
    "#" +
    BTN_ID +
    ".is-visible{" +
    "opacity:1;" +
    "visibility:visible;" +
    "transform:translateY(0);" +
    "}" +
    "#" +
    BTN_ID +
    ":hover{" +
    "transform:translateY(0) scale(1.04);" +
    "}" +
    "#" +
    BTN_ID +
    ":focus-visible{" +
    "outline:2px solid var(--brand-walnut,#4a3d27);" +
    "outline-offset:3px;" +
    "}" +
    "#" +
    WRAP_ID +
    "{" +
    "position:fixed;" +
    "right:max(16px,env(safe-area-inset-right));" +
    "bottom:max(20px,env(safe-area-inset-bottom));" +
    "z-index:95;" +
    "display:flex;" +
    "flex-direction:column;" +
    "align-items:stretch;" +
    "gap:10px;" +
    "opacity:0;" +
    "visibility:hidden;" +
    "transform:translateY(12px);" +
    "transition:opacity .22s ease,visibility .22s ease,transform .22s ease;" +
    "}" +
    "#" +
    WRAP_ID +
    ".is-visible{" +
    "opacity:1;" +
    "visibility:visible;" +
    "transform:translateY(0);" +
    "}" +
    "#" +
    WRAP_ID +
    " #" +
    TICKET_ID +
    "{" +
    "display:flex;" +
    "align-items:center;" +
    "justify-content:center;" +
    "min-height:52px;" +
    "padding:0 16px;" +
    "border-radius:999px;" +
    "font-family:inherit;" +
    "font-size:0.72rem;" +
    "font-weight:800;" +
    "letter-spacing:0.06em;" +
    "text-decoration:none;" +
    "color:#fff;" +
    "background:var(--brand-ink,#1c1610);" +
    "border:1px solid color-mix(in srgb,var(--brand-ink,#1c1610) 88%,#000);" +
    "box-shadow:0 6px 22px rgba(28,22,16,.22);" +
    "transition:filter .15s ease,transform .12s ease;" +
    "}" +
    "#" +
    WRAP_ID +
    " #" +
    TICKET_ID +
    ":hover{" +
    "filter:brightness(1.08);" +
    "}" +
    "#" +
    WRAP_ID +
    " #" +
    TICKET_ID +
    ":focus-visible{" +
    "outline:2px solid var(--brand-gold,#f0ab2a);" +
    "outline-offset:3px;" +
    "}" +
    "#" +
    WRAP_ID +
    ".is-visible #" +
    BTN_ID +
    "{" +
    "position:relative;" +
    "right:auto;" +
    "bottom:auto;" +
    "opacity:1;" +
    "visibility:visible;" +
    "transform:translateY(0);" +
    "}";
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.type = "button";
  btn.setAttribute("aria-label", "맨 위로 이동");
  var btnIcon = document.createElement("img");
  btnIcon.src = scrollTopIcon;
  btnIcon.alt = "";
  btnIcon.width = 56;
  btnIcon.height = 56;
  btnIcon.decoding = "async";
  btn.appendChild(btnIcon);

  var targetEl;

  if (movieDetail) {
    var wrap = document.createElement("div");
    wrap.id = WRAP_ID;
    wrap.setAttribute("aria-label", "예매 및 맨 위로 이동");

    var ticket = document.createElement("a");
    ticket.id = TICKET_ID;
    ticket.href = TICKET_HREF;
    ticket.target = "_blank";
    ticket.rel = "noopener noreferrer";
    ticket.setAttribute("aria-label", "예매하기(새 창)");
    ticket.textContent = "예매";

    wrap.appendChild(ticket);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
    targetEl = wrap;
  } else {
    document.body.appendChild(btn);
    targetEl = btn;
  }

  var ticking = false;

  function scrollY() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function updateVisibility() {
    ticking = false;
    var y = scrollY();
    if (y > SHOW_AFTER) {
      targetEl.classList.add("is-visible");
    } else {
      targetEl.classList.remove("is-visible");
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateVisibility);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  updateVisibility();

  btn.addEventListener("click", function () {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
    btn.blur();
  });
})();

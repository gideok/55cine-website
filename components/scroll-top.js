/**
 * 페이지를 일정 이상 아래로 스크롤하면 우측 하단에 TOP 버튼 표시.
 * 모든 정적 페이지에서 components/scroll-top.js 를 defer 로 불러오면 동작합니다.
 */
(function () {
  var BTN_ID = "siteScrollTopBtn";
  var SHOW_AFTER = 240;

  if (document.getElementById(BTN_ID)) {
    return;
  }

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
    "min-width:52px;" +
    "min-height:52px;" +
    "padding:0 14px;" +
    "border:none;" +
    "border-radius:999px;" +
    "font-family:inherit;" +
    "font-size:0.72rem;" +
    "font-weight:800;" +
    "letter-spacing:0.06em;" +
    "color:var(--brand-ink,#1c1610);" +
    "background:linear-gradient(145deg,var(--brand-gold,#f0ab2a) 0%,var(--brand-gold-mid,#ca9128) 100%);" +
    "box-shadow:0 6px 22px rgba(28,22,16,.28);" +
    "cursor:pointer;" +
    "opacity:0;" +
    "visibility:hidden;" +
    "transform:translateY(12px);" +
    "transition:opacity .22s ease,visibility .22s ease,transform .22s ease;" +
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
    "filter:brightness(1.05);" +
    "}" +
    "#" +
    BTN_ID +
    ":focus-visible{" +
    "outline:2px solid var(--brand-walnut,#4a3d27);" +
    "outline-offset:3px;" +
    "}";
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.type = "button";
  btn.setAttribute("aria-label", "맨 위로 이동");
  btn.textContent = "TOP";
  document.body.appendChild(btn);

  var ticking = false;

  function scrollY() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function updateVisibility() {
    ticking = false;
    var y = scrollY();
    if (y > SHOW_AFTER) {
      btn.classList.add("is-visible");
    } else {
      btn.classList.remove("is-visible");
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

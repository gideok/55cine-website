/**
 * 세로 스크롤이 있고 일정 이상 내려간 경우에만 우측 하단 TOP 버튼 표시.
 * 스크롤 루트: window + #tiShell 안 공통 패널(.mz-scroll 등) + [data-ti-scroll-root]
 */
(function () {
  var THRESHOLD = 80;
  var SELECTORS =
    ".mz-scroll, .sub-scroll, .viewing-scroll, .theater-scroll, .np-scroll, .md-scroll, [data-ti-scroll-root]";

  var btn;
  var innerRoots = [];
  var debounceTimer;
  var reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function scrollTopIconUrl() {
    if (window.TiSiteRoot && typeof window.TiSiteRoot.relativePrefix === "function") {
      return window.TiSiteRoot.relativePrefix() + "images/scroll-top.png";
    }
    var path = (location.pathname || "").replace(/\\/g, "/");
    var segments = path.split("/").filter(Boolean);
    var depth = segments.length;
    if (depth && /\.html?$/i.test(segments[depth - 1])) {
      depth = Math.max(0, depth - 1);
    }
    var prefix = depth > 0 ? new Array(depth).fill("..").join("/") + "/" : "";
    return prefix + "images/scroll-top.png";
  }

  function scrollYOf(root) {
    if (root === window) {
      return window.scrollY || document.documentElement.scrollTop || 0;
    }
    return root.scrollTop || 0;
  }

  function maxScrollY(root) {
    if (root === window) {
      var el = document.documentElement;
      return Math.max(0, el.scrollHeight - window.innerHeight);
    }
    return Math.max(0, root.scrollHeight - root.clientHeight);
  }

  function anyScrolledDown() {
    if (scrollYOf(window) > THRESHOLD) return true;
    for (var i = 0; i < innerRoots.length; i++) {
      if (scrollYOf(innerRoots[i]) > THRESHOLD) return true;
    }
    return false;
  }

  function anyScrollable() {
    if (maxScrollY(window) > 4) return true;
    for (var i = 0; i < innerRoots.length; i++) {
      if (maxScrollY(innerRoots[i]) > 4) return true;
    }
    return false;
  }

  function setVisible(show) {
    if (!btn) return;
    btn.classList.toggle("is-visible", show);
    btn.setAttribute("aria-hidden", show ? "false" : "true");
    btn.tabIndex = show ? 0 : -1;
  }

  function updateVisibility() {
    setVisible(anyScrollable() && anyScrolledDown());
  }

  function onScroll() {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(updateVisibility, 32);
  }

  function detachInner() {
    innerRoots.forEach(function (el) {
      el.removeEventListener("scroll", onScroll);
    });
    innerRoots = [];
  }

  function attachInner() {
    detachInner();
    var shell = document.getElementById("tiShell");
    if (!shell) return;
    shell.querySelectorAll(SELECTORS).forEach(function (el) {
      innerRoots.push(el);
      el.addEventListener("scroll", onScroll, { passive: true });
    });
  }

  function scrollAllToTop() {
    if (reducedMotion) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    innerRoots.forEach(function (el) {
      if (reducedMotion) el.scrollTop = 0;
      else {
        try {
          el.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e) {
          el.scrollTop = 0;
        }
      }
    });
    window.setTimeout(updateVisibility, reducedMotion ? 0 : 400);
  }

  function ensureButton() {
    if (document.getElementById("tiScrollTopBtn")) {
      btn = document.getElementById("tiScrollTopBtn");
      return;
    }
    btn = document.createElement("button");
    btn.id = "tiScrollTopBtn";
    btn.type = "button";
    btn.className = "scroll-top";
    btn.setAttribute("aria-label", "맨 위로");
    btn.setAttribute("aria-hidden", "true");
    btn.tabIndex = -1;
    var icon = document.createElement("img");
    icon.src = scrollTopIconUrl();
    icon.alt = "";
    icon.width = 56;
    icon.height = 56;
    icon.decoding = "async";
    btn.appendChild(icon);
    btn.addEventListener("click", function () {
      scrollAllToTop();
      btn.focus({ preventScroll: true });
    });
    document.body.appendChild(btn);
  }

  function init() {
    ensureButton();
    attachInner();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      attachInner();
      onScroll();
    });
    window.addEventListener("ti-left-gnb:loaded", function () {
      window.setTimeout(function () {
        attachInner();
        updateVisibility();
      }, 120);
    });
    window.addEventListener("ti-shell:relayout", function () {
      window.setTimeout(function () {
        attachInner();
        updateVisibility();
      }, 60);
    });
    updateVisibility();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

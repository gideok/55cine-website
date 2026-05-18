/**
 * 공용 PC 페이지네이션 (now-playing-test 기준)
 * 상단 .ti-page-toolbar + .ti-page-pager (이전 · 페이지 번호 · 다음)
 */
(function (global) {
  "use strict";

  var DESKTOP_MQ = window.matchMedia("(min-width: 900px)");

  function isDesktop() {
    return DESKTOP_MQ.matches;
  }

  function scrollToTop(scrollRootSelector) {
    var scrollEl = scrollRootSelector
      ? document.querySelector(scrollRootSelector)
      : document.querySelector(".ti-np-scroll, .ti-mz-scroll, .se-right-inner");
    if (scrollEl) {
      scrollEl.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  /**
   * @param {HTMLElement|null} navEl
   * @param {{ page: number, totalPages: number, onChange: function(number), scrollOnChange?: boolean, scrollRootSelector?: string }} options
   */
  function render(navEl, options) {
    if (!navEl) return;

    var page = Math.max(1, options.page || 1);
    var totalPages = Math.max(1, options.totalPages || 1);
    var onChange = options.onChange || function () {};
    var scrollOnChange = options.scrollOnChange !== false;

    navEl.innerHTML = "";

    if (!isDesktop() || totalPages <= 1) {
      navEl.classList.remove("is-visible");
      return;
    }

    navEl.classList.add("is-visible");

    function go(targetPage) {
      if (targetPage < 1 || targetPage > totalPages || targetPage === page) return;
      onChange(targetPage);
      if (scrollOnChange) scrollToTop(options.scrollRootSelector);
    }

    var prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "이전";
    prev.disabled = page <= 1;
    prev.addEventListener("click", function () {
      go(page - 1);
    });
    navEl.appendChild(prev);

    for (var p = 1; p <= totalPages; p++) {
      (function (num) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = String(num);
        if (num === page) btn.setAttribute("aria-current", "page");
        btn.addEventListener("click", function () {
          go(num);
        });
        navEl.appendChild(btn);
      })(p);
    }

    var next = document.createElement("button");
    next.type = "button";
    next.textContent = "다음";
    next.disabled = page >= totalPages;
    next.addEventListener("click", function () {
      go(page + 1);
    });
    navEl.appendChild(next);
  }

  function updateVisibility(navEl, totalPages) {
    if (!navEl) return;
    if (!isDesktop() || totalPages <= 1) {
      navEl.classList.remove("is-visible");
      navEl.innerHTML = "";
    }
  }

  function formatCount(total, page, totalPages, unit) {
    unit = unit || "건";
    if (isDesktop() && totalPages > 1) {
      return "총 " + total + unit + " · " + page + " / " + totalPages + " 페이지";
    }
    return "총 " + total + unit;
  }

  function formatMovies(total, page, totalPages) {
    return formatCount(total, page, totalPages, "편");
  }

  global.TiPagePager = {
    mq: DESKTOP_MQ,
    isDesktop: isDesktop,
    render: render,
    updateVisibility: updateVisibility,
    scrollToTop: scrollToTop,
    formatCount: formatCount,
    formatMovies: formatMovies
  };
})(window);

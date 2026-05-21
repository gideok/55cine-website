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

  var MAX_PAGE_BUTTONS = 10;

  /**
   * 페이지 번호 최대 10개 + 줄임표 (1·마지막 페이지는 유지)
   * @returns {Array<{ type: 'page', page: number }|{ type: 'ellipsis' }>}
   */
  function buildPageItems(current, total, maxNumeric) {
    maxNumeric = maxNumeric || MAX_PAGE_BUTTONS;
    if (total <= maxNumeric) {
      var all = [];
      for (var i = 1; i <= total; i++) {
        all.push({ type: "page", page: i });
      }
      return all;
    }

    var items = [{ type: "page", page: 1 }];
    var innerMax = maxNumeric - 2;
    var start = Math.max(2, current - Math.floor(innerMax / 2));
    var end = start + innerMax - 1;

    if (end >= total) {
      end = total - 1;
      start = Math.max(2, end - innerMax + 1);
    }
    if (start <= 2) {
      start = 2;
      end = Math.min(total - 1, start + innerMax - 1);
    }

    if (start > 2) items.push({ type: "ellipsis" });
    for (var p = start; p <= end; p++) {
      items.push({ type: "page", page: p });
    }
    if (end < total - 1) items.push({ type: "ellipsis" });
    items.push({ type: "page", page: total });
    return items;
  }

  /**
   * @param {HTMLElement|null} navEl
   * @param {{ page: number, totalPages: number, onChange: function(number), scrollOnChange?: boolean, scrollRootSelector?: string, maxPageButtons?: number }} options
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

    var maxButtons = options.maxPageButtons || MAX_PAGE_BUTTONS;
    var pageItems = buildPageItems(page, totalPages, maxButtons);

    pageItems.forEach(function (item) {
      if (item.type === "ellipsis") {
        var gap = document.createElement("span");
        gap.className = "ti-page-pager__ellipsis";
        gap.setAttribute("aria-hidden", "true");
        gap.textContent = "…";
        navEl.appendChild(gap);
        return;
      }

      (function (num) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = String(num);
        if (num === page) btn.setAttribute("aria-current", "page");
        btn.addEventListener("click", function () {
          go(num);
        });
        navEl.appendChild(btn);
      })(item.page);
    });

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
    buildPageItems: buildPageItems,
    updateVisibility: updateVisibility,
    scrollToTop: scrollToTop,
    formatCount: formatCount,
    formatMovies: formatMovies,
    MAX_PAGE_BUTTONS: MAX_PAGE_BUTTONS
  };
})(window);

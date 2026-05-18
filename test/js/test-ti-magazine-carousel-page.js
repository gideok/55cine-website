/**
 * 매거진 목록 페이지 공통 — 썸네일형(스크롤 스냅 캐러셀) / 목록형(12건·페이지)
 * window.TEST_TI_MAGAZINE_CAROUSEL_CONFIG 로 페이지별 설정
 */
(function () {
  var cfg = window.TEST_TI_MAGAZINE_CAROUSEL_CONFIG;
  if (!cfg || !cfg.dataKey) return;

  var ITEMS_PER_PAGE_LIST = 12;
  var SITE_ROOT_PREFIX = cfg.siteRootPrefix || "../";
  var currentPage = 1;
  var currentView = "thumb";

  var GRID_GAP_DESKTOP = 16;
  var GRID_GAP_MOBILE = 10;
  var THUMB_MIN_CELL_PX = 200;
  var MAX_THUMB_COLS = 4;
  var THUMB_IMG_H_PER_W = cfg.thumbImgRatio || 200 / 264;
  var TITLE_BLOCK_RESERVE_PX = cfg.titleBlockReservePx || 88;

  var dataset = [];
  var thumbItemsPerPage = 8;
  var thumbTotalPages = 1;
  var thumbActivePage = 0;
  var thumbLayoutKey = "";
  var thumbScrollEndTimer;
  var thumbLayoutTimer;
  var thumbResizeObserver;
  var thumbEventsBound;

  var mzThumbStack = document.getElementById("mzThumbStack");
  var mzSwipeViewport = document.getElementById("mzSwipeViewport");
  var mzSwipeTrack = document.getElementById("mzSwipeTrack");
  var mzSwipeHint = document.getElementById("mzSwipeHint");
  var listEl = document.getElementById(cfg.listId);
  var Pager = window.TiPagePager;
  var pagerCountEl = document.getElementById("pagerCount");
  var pagePagerEl = document.getElementById("tiPagePager");
  var fractionEl = document.getElementById("mzPagerFraction");
  var dotsEl = document.getElementById("mzPagerDots");
  var btnPrev = document.getElementById("mzPagerPrev");
  var btnNext = document.getElementById("mzPagerNext");

  function refreshDataset() {
    var raw = window[cfg.dataKey];
    dataset = Array.isArray(raw) ? raw.slice() : [];
  }

  function resolveHref(item) {
    if (typeof cfg.resolveHref === "function") return cfg.resolveHref(item) || "";
    var path = item && item.detailUrl ? item.detailUrl : "";
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("../")) return path;
    return SITE_ROOT_PREFIX + path.replace(/^\//, "");
  }

  function thumbSrc(src) {
    if (!src) return "";
    if (/^https?:/i.test(src)) return src;
    if (src.startsWith("../")) return src;
    return SITE_ROOT_PREFIX + src.replace(/^\//, "");
  }

  function getListTotalPages() {
    return Math.max(1, Math.ceil(dataset.length / ITEMS_PER_PAGE_LIST));
  }

  function getListPageItems(page) {
    var start = (page - 1) * ITEMS_PER_PAGE_LIST;
    return dataset.slice(start, start + ITEMS_PER_PAGE_LIST);
  }

  function gridGapPx() {
    if (!mzSwipeViewport || mzSwipeViewport.clientWidth <= 820) return GRID_GAP_MOBILE;
    return GRID_GAP_DESKTOP;
  }

  function getGridColumns() {
    if (!mzSwipeViewport) {
      return typeof window !== "undefined" && window.innerWidth <= 820 ? 2 : 4;
    }
    var w = mzSwipeViewport.clientWidth;
    if (w < 40) return 1;
    var gap = gridGapPx();
    var cols = Math.floor((w + gap) / (THUMB_MIN_CELL_PX + gap));
    return Math.max(1, Math.min(MAX_THUMB_COLS, cols));
  }

  function computeThumbItemsPerPage() {
    if (!mzSwipeViewport) return Math.max(4, getGridColumns() * 2);
    var cols = getGridColumns();
    var h = mzSwipeViewport.clientHeight;
    var w = mzSwipeViewport.clientWidth;
    var gap = gridGapPx();
    if (w < 40 || h < 40) return Math.max(cols * 2, cols);
    var cellW = (w - gap * Math.max(0, cols - 1)) / cols;
    var rowH = cellW * THUMB_IMG_H_PER_W + TITLE_BLOCK_RESERVE_PX;
    var rows = Math.floor((h + gap) / (rowH + gap));
    rows = Math.max(1, Math.min(16, rows));
    return rows * cols;
  }

  function getThumbTotalPages() {
    return Math.max(1, Math.ceil(dataset.length / thumbItemsPerPage));
  }

  function getThumbPageItems(pageIndex) {
    var start = pageIndex * thumbItemsPerPage;
    return dataset.slice(start, start + thumbItemsPerPage);
  }

  function createItemElement(item, withExcerpt) {
    var href = resolveHref(item);
    var article = document.createElement("article");
    article.className = cfg.itemClass;

    var thumbLink = document.createElement("a");
    thumbLink.className = cfg.thumbLinkClass;
    thumbLink.href = href;
    thumbLink.setAttribute("aria-label", item.title || "");

    var image = document.createElement("img");
    image.className = cfg.thumbClass;
    image.src = thumbSrc(item.thumbnail || "");
    image.alt = (item.title || "") + " 썸네일";
    image.loading = "lazy";
    thumbLink.appendChild(image);

    if (cfg.useTitleWrap) {
      var titleWrap = document.createElement("div");
      titleWrap.className = cfg.titleWrapClass;
      var titleLink = document.createElement("a");
      titleLink.className = cfg.titleLinkClass;
      titleLink.href = href;
      var title = document.createElement("h2");
      title.className = cfg.titleClass;
      title.textContent = item.title || "";
      titleLink.appendChild(title);
      titleWrap.appendChild(titleLink);
      if (cfg.showDate && item.date && cfg.dateClass) {
        var dateEl = document.createElement("p");
        dateEl.className = cfg.dateClass;
        dateEl.textContent = item.date;
        titleWrap.appendChild(dateEl);
      }
      article.appendChild(thumbLink);
      article.appendChild(titleWrap);
      return article;
    }

    var body = document.createElement("div");
    body.className = cfg.bodyClass;

    var titleLink = document.createElement("a");
    titleLink.className = cfg.titleLinkClass;
    titleLink.href = href;
    titleLink.textContent = item.title || "";
    body.appendChild(titleLink);

    if (withExcerpt && cfg.excerptLinkClass && item.excerpt) {
      var excerptLink = document.createElement("a");
      excerptLink.className = cfg.excerptLinkClass;
      excerptLink.href = href;
      excerptLink.textContent = item.excerpt;
      body.appendChild(excerptLink);
    }

    article.appendChild(thumbLink);
    article.appendChild(body);
    return article;
  }

  function buildThumbSlides() {
    if (!mzSwipeTrack) return;
    mzSwipeTrack.innerHTML = "";
    thumbTotalPages = getThumbTotalPages();
    for (var p = 0; p < thumbTotalPages; p++) {
      var slide = document.createElement("div");
      slide.className = "se-slide";
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-label", "페이지 " + (p + 1) + " / " + thumbTotalPages);

      var grid = document.createElement("div");
      grid.className = "se-grid";

      getThumbPageItems(p).forEach(function (item) {
        grid.appendChild(createItemElement(item, false));
      });

      slide.appendChild(grid);
      mzSwipeTrack.appendChild(slide);
    }
  }

  function updateThumbDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = "";
    for (var i = 0; i < thumbTotalPages; i++) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "se-dot" + (i === thumbActivePage ? " is-active" : "");
      dot.setAttribute("aria-label", "페이지 " + (i + 1));
      dot.addEventListener(
        "click",
        (function (page) {
          return function () {
            goToThumbPage(page);
          };
        })(i)
      );
      dotsEl.appendChild(dot);
    }
  }

  function updateListDots() {
    if (!dotsEl) return;
    var total = getListTotalPages();
    dotsEl.innerHTML = "";
    for (var i = 1; i <= total; i++) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "se-dot" + (i === currentPage ? " is-active" : "");
      dot.setAttribute("aria-label", "페이지 " + i);
      dot.setAttribute("data-page", String(i));
      dotsEl.appendChild(dot);
    }
  }

  function getPagerState() {
    if (currentView === "thumb") {
      return { page: thumbActivePage + 1, totalPages: thumbTotalPages };
    }
    return { page: currentPage, totalPages: getListTotalPages() };
  }

  function updatePagerChrome() {
    var st = getPagerState();

    if (pagerCountEl && Pager) {
      pagerCountEl.textContent = Pager.formatCount(dataset.length, st.page, st.totalPages, "건");
    }

    if (Pager && Pager.isDesktop()) {
      Pager.render(pagePagerEl, {
        page: st.page,
        totalPages: st.totalPages,
        scrollRootSelector: ".ti-mz-scroll",
        onChange: function (p) {
          if (currentView === "thumb") goToThumbPage(p - 1);
          else goToListPage(p);
        }
      });
      return;
    }

    if (Pager) Pager.updateVisibility(pagePagerEl, 0);

    if (!fractionEl || !btnPrev || !btnNext) return;

    if (currentView === "thumb") {
      fractionEl.textContent = thumbTotalPages ? thumbActivePage + 1 + " / " + thumbTotalPages : "0 / 0";
      btnPrev.disabled = thumbActivePage <= 0;
      btnNext.disabled = thumbActivePage >= thumbTotalPages - 1;
      updateThumbDots();
    } else {
      var total = getListTotalPages();
      fractionEl.textContent = total ? currentPage + " / " + total : "0 / 0";
      btnPrev.disabled = currentPage <= 1;
      btnNext.disabled = currentPage >= total;
      updateListDots();
    }
  }

  function readThumbActivePageFromScroll() {
    if (!mzSwipeViewport) return 0;
    var w = mzSwipeViewport.clientWidth;
    if (w <= 0) return 0;
    var idx = Math.round(mzSwipeViewport.scrollLeft / w);
    return Math.max(0, Math.min(thumbTotalPages - 1, idx));
  }

  function syncThumbActiveFromScroll() {
    if (currentView !== "thumb") return;
    var next = readThumbActivePageFromScroll();
    if (next !== thumbActivePage) {
      thumbActivePage = next;
      updatePagerChrome();
    }
  }

  function goToThumbPage(pageIndex) {
    if (!mzSwipeViewport) return;
    pageIndex = Math.max(0, Math.min(thumbTotalPages - 1, pageIndex));
    thumbActivePage = pageIndex;
    var w = mzSwipeViewport.clientWidth;
    mzSwipeViewport.scrollTo({ left: pageIndex * w, behavior: "smooth" });
    updatePagerChrome();
  }

  function purgeThumbCarousel() {
    thumbLayoutKey = "";
    thumbActivePage = 0;
    if (mzSwipeTrack) mzSwipeTrack.innerHTML = "";
    if (mzSwipeViewport) mzSwipeViewport.scrollLeft = 0;
  }

  function purgeListDom() {
    if (listEl) listEl.innerHTML = "";
  }

  function applyThumbLayoutFromViewport() {
    if (currentView !== "thumb" || !mzSwipeViewport || !mzSwipeTrack) return;

    refreshDataset();
    var cols = getGridColumns();
    if (mzThumbStack) {
      mzThumbStack.style.setProperty("--mz-thumb-cols", String(cols));
    }

    var nextIpp = computeThumbItemsPerPage();
    if (nextIpp < cols) nextIpp = cols;

    var prevIpp = thumbItemsPerPage;
    var itemOffset = thumbActivePage * prevIpp;
    thumbItemsPerPage = nextIpp;

    var newTotal = Math.max(1, Math.ceil(dataset.length / thumbItemsPerPage));
    thumbActivePage = Math.floor(itemOffset / thumbItemsPerPage);
    if (thumbActivePage >= newTotal) thumbActivePage = newTotal - 1;
    if (thumbActivePage < 0) thumbActivePage = 0;

    thumbTotalPages = newTotal;

    var nextKey = cols + "x" + thumbItemsPerPage + "n" + dataset.length;
    if (nextKey !== thumbLayoutKey || mzSwipeTrack.childElementCount === 0) {
      buildThumbSlides();
      thumbLayoutKey = nextKey;
    }

    var w = mzSwipeViewport.clientWidth;
    mzSwipeViewport.scrollLeft = thumbActivePage * w;
    updatePagerChrome();

    if (mzSwipeHint) {
      mzSwipeHint.hidden = thumbTotalPages <= 1;
    }
  }

  function scheduleThumbLayout() {
    clearTimeout(thumbLayoutTimer);
    thumbLayoutTimer = window.setTimeout(function () {
      window.requestAnimationFrame(applyThumbLayoutFromViewport);
    }, 48);
  }

  function renderListView() {
    if (!listEl) return;
    listEl.classList.remove("is-thumb");
    listEl.classList.add("is-list");
    listEl.innerHTML = "";
    getListPageItems(currentPage).forEach(function (item) {
      listEl.appendChild(createItemElement(item, !!cfg.showExcerptInList));
    });
  }

  function goToListPage(page) {
    var total = getListTotalPages();
    page = Math.max(1, Math.min(total, page));
    if (page === currentPage) return;
    currentPage = page;
    renderListView();
    updatePagerChrome();
    var scrollEl = document.querySelector(".ti-mz-scroll");
    if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setViewShell() {
    var page = document.querySelector(".preview-page");
    if (page) {
      page.classList.toggle("preview-page--thumb", currentView === "thumb");
      page.classList.toggle("preview-page--list", currentView === "list");
    }
    if (currentView === "thumb") {
      purgeListDom();
      if (mzThumbStack) mzThumbStack.removeAttribute("hidden");
      if (listEl) listEl.setAttribute("hidden", "");
    } else {
      purgeThumbCarousel();
      if (mzThumbStack) mzThumbStack.setAttribute("hidden", "");
      if (listEl) listEl.removeAttribute("hidden");
    }
  }

  function applyCurrentView() {
    setViewShell();
    renderCount();
    if (currentView === "thumb") {
      thumbActivePage = 0;
      thumbItemsPerPage = getGridColumns();
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(scheduleThumbLayout);
      });
    } else {
      currentPage = 1;
      renderListView();
      updatePagerChrome();
    }
  }

  function bindThumbOnlyEvents() {
    if (thumbEventsBound) return;
    thumbEventsBound = true;

    if (mzSwipeViewport) {
      mzSwipeViewport.addEventListener("scroll", function () {
        clearTimeout(thumbScrollEndTimer);
        thumbScrollEndTimer = window.setTimeout(syncThumbActiveFromScroll, 120);
      });
      mzSwipeViewport.addEventListener("scrollend", syncThumbActiveFromScroll);

      mzSwipeViewport.addEventListener("keydown", function (e) {
        if (currentView !== "thumb") return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goToThumbPage(thumbActivePage - 1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          goToThumbPage(thumbActivePage + 1);
        }
      });
    }

    window.addEventListener(
      "resize",
      function () {
        if (currentView === "thumb") scheduleThumbLayout();
      },
      { passive: true }
    );

    window.addEventListener(
      "ti-shell:relayout",
      function () {
        if (currentView === "thumb") scheduleThumbLayout();
      },
      { passive: true }
    );

    if (mzThumbStack && typeof ResizeObserver !== "undefined") {
      thumbResizeObserver = new ResizeObserver(function () {
        if (currentView === "thumb") scheduleThumbLayout();
      });
      thumbResizeObserver.observe(mzThumbStack);
    }
  }

  function bindEvents() {
    document.querySelectorAll(".mode-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        var nextView = button.getAttribute("data-view");
        if (!nextView || nextView === currentView) return;
        currentView = nextView;
        document.querySelectorAll(".mode-btn").forEach(function (btn) {
          var active = btn === button;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        applyCurrentView();
      });
    });

    bindThumbOnlyEvents();

    if (btnPrev) {
      btnPrev.addEventListener("click", function () {
        if (currentView === "thumb") goToThumbPage(thumbActivePage - 1);
        else goToListPage(currentPage - 1);
      });
    }
    if (btnNext) {
      btnNext.addEventListener("click", function () {
        if (currentView === "thumb") goToThumbPage(thumbActivePage + 1);
        else goToListPage(currentPage + 1);
      });
    }
    if (dotsEl) {
      dotsEl.addEventListener("click", function (event) {
        if (currentView === "thumb") return;
        var target = event.target.closest(".se-dot");
        if (!target) return;
        var p = Number(target.getAttribute("data-page") || 0);
        if (p >= 1) goToListPage(p);
      });
    }
  }

  function renderCount() {
    updatePagerChrome();
  }

  function ensureDatasetThenRender() {
    refreshDataset();
    if (!dataset.length) {
      window.setTimeout(function () {
        refreshDataset();
        renderCount();
        applyCurrentView();
      }, 0);
    }
  }

  if (Pager && Pager.mq) {
    Pager.mq.addEventListener("change", function () {
      updatePagerChrome();
    });
  }

  function boot() {
    ensureDatasetThenRender();
    refreshDataset();
    bindEvents();
    applyCurrentView();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

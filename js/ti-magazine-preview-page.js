/**
 * test/magazine-preview.html — 썸네일형: special-exhibition-test 와 동일한 스크롤 스냅 캐러셀 + 페이지 크롬
 * 목록형: 고정 12건/페이지 그리드
 */
(function () {
  var ITEMS_PER_PAGE_LIST = 12;
  var currentPage = 1;
  var currentView = "thumb";

  var GRID_GAP_DESKTOP = 16;
  var GRID_GAP_MOBILE = 10;
  var THUMB_MIN_CELL_PX = 200;
  var MAX_THUMB_COLS = 4;
  var THUMB_IMG_H_PER_W = 200 / 264;
  var TITLE_BLOCK_RESERVE_PX = 88;
  var MAX_ROWS = 16;

  var dataset = [];
  var thumbItemsPerPage = 8;
  var thumbTotalPages = 1;
  var thumbActivePage = 0;
  var thumbLayoutKey = "";
  var thumbScrollEndTimer;
  var thumbLayoutTimer;
  var thumbResizeObserver;
  var thumbEventsBound;

  var INTERNAL_PREVIEW_DETAIL_BY_ID = {
    1: "magazine-preview-detail-01.html",
    2: "magazine-preview-detail-02.html",
    3: "magazine-preview-detail-03.html",
    4: "magazine-preview-detail-04.html",
    5: "magazine-preview-detail-05.html",
    6: "magazine-preview-detail-06.html",
    7: "magazine-preview-detail-07.html",
    8: "magazine-preview-detail-08.html",
    9: "magazine-preview-detail-09.html",
    10: "magazine-preview-detail-10.html",
    11: "magazine-preview-detail-11.html",
    12: "magazine-preview-detail-12.html",
    13: "magazine-preview-detail-13.html",
    14: "magazine-preview-detail-14.html",
    15: "magazine-preview-detail-15.html",
    16: "magazine-preview-detail-16.html",
    17: "magazine-preview-detail-17.html",
    18: "magazine-preview-detail-18.html",
    19: "magazine-preview-detail-19.html",
    20: "magazine-preview-detail-20.html",
    21: "magazine-preview-detail-21.html",
    22: "magazine-preview-detail-22.html",
    23: "magazine-preview-detail-23.html",
    24: "magazine-preview-detail-24.html"
  };

  var mzThumbStack = document.getElementById("mzThumbStack");
  var mzSwipeViewport = document.getElementById("mzSwipeViewport");
  var mzSwipeTrack = document.getElementById("mzSwipeTrack");
  var mzSwipeHint = document.getElementById("mzSwipeHint");
  var previewList = document.getElementById("previewList");
  var fractionEl = document.getElementById("mzPagerFraction");
  var dotsEl = document.getElementById("mzPagerDots");
  var btnPrev = document.getElementById("mzPagerPrev");
  var btnNext = document.getElementById("mzPagerNext");

  function toInternalArticleHref(item) {
    if (!item || !item.id) return "";
    var name = INTERNAL_PREVIEW_DETAIL_BY_ID[item.id] || "";
    if (!name) return "";
    return "../" + name;
  }

  function refreshDataset() {
    dataset = Array.isArray(window.MAGAZINE_PREVIEW_DATA) ? window.MAGAZINE_PREVIEW_DATA.slice() : [];
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

  /** 뷰포트 너비·최소 셀 폭으로 열 수 산출 (기획전과 같이 슬라이드당 행·열이 리사이즈에 맞춤) */
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
    if (w < 40 || h < 40) {
      return Math.max(cols * 2, cols);
    }
    var cellW = (w - gap * Math.max(0, cols - 1)) / cols;
    var rowH = cellW * THUMB_IMG_H_PER_W + TITLE_BLOCK_RESERVE_PX;
    var rows = Math.floor((h + gap) / (rowH + gap));
    rows = Math.max(1, Math.min(MAX_ROWS, rows));
    return rows * cols;
  }

  function getThumbTotalPages() {
    return Math.max(1, Math.ceil(dataset.length / thumbItemsPerPage));
  }

  function getThumbPageItems(pageIndex) {
    var start = pageIndex * thumbItemsPerPage;
    return dataset.slice(start, start + thumbItemsPerPage);
  }

  function thumbSrc(src) {
    if (!src) return "";
    if (/^https?:/i.test(src)) return src;
    if (src.startsWith("../")) return src;
    return "../" + src.replace(/^\//, "");
  }

  function createPreviewItemElement(item, withExcerpt) {
    var href = toInternalArticleHref(item);
    var article = document.createElement("article");
    article.className = "preview-item";

    var thumbLink = document.createElement("a");
    thumbLink.className = "preview-thumb-link";
    thumbLink.href = href;
    thumbLink.setAttribute("aria-label", item.title || "");

    var image = document.createElement("img");
    image.className = "preview-thumb";
    image.src = thumbSrc(item.thumbnail || "");
    image.alt = (item.title || "") + " 썸네일";
    image.loading = "lazy";
    thumbLink.appendChild(image);

    var body = document.createElement("div");
    body.className = "preview-body";

    var titleLink = document.createElement("a");
    titleLink.className = "preview-title-link";
    titleLink.href = href;
    titleLink.textContent = item.title || "";

    body.appendChild(titleLink);

    if (withExcerpt) {
      var excerptLink = document.createElement("a");
      excerptLink.className = "preview-excerpt-link";
      excerptLink.href = href;
      excerptLink.textContent = item.excerpt || "";
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
        grid.appendChild(createPreviewItemElement(item, false));
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

  function updatePagerChrome() {
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
    if (previewList) previewList.innerHTML = "";
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
    if (!previewList) return;
    previewList.classList.remove("is-thumb");
    previewList.classList.add("is-list");
    previewList.innerHTML = "";
    getListPageItems(currentPage).forEach(function (item) {
      previewList.appendChild(createPreviewItemElement(item, true));
    });
  }

  function goToListPage(page) {
    var total = getListTotalPages();
    page = Math.max(1, Math.min(total, page));
    if (page === currentPage) return;
    currentPage = page;
    renderListView();
    updatePagerChrome();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setViewShell() {
    if (currentView === "thumb") {
      purgeListDom();
      if (mzThumbStack) mzThumbStack.removeAttribute("hidden");
      if (previewList) previewList.setAttribute("hidden", "");
    } else {
      purgeThumbCarousel();
      if (mzThumbStack) mzThumbStack.setAttribute("hidden", "");
      if (previewList) previewList.removeAttribute("hidden");
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
    var count = document.getElementById("resultCount");
    if (count) count.textContent = "총 " + dataset.length + "건";
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

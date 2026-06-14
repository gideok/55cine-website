(function () {
  var BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "";

  function resolveAssetUrl(url) {
    if (!url || url === "#") return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
    if (url.indexOf("//") === 0) return url;
    if (url.charAt(0) === "/") return url;
    if (url.startsWith("../")) return url;
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(url);
    }
    return BASE + url;
  }

  var GRID_GAP_COL_PX = 24;
  var GRID_GAP_ROW_PX = 40;
  var POSTER_ASPECT = 740 / 510;
  var TITLE_BLOCK_RESERVE_PX = 56;
  var MAX_ROWS = 16;
  var COL_BREAKPOINT = window.matchMedia("(max-width: 899px)");

  var viewport = document.getElementById("seSwipeViewport");
  var track = document.getElementById("seSwipeTrack");
  var rightInner = document.getElementById("seRightInner");
  var Pager = window.TiPagePager;
  var pageCountEl = document.getElementById("tiPageCount");
  var pagePagerEl = document.getElementById("tiPagePager");
  var fractionEl = document.getElementById("seFraction");
  var dotsEl = document.getElementById("seDots");
  var btnPrev = document.getElementById("sePrev");
  var btnNext = document.getElementById("seNext");
  var hintEl = document.getElementById("seSwipeHint");

  if (!viewport || !track) return;

  var dataset = [];
  var itemsPerPage = 8;
  var totalPages = 1;
  var activePage = 0;
  var builtForDatasetLength = -1;
  var scrollEndTimer;
  var layoutTimer;
  var loading = false;
  var pendingUrlPage = null;
  var LOADING_MESSAGE = "행사 목록을 불러오는 중…";
  var ERROR_MESSAGE = "목록을 불러오지 못했습니다.";

  function loadDataset() {
    if (window.TiApi && typeof window.TiApi.getSpecialList === "function") {
      return window.TiApi.getSpecialList("event").then(function (items) {
        dataset = Array.isArray(items) ? items.slice() : [];
      });
    }
    dataset = Array.isArray(window.EVENT_PROGRAM_DATA) ? window.EVENT_PROGRAM_DATA.slice() : [];
    return Promise.resolve();
  }

  function getGridGapCol() {
    return COL_BREAKPOINT.matches ? 16 : GRID_GAP_COL_PX;
  }

  function getGridGapRow() {
    return COL_BREAKPOINT.matches ? 32 : GRID_GAP_ROW_PX;
  }

  function getGridColumns() {
    return COL_BREAKPOINT.matches ? 2 : 4;
  }

  function computeItemsPerPage() {
    var cols = getGridColumns();
    if (window.TiThumbGridLayout) {
      return window.TiThumbGridLayout.computeItemsPerPage({
        cols: cols,
        isMobile: COL_BREAKPOINT.matches,
        viewportEl: viewport,
        hostEl: rightInner,
        viewportWidth: viewport.clientWidth,
        gapCol: getGridGapCol(),
        gapRow: getGridGapRow(),
        aspectRatio: POSTER_ASPECT,
        titleReserve: TITLE_BLOCK_RESERVE_PX,
        maxRows: MAX_ROWS,
        useCellFit: true,
        mobileRows: 2,
        refViewportHeight: 680,
        refRows: 2
      });
    }
    var gapCol = getGridGapCol();
    var gapRow = getGridGapRow();
    var h = viewport.clientHeight;
    var w = viewport.clientWidth;
    if (w < 40 || h < 40) {
      return Math.max(cols * 2, cols);
    }
    var cellW = (w - gapCol * Math.max(0, cols - 1)) / cols;
    var rowH = cellW * POSTER_ASPECT + TITLE_BLOCK_RESERVE_PX;
    var rows = Math.floor((h + gapRow) / (rowH + gapRow));
    rows = Math.max(1, Math.min(MAX_ROWS, rows));
    return rows * cols;
  }

  function syncEventGridRows(cols) {
    var host = rightInner || viewport;
    if (!host) return;
    var rows = 2;
    if (window.TiThumbGridLayout) {
      rows = window.TiThumbGridLayout.computeRows({
        cols: cols,
        isMobile: COL_BREAKPOINT.matches,
        viewportEl: viewport,
        hostEl: rightInner,
        viewportWidth: viewport.clientWidth,
        viewportHeight: window.TiThumbGridLayout.measureSlotHeight({
          viewportEl: viewport,
          hostEl: rightInner
        }),
        gapCol: getGridGapCol(),
        gapRow: getGridGapRow(),
        aspectRatio: POSTER_ASPECT,
        titleReserve: TITLE_BLOCK_RESERVE_PX,
        maxRows: MAX_ROWS,
        useCellFit: true,
        mobileRows: 2,
        refViewportHeight: 680,
        refRows: 2
      });
    }
    host.style.setProperty("--se-thumb-rows", String(rows));
  }

  function syncSlideWidths() {
    if (window.TiThumbGridLayout) {
      window.TiThumbGridLayout.syncSlideWidths(viewport, track);
    }
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(dataset.length / itemsPerPage));
  }

  function getPageItems(pageIndex) {
    var start = pageIndex * itemsPerPage;
    return dataset.slice(start, start + itemsPerPage);
  }

  function readPageFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var page = parseInt(params.get("page"), 10);
    if (isNaN(page) || page < 1) return null;
    return page - 1;
  }

  function viewportHasLayoutSize() {
    return viewport.clientWidth >= 40 && viewport.clientHeight >= 40;
  }

  function buildDetailHref(item, pageIndex) {
    var href = resolveAssetUrl(item.detailUrl || item.sourceUrl || "#");
    if (!href || href === "#") return href;
    var listPage = (typeof pageIndex === "number" ? pageIndex : activePage) + 1;
    var sep = href.indexOf("?") >= 0 ? "&" : "?";
    return href + sep + "listPage=" + encodeURIComponent(String(listPage));
  }

  function createCard(item, pageIndex) {
    var href = buildDetailHref(item, pageIndex);
    var article = document.createElement("article");
    article.className = "se-card";

    var thumbLink = document.createElement("a");
    thumbLink.className = "se-thumb-link";
    thumbLink.href = href;

    var image = document.createElement("img");
    image.className = "se-thumb";
    image.src = resolveAssetUrl(item.thumbnail || "");
    image.alt = (item.title || "") + " 썸네일";
    image.loading = "lazy";
    thumbLink.appendChild(image);

    var titleWrap = document.createElement("div");
    titleWrap.className = "se-title-wrap";

    var titleLink = document.createElement("a");
    titleLink.className = "se-title-link";
    titleLink.href = href;

    var title = document.createElement("h2");
    title.className = "se-item-title";
    title.textContent = item.title || "";

    titleLink.appendChild(title);
    titleWrap.appendChild(titleLink);

    article.appendChild(thumbLink);
    article.appendChild(titleWrap);
    return article;
  }

  function showListStatus(message, isError, isLoading) {
    track.innerHTML = "";
    totalPages = 1;
    activePage = 0;

    var slide = document.createElement("div");
    slide.className = "se-slide";
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-label", message || "상태");

    var grid = document.createElement("div");
    grid.className = "se-grid";

    var wrap = document.createElement("div");
    var statusClass = isError ? " is-error" : isLoading ? " is-loading" : " is-empty";
    wrap.className = "np-list-status" + statusClass;
    wrap.setAttribute("role", "status");

    if (isLoading && !isError && window.TiLogoSpinner) {
      wrap.appendChild(
        window.TiLogoSpinner.create({
          size: 72,
          label: message || "로딩 중"
        })
      );
    }

    var text = document.createElement("p");
    text.className = "np-list-status__text";
    text.textContent = message;
    wrap.appendChild(text);

    grid.appendChild(wrap);
    slide.appendChild(grid);
    track.appendChild(slide);

    if (pageCountEl) pageCountEl.innerHTML = "";
    if (pagePagerEl && Pager) Pager.updateVisibility(pagePagerEl, 0);
    if (hintEl) hintEl.hidden = true;
    if (fractionEl) fractionEl.textContent = "0 / 0";
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    if (dotsEl) dotsEl.innerHTML = "";
  }

  function buildSlides() {
    track.innerHTML = "";
    totalPages = getTotalPages();
    for (var p = 0; p < totalPages; p++) {
      var slide = document.createElement("div");
      slide.className = "se-slide";
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-label", "페이지 " + (p + 1) + " / " + totalPages);

      var grid = document.createElement("div");
      grid.className = "se-grid";

      getPageItems(p).forEach(function (item) {
        grid.appendChild(createCard(item, p));
      });

      slide.appendChild(grid);
      track.appendChild(slide);
    }
    syncSlideWidths();
  }

  function updateDots() {
    if (!dotsEl) return;
    if (window.TiCarouselDots) {
      window.TiCarouselDots.render(dotsEl, {
        total: totalPages,
        activeIndex: activePage,
        onSelect: goToPage
      });
      return;
    }
    dotsEl.innerHTML = "";
    for (var i = 0; i < totalPages; i++) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "se-dot" + (i === activePage ? " is-active" : "");
      dot.setAttribute("aria-label", "페이지 " + (i + 1));
      dot.addEventListener(
        "click",
        (function (page) {
          return function () {
            goToPage(page);
          };
        })(i)
      );
      dotsEl.appendChild(dot);
    }
  }

  function renderSeMeta(el, options) {
    if (!el) return;
    el.innerHTML = "";
    options = options || {};
    var inner = document.createElement("div");
    inner.className = "np-meta__inner";

    if (options.mode === "mobile") {
      inner.textContent = options.text || "";
      el.appendChild(inner);
      return;
    }

    var total = document.createElement("span");
    total.className = "np-meta__total";
    total.textContent = "총 " + options.total + "건";
    inner.appendChild(total);

    if (options.totalPages > 1) {
      var dot = document.createElement("span");
      dot.className = "np-meta__dot";
      dot.setAttribute("aria-hidden", "true");
      inner.appendChild(dot);

      var page = document.createElement("span");
      page.className = "np-meta__page";
      page.textContent = options.page + " / " + options.totalPages + " 페이지";
      inner.appendChild(page);

      el.setAttribute(
        "aria-label",
        "총 " + options.total + "건, " + options.page + " / " + options.totalPages + " 페이지"
      );
    } else {
      el.setAttribute("aria-label", "총 " + options.total + "건");
    }

    el.appendChild(inner);
  }

  function updateChrome() {
    if (Pager && Pager.isDesktop()) {
      if (pageCountEl) {
        renderSeMeta(pageCountEl, {
          total: dataset.length,
          page: activePage + 1,
          totalPages: totalPages
        });
      }
      if (pagePagerEl) {
        Pager.render(pagePagerEl, {
          page: activePage + 1,
          totalPages: totalPages,
          scrollRootSelector: ".se-right-inner",
          onChange: function (p) {
            goToPage(p - 1);
          }
        });
      }
      return;
    }

    if (pagePagerEl && Pager) Pager.updateVisibility(pagePagerEl, 0);

    if (pageCountEl) {
      var shown = Math.min((activePage + 1) * itemsPerPage, dataset.length);
      renderSeMeta(pageCountEl, {
        mode: "mobile",
        text: "총 " + dataset.length + "건 · " + shown + "건 표시"
      });
    }

    if (fractionEl) {
      fractionEl.textContent = totalPages ? activePage + 1 + " / " + totalPages : "0 / 0";
    }
    if (btnPrev) btnPrev.disabled = activePage <= 0;
    if (btnNext) btnNext.disabled = activePage >= totalPages - 1;
    updateDots();
  }

  function readActivePageFromScroll() {
    var w = viewport.clientWidth;
    if (w <= 0) return 0;
    var idx = Math.round(viewport.scrollLeft / w);
    return Math.max(0, Math.min(totalPages - 1, idx));
  }

  function syncActiveFromScroll() {
    if (pendingUrlPage !== null) return;
    var next = readActivePageFromScroll();
    if (next !== activePage) {
      activePage = next;
      updateChrome();
    }
  }

  function goToPage(pageIndex) {
    pageIndex = Math.max(0, Math.min(totalPages - 1, pageIndex));
    activePage = pageIndex;
    var w = viewport.clientWidth;
    viewport.scrollTo({ left: pageIndex * w, behavior: "smooth" });
    updateChrome();
  }

  function applyLayoutFromViewport() {
    if (loading && dataset.length === 0) return;

    var cols = getGridColumns();
    var nextIpp = computeItemsPerPage();
    if (nextIpp < cols) nextIpp = cols;

    var prevIpp = itemsPerPage;
    var ippChanged = nextIpp !== prevIpp;
    itemsPerPage = nextIpp;
    syncEventGridRows(cols);

    var newTotal = Math.max(1, Math.ceil(dataset.length / itemsPerPage));
    if (pendingUrlPage !== null) {
      activePage = Math.min(Math.max(0, pendingUrlPage), newTotal - 1);
      if (viewportHasLayoutSize()) pendingUrlPage = null;
    } else {
      var itemOffset = activePage * prevIpp;
      activePage = Math.floor(itemOffset / itemsPerPage);
      if (activePage >= newTotal) activePage = newTotal - 1;
      if (activePage < 0) activePage = 0;
    }

    var dataChanged = builtForDatasetLength !== dataset.length;
    if (ippChanged || track.childElementCount === 0 || dataChanged) {
      buildSlides();
      builtForDatasetLength = dataset.length;
    } else {
      syncSlideWidths();
    }

    var w = viewport.clientWidth;
    viewport.scrollLeft = activePage * w;
    updateChrome();

    if (hintEl) {
      hintEl.hidden = totalPages <= 1;
    }
  }

  function scheduleLayout() {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(function () {
      requestAnimationFrame(applyLayoutFromViewport);
    }, 48);
  }

  function boot() {
    pendingUrlPage = readPageFromUrl();
    activePage = pendingUrlPage !== null ? pendingUrlPage : 0;
    itemsPerPage = getGridColumns();
    loading = true;
    builtForDatasetLength = -1;
    showListStatus(LOADING_MESSAGE, false, true);

    loadDataset()
      .then(function () {
        loading = false;
        requestAnimationFrame(function () {
          requestAnimationFrame(applyLayoutFromViewport);
        });
      })
      .catch(function (err) {
        console.error(err);
        loading = false;
        dataset = [];
        showListStatus(ERROR_MESSAGE, true, false);
      });
  }

  viewport.addEventListener("scroll", function () {
    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(syncActiveFromScroll, 120);
  });

  viewport.addEventListener("scrollend", syncActiveFromScroll);

  btnPrev.addEventListener("click", function () {
    goToPage(activePage - 1);
  });
  btnNext.addEventListener("click", function () {
    goToPage(activePage + 1);
  });

  viewport.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPage(activePage - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goToPage(activePage + 1);
    }
  });

  window.addEventListener(
    "resize",
    function () {
      scheduleLayout();
    },
    { passive: true }
  );

  if (rightInner && typeof ResizeObserver !== "undefined") {
    var ro = new ResizeObserver(function () {
      scheduleLayout();
    });
    ro.observe(rightInner);
    ro.observe(viewport);
  }

  function onColBreakpointChange() {
    scheduleLayout();
  }

  if (COL_BREAKPOINT.addEventListener) {
    COL_BREAKPOINT.addEventListener("change", onColBreakpointChange);
  } else if (COL_BREAKPOINT.addListener) {
    COL_BREAKPOINT.addListener(onColBreakpointChange);
  }

  window.addEventListener("ti-shell:relayout", function () {
    scheduleLayout();
  });

  if (Pager && Pager.mq) {
    Pager.mq.addEventListener("change", function () {
      updateChrome();
    });
  }

  boot();
})();

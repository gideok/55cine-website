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

  var GRID_GAP_PX = 10;
  var POSTER_ASPECT = 740 / 510;
  var TITLE_BLOCK_RESERVE_PX = 62;
  var MAX_ROWS = 16;
  var COL_BREAKPOINT = window.matchMedia("(max-width: 820px)");

  var viewport = document.getElementById("seSwipeViewport");
  var track = document.getElementById("seSwipeTrack");
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
  var scrollEndTimer;
  var layoutTimer;

  function refreshDataset() {
    dataset = Array.isArray(window.EVENT_PROGRAM_DATA) ? window.EVENT_PROGRAM_DATA.slice() : [];
  }

  function getGridColumns() {
    return COL_BREAKPOINT.matches ? 2 : 4;
  }

  function computeItemsPerPage() {
    var cols = getGridColumns();
    var h = viewport.clientHeight;
    var w = viewport.clientWidth;
    if (w < 40 || h < 40) {
      return Math.max(cols * 2, cols);
    }
    var cellW = (w - GRID_GAP_PX * Math.max(0, cols - 1)) / cols;
    var rowH = cellW * POSTER_ASPECT + TITLE_BLOCK_RESERVE_PX;
    var rows = Math.floor((h + GRID_GAP_PX) / (rowH + GRID_GAP_PX));
    rows = Math.max(1, Math.min(MAX_ROWS, rows));
    return rows * cols;
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(dataset.length / itemsPerPage));
  }

  function getPageItems(pageIndex) {
    var start = pageIndex * itemsPerPage;
    return dataset.slice(start, start + itemsPerPage);
  }

  function createCard(item) {
    var href = resolveAssetUrl(item.detailUrl || item.sourceUrl || "#");
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
        grid.appendChild(createCard(item));
      });

      slide.appendChild(grid);
      track.appendChild(slide);
    }
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

  function updateChrome() {
    if (pageCountEl && Pager) {
      pageCountEl.textContent = Pager.formatCount(
        dataset.length,
        activePage + 1,
        totalPages,
        "건"
      );
    }

    if (Pager && Pager.isDesktop()) {
      Pager.render(pagePagerEl, {
        page: activePage + 1,
        totalPages: totalPages,
        scrollRootSelector: ".se-right-inner",
        alwaysVisible: true,
        onChange: function (p) {
          goToPage(p - 1);
        }
      });
      return;
    }

    if (Pager) Pager.updateVisibility(pagePagerEl, 0);

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
    refreshDataset();
    var cols = getGridColumns();
    var nextIpp = computeItemsPerPage();
    if (nextIpp < cols) nextIpp = cols;

    var prevIpp = itemsPerPage;
    var itemOffset = activePage * prevIpp;
    var ippChanged = nextIpp !== prevIpp;
    itemsPerPage = nextIpp;

    var newTotal = Math.max(1, Math.ceil(dataset.length / itemsPerPage));
    activePage = Math.floor(itemOffset / itemsPerPage);
    if (activePage >= newTotal) activePage = newTotal - 1;
    if (activePage < 0) activePage = 0;

    if (ippChanged || track.childElementCount === 0) {
      buildSlides();
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
      applyLayoutFromViewport();
    }, 50);
  }

  viewport.addEventListener(
    "scroll",
    function () {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(syncActiveFromScroll, 120);
    },
    { passive: true }
  );

  if (btnPrev) btnPrev.addEventListener("click", function () { goToPage(activePage - 1); });
  if (btnNext) btnNext.addEventListener("click", function () { goToPage(activePage + 1); });

  window.addEventListener("resize", scheduleLayout, { passive: true });
  applyLayoutFromViewport();
})();


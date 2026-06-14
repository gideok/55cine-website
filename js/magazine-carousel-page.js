/**
 * 매거진 목록 페이지 공통 — 썸네일형(스크롤 스냅 캐러셀) / 목록형(N건·페이지)
 * window.TI_MAGAZINE_CAROUSEL_CONFIG 로 페이지별 설정
 * 목록형 N — js/magazine-list-config.js (TI_MAGAZINE_LIST_ITEMS_PER_PAGE)
 */
(function () {
  var cfg = window.TI_MAGAZINE_CAROUSEL_CONFIG;
  if (!cfg || (!cfg.dataKey && !cfg.usePaginatedApi)) return;

  var ITEMS_PER_PAGE_LIST =
    typeof window.TI_MAGAZINE_LIST_ITEMS_PER_PAGE === "number" &&
    window.TI_MAGAZINE_LIST_ITEMS_PER_PAGE > 0
      ? Math.floor(window.TI_MAGAZINE_LIST_ITEMS_PER_PAGE)
      : 6;
  var SITE_ROOT_PREFIX = cfg.siteRootPrefix || "../";
  var currentPage = 1;
  var currentView = "thumb";

  var searchCfg = cfg.search || {};
  var SEARCH_ENABLED = searchCfg.enabled !== false;
  var SEARCH_PLACEHOLDER = searchCfg.placeholder || "제목·부제 검색";
  var SEARCH_NO_RESULTS = searchCfg.noResultsMessage || "검색 결과가 없습니다.";
  var SEARCH_FIELDS = searchCfg.fields || ["title", "subtitle", "excerpt"];
  var searchQuery = "";

  var paginatedMode = !!(cfg.usePaginatedApi && window.TiApi && window.TiApi.getMagazineListPage);
  var apiTotal = 0;
  var apiTotalPages = 1;
  var pageCache = {};
  var pageFetchPromises = {};
  var listItemsAccum = [];
  var listLoadedPages = 0;
  var listHasMore = true;
  var listLoading = false;
  var listScrollObs = null;

  var COL_BREAKPOINT = window.matchMedia("(max-width: 820px)");
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

  function decodeHtmlEntities(text) {
    if (!text) return "";
    var el = document.createElement("textarea");
    el.innerHTML = text;
    return el.value;
  }

  function displayText(text) {
    return decodeHtmlEntities(text || "");
  }

  function refreshDataset() {
    if (paginatedMode) return;
    var raw = window[cfg.dataKey];
    dataset = Array.isArray(raw) ? raw.slice() : [];
  }

  function getSearchQueryNormalized() {
    return window.TiListSearch ? window.TiListSearch.normalize(searchQuery) : "";
  }

  function isSearchActive() {
    return !!getSearchQueryNormalized();
  }

  function getFilteredLocalDataset() {
    if (!window.TiListSearch) return dataset;
    var q = getSearchQueryNormalized();
    if (!q) return dataset;
    return dataset.filter(function (item) {
      return window.TiListSearch.matches(item, q, SEARCH_FIELDS);
    });
  }

  function fetchMagazinePageApi(pageNum, pageSize) {
    var q = getSearchQueryNormalized();
    if (typeof cfg.fetchPage === "function") {
      return Promise.resolve(cfg.fetchPage(pageNum, pageSize, q || undefined));
    }
    return window.TiApi.getMagazineListPage({
      section: cfg.apiSection,
      isPast: !!cfg.apiIsPast,
      page: pageNum,
      pageSize: pageSize,
      q: q || undefined
    });
  }

  function ensureThumbPageLoaded(pageIndex) {
    var pageNum = pageIndex + 1;
    if (pageCache[pageNum]) return Promise.resolve(pageCache[pageNum]);
    if (pageFetchPromises[pageNum]) return pageFetchPromises[pageNum];

    pageFetchPromises[pageNum] = fetchMagazinePageApi(pageNum, thumbItemsPerPage)
      .then(function (res) {
        apiTotal = res.total;
        apiTotalPages = res.totalPages;
        pageCache[pageNum] = res.items || [];
        refreshThumbSlideAt(pageIndex);
        delete pageFetchPromises[pageNum];
        updatePagerChrome();
        return pageCache[pageNum];
      })
      .catch(function (err) {
        delete pageFetchPromises[pageNum];
        throw err;
      });
    return pageFetchPromises[pageNum];
  }

  function prefetchThumbAdjacent(activeIdx) {
    ensureThumbPageLoaded(activeIdx);
    if (activeIdx > 0) ensureThumbPageLoaded(activeIdx - 1);
    if (activeIdx < thumbTotalPages - 1) ensureThumbPageLoaded(activeIdx + 1);
  }

  function refreshThumbSlideAt(pageIndex) {
    if (!mzSwipeTrack) return;
    var slide = mzSwipeTrack.children[pageIndex];
    if (!slide) return;
    var grid = slide.querySelector(".se-grid");
    if (!grid) return;
    var items = paginatedMode ? pageCache[pageIndex + 1] || [] : getThumbPageItems(pageIndex);
    grid.innerHTML = "";
    items.forEach(function (item) {
      grid.appendChild(createItemElement(item, false));
    });
  }

  function loadDataset() {
    if (typeof cfg.fetchList === "function") {
      return Promise.resolve(cfg.fetchList()).then(function (list) {
        dataset = Array.isArray(list) ? list.slice() : [];
        if (cfg.dataKey) window[cfg.dataKey] = dataset;
        return dataset;
      });
    }
    if (paginatedMode) {
      pageCache = {};
      pageFetchPromises = {};
      listItemsAccum = [];
      listLoadedPages = 0;
      listHasMore = true;
      return fetchMagazinePageApi(1, thumbItemsPerPage || 8).then(function (res) {
        apiTotal = res.total;
        apiTotalPages = res.totalPages;
        thumbTotalPages = apiTotalPages;
        pageCache[1] = res.items || [];
        dataset = res.items || [];
        return dataset;
      });
    }
    refreshDataset();
    return Promise.resolve(dataset);
  }

  function resolveHref(item) {
    if (typeof cfg.resolveHref === "function") return cfg.resolveHref(item) || "";
    var path = item && item.detailUrl ? item.detailUrl : "";
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("../")) return path;
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(path);
    }
    return SITE_ROOT_PREFIX + path.replace(/^\//, "");
  }

  function thumbSrc(src) {
    if (!src) return "";
    if (/^https?:/i.test(src)) return src;
    if (src.startsWith("../")) return src;
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(src);
    }
    return SITE_ROOT_PREFIX + src.replace(/^\//, "");
  }

  function getListTotalPages() {
    if (paginatedMode) return apiTotalPages || 1;
    return Math.max(1, Math.ceil(getFilteredLocalDataset().length / ITEMS_PER_PAGE_LIST));
  }

  function getListPageItems(page) {
    if (paginatedMode) {
      return pageCache[page] || listItemsAccum;
    }
    var list = getFilteredLocalDataset();
    var start = (page - 1) * ITEMS_PER_PAGE_LIST;
    return list.slice(start, start + ITEMS_PER_PAGE_LIST);
  }

  function gridGapPx() {
    if (!mzSwipeViewport || mzSwipeViewport.clientWidth <= 820) return GRID_GAP_MOBILE;
    return GRID_GAP_DESKTOP;
  }

  function isMobileThumbViewport() {
    return (
      COL_BREAKPOINT.matches || (mzSwipeViewport && mzSwipeViewport.clientWidth <= 820)
    );
  }

  function getGridColumns() {
    if (!mzSwipeViewport) {
      return COL_BREAKPOINT.matches ? 2 : 4;
    }
    if (COL_BREAKPOINT.matches || mzSwipeViewport.clientWidth <= 820) {
      return 2;
    }
    var w = mzSwipeViewport.clientWidth;
    if (w < 40) return 4;
    var gap = gridGapPx();
    var cols = Math.floor((w + gap) / (THUMB_MIN_CELL_PX + gap));
    return Math.max(1, Math.min(MAX_THUMB_COLS, cols));
  }

  function getThumbRowsFromCss() {
    if (!mzThumbStack) return 1;
    var raw = window.getComputedStyle(mzThumbStack).getPropertyValue("--mz-thumb-rows").trim();
    var rows = parseInt(raw, 10);
    if (!rows || rows < 1) rows = 1;
    return Math.min(4, rows);
  }

  function computeThumbItemsPerPage() {
    var cols = getGridColumns();
    return cols * getThumbRowsFromCss();
  }

  function getThumbTotalPages() {
    if (paginatedMode) return Math.max(1, apiTotalPages);
    var list = getFilteredLocalDataset();
    return Math.max(1, Math.ceil(list.length / thumbItemsPerPage));
  }

  function getThumbPageItems(pageIndex) {
    if (paginatedMode) {
      return pageCache[pageIndex + 1] || [];
    }
    var list = getFilteredLocalDataset();
    var offset = pageIndex * thumbItemsPerPage;
    return list.slice(offset, offset + thumbItemsPerPage);
  }

  function appendListEmptyMessage(parent) {
    if (!parent) return;
    var msg = document.createElement("p");
    msg.className = "mz-list-empty";
    msg.setAttribute("role", "status");
    msg.textContent = isSearchActive()
      ? SEARCH_NO_RESULTS
      : cfg.emptyMessage || "표시할 항목이 없습니다.";
    parent.appendChild(msg);
  }

  function getListPrimaryTitle(item) {
    if (typeof cfg.getListTitle === "function") {
      return displayText(cfg.getListTitle(item));
    }
    if (item.movieTitle) return displayText(item.movieTitle);
    return displayText(item.title);
  }

  function getListSubtitleText(item) {
    if (typeof cfg.getListSubtitle === "function") {
      var custom = cfg.getListSubtitle(item);
      return custom ? displayText(custom) : "";
    }
    if (cfg.showDate && item.date) return item.date;
    var subtitle = item.subtitle ? displayText(item.subtitle) : "";
    if (subtitle && cfg.listSubtitlePrefix) {
      return cfg.listSubtitlePrefix + " - " + subtitle;
    }
    return subtitle;
  }

  function isPreviewItemLayout() {
    return cfg.apiSection === "preview" || cfg.itemClass === "preview-item";
  }

  function parseBracketTitle(rawTitle) {
    var raw = displayText(rawTitle || "");
    var match = raw.match(/^<([^>]+)>\s*(.*)$/);
    if (!match) return null;
    return {
      primary: match[1].trim(),
      secondary: match[2].trim()
    };
  }

  function getItemDisplayTitles(item) {
    if (isPreviewItemLayout()) {
      var parsed = parseBracketTitle(item.title);
      if (parsed) return parsed;
    }
    return {
      primary: getListPrimaryTitle(item),
      secondary: getListSubtitleText(item)
    };
  }

  function appendListHead(parent, href, primaryTitle, subtitleText, titleLinkClass, useHeading) {
    var head = document.createElement("div");
    head.className = "magazine-list-head";

    var titleLink = document.createElement("a");
    titleLink.className = titleLinkClass;
    titleLink.href = href;
    if (useHeading) {
      var heading = document.createElement("h2");
      heading.className = cfg.titleClass || "";
      heading.textContent = primaryTitle;
      titleLink.appendChild(heading);
    } else {
      titleLink.textContent = primaryTitle;
    }
    head.appendChild(titleLink);

    if (subtitleText) {
      var subtitleEl = document.createElement("p");
      subtitleEl.className = "magazine-list-subtitle";
      subtitleEl.textContent = subtitleText;
      head.appendChild(subtitleEl);
    }

    parent.appendChild(head);
  }

  function createItemElement(item, withExcerpt) {
    var href = resolveHref(item);
    var article = document.createElement("article");
    article.className = cfg.itemClass;
    var listLayout = currentView === "list";
    var titles = getItemDisplayTitles(item);
    var primaryTitle = titles.primary;
    var subtitleText = titles.secondary;
    var ariaTitle = subtitleText ? primaryTitle + " " + subtitleText : primaryTitle || displayText(item.title);

    var thumbLink = document.createElement("a");
    thumbLink.className = cfg.thumbLinkClass;
    thumbLink.href = href;
    thumbLink.setAttribute("aria-label", ariaTitle);

    var image = document.createElement("img");
    image.className = cfg.thumbClass;
    image.src = thumbSrc(item.thumbnail || "");
    image.alt = (primaryTitle || displayText(item.title)) + " 썸네일";
    image.loading = "lazy";
    thumbLink.appendChild(image);

    if (cfg.useTitleWrap) {
      var titleWrap = document.createElement("div");
      titleWrap.className = cfg.titleWrapClass;
      if (listLayout) {
        appendListHead(
          titleWrap,
          href,
          displayText(item.title),
          subtitleText,
          cfg.titleLinkClass,
          true
        );
      } else {
        var titleLink = document.createElement("a");
        titleLink.className = cfg.titleLinkClass;
        titleLink.href = href;
        var title = document.createElement("h2");
        title.className = cfg.titleClass;
        title.textContent = displayText(item.title);
        titleLink.appendChild(title);
        titleWrap.appendChild(titleLink);
        if (cfg.showDate && item.date && cfg.dateClass) {
          var dateEl = document.createElement("p");
          dateEl.className = cfg.dateClass;
          dateEl.textContent = item.date;
          titleWrap.appendChild(dateEl);
        }
      }
      article.appendChild(thumbLink);
      article.appendChild(titleWrap);
      return article;
    }

    var body = document.createElement("div");
    body.className = cfg.bodyClass;

    if (listLayout || isPreviewItemLayout()) {
      appendListHead(body, href, primaryTitle, subtitleText, cfg.titleLinkClass, false);
    } else {
      var flatTitleLink = document.createElement("a");
      flatTitleLink.className = cfg.titleLinkClass;
      flatTitleLink.href = href;
      flatTitleLink.textContent = displayText(item.title);
      body.appendChild(flatTitleLink);
    }

    if (withExcerpt && cfg.excerptLinkClass && item.excerpt) {
      var excerptLink = document.createElement("a");
      excerptLink.className = cfg.excerptLinkClass;
      excerptLink.href = href;
      excerptLink.textContent = displayText(item.excerpt);
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

      var items = paginatedMode ? pageCache[p + 1] : getThumbPageItems(p);
      if (items && items.length) {
        items.forEach(function (item) {
          grid.appendChild(createItemElement(item, false));
        });
      } else if (paginatedMode && pageFetchPromises[p + 1]) {
        var loading = document.createElement("p");
        loading.className = "se-loading-hint";
        loading.textContent = "불러오는 중…";
        grid.appendChild(loading);
      } else if (paginatedMode && p === 0 && getDisplayTotalCount() === 0) {
        appendListEmptyMessage(grid);
      } else if (!paginatedMode && p === 0 && getFilteredLocalDataset().length === 0) {
        appendListEmptyMessage(grid);
      } else if (paginatedMode) {
        var loading = document.createElement("p");
        loading.className = "se-loading-hint";
        loading.textContent = "불러오는 중…";
        grid.appendChild(loading);
      }

      slide.appendChild(grid);
      mzSwipeTrack.appendChild(slide);
    }
    syncThumbSlideWidths();
  }

  /** 슬라이드 너비 = 뷰포트(clientWidth). flex 100%는 트랙 기준이라 다음 페이지가 살짝 보일 수 있음 */
  function syncThumbSlideWidths() {
    if (!mzSwipeViewport || !mzSwipeTrack) return;
    var w = mzSwipeViewport.clientWidth;
    if (w <= 0) return;
    var slides = mzSwipeTrack.querySelectorAll(".se-slide");
    for (var i = 0; i < slides.length; i++) {
      var slide = slides[i];
      slide.style.flex = "0 0 " + w + "px";
      slide.style.width = w + "px";
      slide.style.maxWidth = w + "px";
      slide.style.minWidth = w + "px";
    }
    mzSwipeTrack.style.width = slides.length * w + "px";
  }

  function updateThumbDots() {
    if (!dotsEl) return;
    if (window.TiCarouselDots) {
      window.TiCarouselDots.render(dotsEl, {
        total: thumbTotalPages,
        activeIndex: thumbActivePage,
        onSelect: goToThumbPage
      });
      return;
    }
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
    if (window.TiCarouselDots) {
      window.TiCarouselDots.render(dotsEl, {
        total: total,
        activeIndex: currentPage - 1,
        onSelect: function (index) {
          goToListPage(index + 1);
        }
      });
      return;
    }
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

  function getDisplayTotalCount() {
    if (paginatedMode) return apiTotal;
    return getFilteredLocalDataset().length;
  }

  function updatePagerChrome() {
    var st = getPagerState();

    if (pagerCountEl && Pager) {
      var totalCount = getDisplayTotalCount();
      pagerCountEl.textContent = "";
      var totalSpan = document.createElement("span");
      totalSpan.className = "ti-page-count__total";
      totalSpan.textContent = "총 " + totalCount + "건";
      pagerCountEl.appendChild(totalSpan);
      if (Pager.isDesktop() && st.totalPages > 1) {
        var dot = document.createElement("span");
        dot.className = "ti-page-count__dot";
        dot.setAttribute("aria-hidden", "true");
        pagerCountEl.appendChild(dot);
        var pageSpan = document.createElement("span");
        pageSpan.className = "ti-page-count__page";
        pageSpan.textContent = st.page + " / " + st.totalPages + " 페이지";
        pagerCountEl.appendChild(pageSpan);
      }
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
    if (paginatedMode) prefetchThumbAdjacent(thumbActivePage);
  }

  function goToThumbPage(pageIndex) {
    if (!mzSwipeViewport) return;
    pageIndex = Math.max(0, Math.min(thumbTotalPages - 1, pageIndex));
    thumbActivePage = pageIndex;
    if (paginatedMode) {
      ensureThumbPageLoaded(pageIndex).finally(function () {
        prefetchThumbAdjacent(pageIndex);
      });
    }
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

    if (!paginatedMode) refreshDataset();
    var cols = getGridColumns();
    if (mzThumbStack) {
      mzThumbStack.style.setProperty("--mz-thumb-cols", String(cols));
    }

    var nextIpp = computeThumbItemsPerPage();
    if (nextIpp < cols) nextIpp = cols;

    var prevIpp = thumbItemsPerPage;
    var itemOffset = thumbActivePage * prevIpp;
    var ippChanged = nextIpp !== prevIpp;
    thumbItemsPerPage = nextIpp;

    if (paginatedMode && ippChanged) {
      pageCache = {};
      pageFetchPromises = {};
      fetchMagazinePageApi(1, thumbItemsPerPage).then(function (res) {
        apiTotal = res.total;
        apiTotalPages = res.totalPages;
        thumbTotalPages = apiTotalPages;
        pageCache[1] = res.items || [];
        thumbActivePage = 0;
        buildThumbSlides();
        var w = mzSwipeViewport.clientWidth;
        mzSwipeViewport.scrollLeft = 0;
        updatePagerChrome();
        prefetchThumbAdjacent(0);
      });
      return;
    }

    var newTotal = getThumbTotalPages();
    thumbActivePage = paginatedMode
      ? thumbActivePage
      : Math.floor(itemOffset / thumbItemsPerPage);
    if (thumbActivePage >= newTotal) thumbActivePage = newTotal - 1;
    if (thumbActivePage < 0) thumbActivePage = 0;

    thumbTotalPages = newTotal;

    var nextKey =
      (paginatedMode ? "api" : "local") + cols + "x" + thumbItemsPerPage + "n" + getDisplayTotalCount();
    if (nextKey !== thumbLayoutKey || mzSwipeTrack.childElementCount === 0) {
      buildThumbSlides();
      thumbLayoutKey = nextKey;
    } else {
      syncThumbSlideWidths();
    }

    var w = mzSwipeViewport.clientWidth;
    mzSwipeViewport.scrollLeft = thumbActivePage * w;
    updatePagerChrome();

    if (mzSwipeHint) {
      mzSwipeHint.hidden = thumbTotalPages <= 1;
    }

    if (paginatedMode) prefetchThumbAdjacent(thumbActivePage);
  }

  function scheduleThumbLayout() {
    clearTimeout(thumbLayoutTimer);
    thumbLayoutTimer = window.setTimeout(function () {
      window.requestAnimationFrame(applyThumbLayoutFromViewport);
    }, 48);
  }

  function isMobileListInfinite() {
    return !!cfg.infiniteScrollList && COL_BREAKPOINT.matches && currentView === "list";
  }

  function teardownListInfiniteScroll() {
    if (listScrollObs) {
      listScrollObs.disconnect();
      listScrollObs = null;
    }
    var sentinel = document.getElementById("mzListScrollSentinel");
    if (sentinel && sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);
  }

  function setupListInfiniteScroll() {
    teardownListInfiniteScroll();
    if (!isMobileListInfinite() || !listEl) return;

    var sentinel = document.createElement("div");
    sentinel.id = "mzListScrollSentinel";
    sentinel.className = "mz-list-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    listEl.appendChild(sentinel);

    var scrollRoot = document.querySelector(".ti-mz-scroll") || null;
    listScrollObs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) loadMoreListItems();
        });
      },
      { root: scrollRoot, rootMargin: "240px 0px", threshold: 0 }
    );
    listScrollObs.observe(sentinel);
  }

  function loadMoreListItems() {
    if (!paginatedMode || listLoading || !listHasMore || !isMobileListInfinite()) return;
    listLoading = true;
    var nextPage = listLoadedPages + 1;
    fetchMagazinePageApi(nextPage, ITEMS_PER_PAGE_LIST)
      .then(function (res) {
        listLoadedPages = nextPage;
        listHasMore = nextPage < res.totalPages;
        pageCache[nextPage] = res.items || [];
        (res.items || []).forEach(function (item) {
          listItemsAccum.push(item);
          listEl.insertBefore(
            createItemElement(item, !!cfg.showExcerptInList),
            document.getElementById("mzListScrollSentinel")
          );
        });
        apiTotal = res.total;
        apiTotalPages = res.totalPages;
        updatePagerChrome();
      })
      .finally(function () {
        listLoading = false;
      });
  }

  function resetPaginatedCache() {
    pageCache = {};
    pageFetchPromises = {};
    thumbLayoutKey = "";
  }

  function fetchListPageItems(page) {
    if (!paginatedMode) return Promise.resolve(getListPageItems(page));
    var cached = pageCache[page];
    if (cached && cached.length <= ITEMS_PER_PAGE_LIST) {
      return Promise.resolve(cached);
    }
    delete pageCache[page];
    delete pageFetchPromises[page];
    return fetchMagazinePageApi(page, ITEMS_PER_PAGE_LIST).then(function (res) {
      pageCache[page] = res.items || [];
      apiTotal = res.total;
      apiTotalPages = res.totalPages;
      return pageCache[page];
    });
  }

  function renderListView() {
    if (!listEl) return;
    listEl.classList.remove("is-thumb");
    listEl.classList.add("is-list");

    if (isMobileListInfinite()) {
      if (listLoadedPages === 0) {
        listEl.innerHTML = "";
        listItemsAccum = [];
        listHasMore = true;
        fetchListPageItems(1).then(function (items) {
          listLoadedPages = 1;
          listHasMore = apiTotalPages > 1;
          items.forEach(function (item) {
            listItemsAccum.push(item);
            listEl.appendChild(createItemElement(item, !!cfg.showExcerptInList));
          });
          setupListInfiniteScroll();
          updatePagerChrome();
        });
      } else {
        setupListInfiniteScroll();
      }
      return;
    }

    teardownListInfiniteScroll();
    listEl.innerHTML = "";
    if (paginatedMode) {
      fetchListPageItems(currentPage).then(function (items) {
        if (!items.length) {
          appendListEmptyMessage(listEl);
          updatePagerChrome();
          return;
        }
        items.forEach(function (item) {
          listEl.appendChild(createItemElement(item, !!cfg.showExcerptInList));
        });
        updatePagerChrome();
      });
      return;
    }
    var pageItems = getListPageItems(currentPage);
    if (!pageItems.length) {
      appendListEmptyMessage(listEl);
      updatePagerChrome();
      return;
    }
    pageItems.forEach(function (item) {
      listEl.appendChild(createItemElement(item, !!cfg.showExcerptInList));
    });
    updatePagerChrome();
  }

  function onSearchQueryChange(value) {
    searchQuery = value;
    resetPaginatedCache();
    listItemsAccum = [];
    listLoadedPages = 0;
    listHasMore = true;
    thumbActivePage = 0;
    currentPage = 1;
    purgeThumbCarousel();

    if (paginatedMode) {
      var pageSize =
        currentView === "list" ? ITEMS_PER_PAGE_LIST : thumbItemsPerPage || 8;
      fetchMagazinePageApi(1, pageSize)
        .then(function (res) {
          apiTotal = res.total;
          apiTotalPages = res.totalPages;
          thumbTotalPages = apiTotalPages;
          pageCache[1] = res.items || [];
          dataset = res.items || [];
          applyCurrentView();
        })
        .catch(function () {
          apiTotal = 0;
          apiTotalPages = 1;
          applyCurrentView();
        });
      return;
    }
    applyCurrentView();
  }

  function setupListSearch() {
    if (!SEARCH_ENABLED || !window.TiListSearch) return;
    window.TiListSearch.setup({
      mountEl: document.getElementById("mzSearch"),
      inputId: "mzSearchInput",
      placeholder: SEARCH_PLACEHOLDER,
      debounceMs: searchCfg.debounceMs != null ? searchCfg.debounceMs : 350,
      onQueryChange: onSearchQueryChange
    });
  }

  function goToListPage(page) {
    var total = getListTotalPages();
    page = Math.max(1, Math.min(total, page));
    if (page === currentPage && !isMobileListInfinite()) return;
    currentPage = page;
    if (isMobileListInfinite()) {
      listLoadedPages = 0;
      listItemsAccum = [];
    }
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
    if (paginatedMode) resetPaginatedCache();
    if (currentView === "thumb") {
      thumbActivePage = 0;
      thumbItemsPerPage = getGridColumns();
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(scheduleThumbLayout);
      });
    } else {
      currentPage = 1;
      listLoadedPages = 0;
      listItemsAccum = [];
      teardownListInfiniteScroll();
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
    setupListSearch();
    bindEvents();
    loadDataset()
      .then(function () {
        ensureDatasetThenRender();
        applyCurrentView();
      })
      .catch(function () {
        dataset = [];
        ensureDatasetThenRender();
        applyCurrentView();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

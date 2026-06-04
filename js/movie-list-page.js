/**
 * 상영작 목록 페이지 공통 (현재 / 예정 / 지난)
 * window.TI_MOVIE_LIST_PAGE_CONFIG
 * (하위 호환: TI_NOW_PLAYING_LIST_CONFIG)
 * 최신 버전 테스트
 */
(function () {
  var cfg = window.TI_MOVIE_LIST_PAGE_CONFIG || window.TI_NOW_PLAYING_LIST_CONFIG || {};
  var LIST_DATA_URL = cfg.dataUrl || "movies/now-playing/data/now-playing-list.json";
  var DETAIL_MODE = cfg.detailUrlMode || "seo";
  var DETAIL_SECTION = cfg.detailSection || "now-playing";
  var EMPTY_MESSAGE = cfg.emptyMessage || "표시할 상영작이 없습니다.";
  var LOADING_MESSAGE = cfg.loadingMessage || "상영작 목록을 불러오는 중…";
  var ERROR_MESSAGE = cfg.errorMessage || "상영작 목록을 표시할 수 없습니다.";
  var SCROLL_ROOT = cfg.scrollRootSelector || ".ti-np-scroll";
  var searchCfg = cfg.search || {};
  var SEARCH_ENABLED = !!searchCfg.enabled;
  var SEARCH_FIELDS = searchCfg.fields || ["titleKo", "titleEn", "director"];
  var SEARCH_PLACEHOLDER =
    searchCfg.placeholder || "감독, 제목, 영어제목";
  var SEARCH_NO_RESULTS =
    searchCfg.noResultsMessage || "검색 결과가 없습니다.";

  var PAGE_SIZE = cfg.pageSize || 6;
  /* 조치필요(테스트스피너): cfg.testSpinnerDelayMs — 스피너 확인용 지연(ms), 배포 전 제거 */
  var TEST_SPINNER_DELAY_MS =
    typeof cfg.testSpinnerDelayMs === "number" && cfg.testSpinnerDelayMs > 0
      ? cfg.testSpinnerDelayMs
      : 0;
  var Pager = window.TiPagePager;
  var grid = document.getElementById("npGrid");
  var pager = document.getElementById("npPager");
  var countEl = document.getElementById("npCount");
  var sentinel = document.getElementById("npSentinel");
  var loadMoreEl = document.getElementById("npLoadMore");
  var endEl = document.getElementById("npEnd");
  var searchInput = document.getElementById("npSearchInput");
  var searchWrap = document.getElementById("npSearch");
  var io = null;
  var searchDebounceTimer = null;
  var USE_PAGED_API = typeof cfg.fetchPage === "function";
  var SEARCH_DEBOUNCE_MS =
    USE_PAGED_API && typeof searchCfg.debounceMs === "number"
      ? Math.max(0, searchCfg.debounceMs)
      : USE_PAGED_API
        ? 350
        : 0;
  var state = {
    page: 1,
    mobileShown: PAGE_SIZE,
    searchQuery: "",
    isLoadingMore: false,
    isLoadingPage: false,
    apiTotal: 0,
    apiTotalPages: 0,
    mobileApiPage: 0,
    listEpoch: 0
  };
  var movieList = [];

  if (!grid) return;

  function isDesktop() {
    return Pager && Pager.isDesktop();
  }

  function rootPath(u) {
    if (!u) return "";
    if (/^https?:/i.test(u)) return u;
    if (u.startsWith("../")) return u;
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(u);
    }
    return u.replace(/^\//, "");
  }

  function buildSeoDetailUrl(slug) {
    return "movies/now-playing/" + slug + ".html";
  }

  function buildListReturnParams() {
    var ret = new URLSearchParams();
    if (USE_PAGED_API) {
      if (isDesktop()) {
        if (state.page > 1) ret.set("page", String(state.page));
      } else {
        if (state.mobileApiPage > 1) ret.set("page", String(state.mobileApiPage));
        if (state.mobileShown > PAGE_SIZE) {
          ret.set("mobileShown", String(state.mobileShown));
        }
      }
      var sq = normalizeSearchText(state.searchQuery);
      if (sq) ret.set("q", sq);
    }
    return ret;
  }

  function buildQueryDetailUrl(slug) {
    var q = "slug=" + encodeURIComponent(slug);
    if (DETAIL_SECTION) {
      q += "&from=" + encodeURIComponent(DETAIL_SECTION);
    }
    if (USE_PAGED_API) {
      var ret = buildListReturnParams();
      ret.forEach(function (value, key) {
        if (key === "page") q += "&listPage=" + encodeURIComponent(value);
        else if (key === "q") q += "&listQ=" + encodeURIComponent(value);
        else if (key === "mobileShown") q += "&mobileShown=" + encodeURIComponent(value);
      });
    }
    return "movies/movie-detail.html?" + q;
  }

  function buildDetailUrl(slug) {
    if (DETAIL_MODE === "query") return buildQueryDetailUrl(slug);
    return buildSeoDetailUrl(slug);
  }

  function detailHref(item) {
    if (!item) return "";
    if (USE_PAGED_API && item.slug) return rootPath(buildDetailUrl(item.slug));
    if (item.detailUrl) return rootPath(item.detailUrl);
    if (item.slug) return rootPath(buildDetailUrl(item.slug));
    return "";
  }

  function readListStateFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return {
      page: Math.max(1, parseInt(params.get("page"), 10) || 1),
      q: params.get("q") || "",
      mobileShown: Math.max(
        PAGE_SIZE,
        parseInt(params.get("mobileShown"), 10) || PAGE_SIZE
      )
    };
  }

  function syncListUrl() {
    if (!USE_PAGED_API || typeof history === "undefined" || !history.replaceState) {
      return;
    }
    var params = buildListReturnParams();
    var qs = params.toString();
    var url = window.location.pathname + (qs ? "?" + qs : "");
    history.replaceState(null, "", url);
  }

  function fetchMoviePage(page, query, epoch) {
    return Promise.resolve(cfg.fetchPage(page, PAGE_SIZE, query || undefined)).then(
      function (res) {
        if (epoch == null || epoch === state.listEpoch) {
          state.apiTotal = (res && res.total) || 0;
          state.apiTotalPages = (res && res.totalPages) || 0;
          state.page = (res && res.page) || page;
        }
        var payload = res && res.movies ? res.movies : res;
        return normalizeListPayload(payload);
      }
    );
  }

  function fetchMovieList() {
    if (USE_PAGED_API) {
      return fetchMoviePage(1, normalizeSearchText(state.searchQuery));
    }
    if (typeof cfg.fetchList === "function") {
      return Promise.resolve(cfg.fetchList()).then(normalizeListPayload);
    }
    var listUrl =
      window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function"
        ? window.TiSiteRoot.resolve(LIST_DATA_URL)
        : LIST_DATA_URL;
    return fetch(listUrl, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error(ERROR_MESSAGE + " (" + res.status + ")");
        return res.json();
      })
      .then(normalizeListPayload);
  }

  /* 조치필요(테스트스피너): 스피너 노출 확인용 최소 대기 */
  function waitForTestSpinner(value) {
    if (!TEST_SPINNER_DELAY_MS) return Promise.resolve(value);
    return new Promise(function (resolve) {
      window.setTimeout(function () {
        resolve(value);
      }, TEST_SPINNER_DELAY_MS);
    });
  }

  function normalizeListPayload(payload) {
    var raw = Array.isArray(payload) ? payload : payload && payload.movies;
    if (!Array.isArray(raw)) return [];
    return raw.map(function (item) {
      var slug = item.slug || "";
      return {
        slug: slug,
        poster: item.poster || "",
        titleKo: item.titleKo || item.title || "",
        titleEn: item.titleEn || "",
        director: item.director || "",
        detailUrl: item.detailUrl || (slug ? buildDetailUrl(slug) : "")
      };
    });
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchesSearch(movie, query) {
    if (!query) return true;
    return SEARCH_FIELDS.some(function (field) {
      return normalizeSearchText(movie[field]).indexOf(query) !== -1;
    });
  }

  function filteredMovies() {
    if (USE_PAGED_API) return movieList;
    var query = normalizeSearchText(state.searchQuery);
    if (!query) return movieList;
    return movieList.filter(function (m) {
      return matchesSearch(m, query);
    });
  }

  function allMovies() {
    return filteredMovies();
  }

  function totalPages(n) {
    return Math.max(1, Math.ceil(n / PAGE_SIZE));
  }

  function dedupeMoviesBySlug(list) {
    var seen = Object.create(null);
    return list.filter(function (m) {
      var key = (m && m.slug) || (m && m.titleKo) || "";
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function sliceForView() {
    var list = dedupeMoviesBySlug(allMovies());
    if (isDesktop()) {
      /* API 페이지 모드: movieList 가 이미 해당 페이지 분량만 담김 */
      if (USE_PAGED_API) return list;
      var start = (state.page - 1) * PAGE_SIZE;
      return list.slice(start, start + PAGE_SIZE);
    }
    return list.slice(0, state.mobileShown);
  }

  function bumpListEpoch() {
    state.listEpoch += 1;
    return state.listEpoch;
  }

  function isActiveEpoch(epoch) {
    return epoch === state.listEpoch;
  }

  function clearListLoadingUi() {
    state.isLoadingPage = false;
    state.isLoadingMore = false;
    setMobileLoadMoreSpinner(false);
  }

  /**
   * @param {number} epoch
   * @param {Array} list
   * @param {{ page?: number, mobileApiPage?: number, mobileShown?: number }} [opts]
   */
  function completePageLoad(epoch, list, opts) {
    if (!isActiveEpoch(epoch)) return;
    clearListLoadingUi();
    movieList = list || [];
    opts = opts || {};
    if (opts.page != null) state.page = opts.page;
    if (opts.mobileApiPage != null) state.mobileApiPage = opts.mobileApiPage;
    if (opts.mobileShown != null) state.mobileShown = opts.mobileShown;
    render();
  }

  function renderCard(m) {
    var article = document.createElement("article");
    article.className = "np-card";
    var media = document.createElement("div");
    media.className = "np-card-media";
    var img = document.createElement("img");
    img.src = rootPath(m.poster);
    img.width = 400;
    img.height = 600;
    img.alt = m.titleKo + " 포스터";
    img.loading = "lazy";
    img.decoding = "async";
    var link = document.createElement("a");
    link.href = detailHref(m);
    link.className = "np-stretch-link";
    link.setAttribute("aria-label", m.titleKo + " 상세 보기");
    media.appendChild(img);
    media.appendChild(link);
    var body = document.createElement("div");
    body.className = "np-card-body";
    var h2 = document.createElement("h2");
    h2.className = "np-card-title";
    var tlink = document.createElement("a");
    tlink.href = detailHref(m);
    tlink.textContent = m.titleKo;
    h2.appendChild(tlink);
    body.appendChild(h2);
    if (m.titleEn) {
      var en = document.createElement("p");
      en.className = "np-card-en";
      en.textContent = m.titleEn;
      body.appendChild(en);
    }
    article.appendChild(media);
    article.appendChild(body);
    return article;
  }

  function showListMessage(message, isError, isLoading) {
    grid.innerHTML = "";
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
    if (countEl) countEl.textContent = "";
    if (Pager) Pager.updateVisibility(pager, 0);
    if (endEl) endEl.classList.remove("is-visible");
  }

  function hasActiveSearch() {
    return !!normalizeSearchText(state.searchQuery);
  }

  function searchStatusMessage() {
    if (!hasActiveSearch()) return "";
    if (USE_PAGED_API && state.apiTotal === 0) return SEARCH_NO_RESULTS;
    if (!USE_PAGED_API && !movieList.length) return "";
    return SEARCH_NO_RESULTS;
  }

  function formatDesktopCountText(countTotal, tp) {
    if (USE_PAGED_API && hasActiveSearch()) {
      return "검색 " + countTotal + "편 · " + state.page + " / " + tp + " 페이지";
    }
    return Pager.formatMovies(countTotal, state.page, tp);
  }

  function formatMobileCountText(list) {
    var totalCount = USE_PAGED_API ? state.apiTotal : list.length;
    var shown = Math.min(state.mobileShown, list.length);
    if (USE_PAGED_API && hasActiveSearch()) {
      return "검색 " + totalCount + "편 · " + shown + "편 표시";
    }
    return "총 " + totalCount + "편 · " + shown + "편 표시";
  }

  function listIsEmpty() {
    if (USE_PAGED_API) {
      if (hasActiveSearch() && !movieList.length) return true;
      return state.apiTotal === 0 || !allMovies().length;
    }
    return !allMovies().length;
  }

  function renderDesktopPage(page, reuseEpoch) {
    var epoch = reuseEpoch != null ? reuseEpoch : bumpListEpoch();
    state.isLoadingPage = true;
    showListMessage(LOADING_MESSAGE, false, true);
    fetchMoviePage(page, normalizeSearchText(state.searchQuery), epoch)
      .then(waitForTestSpinner)
      .then(function (list) {
        completePageLoad(epoch, list, { page: page });
      })
      .catch(function (err) {
        if (!isActiveEpoch(epoch)) return;
        clearListLoadingUi();
        movieList = [];
        showListMessage((err && err.message) || ERROR_MESSAGE, true);
      });
  }

  function render() {
    clearListLoadingUi();
    var list = dedupeMoviesBySlug(allMovies());
    if (listIsEmpty()) {
      var msg = searchStatusMessage() || EMPTY_MESSAGE;
      showListMessage(msg, false, false);
      if (countEl && hasActiveSearch()) {
        countEl.textContent = "검색 결과 0편";
      }
      return;
    }

    grid.innerHTML = "";
    sliceForView().forEach(function (m) {
      grid.appendChild(renderCard(m));
    });

    if (isDesktop()) {
      var tp = USE_PAGED_API ? Math.max(1, state.apiTotalPages) : totalPages(list.length);
      var countTotal = USE_PAGED_API ? state.apiTotal : list.length;
      if (countEl) {
        var countText = formatDesktopCountText(countTotal, tp);
        if (!USE_PAGED_API && hasActiveSearch() && movieList.length !== list.length) {
          countText += " · 전체 " + movieList.length + "편 중";
        }
        countEl.textContent = countText;
      }
      if (Pager) {
        Pager.render(pager, {
          page: state.page,
          totalPages: tp,
          scrollRootSelector: SCROLL_ROOT,
          onChange: function (p) {
            if (USE_PAGED_API) {
              if (p !== state.page) renderDesktopPage(p);
            } else {
              state.page = p;
              render();
            }
          }
        });
      }
    } else {
      if (Pager) Pager.updateVisibility(pager, 0);
      var totalCount = USE_PAGED_API ? state.apiTotal : list.length;
      if (countEl) {
        var mobileCount = formatMobileCountText(list);
        if (!USE_PAGED_API && hasActiveSearch() && movieList.length !== list.length) {
          mobileCount += " (전체 " + movieList.length + "편)";
        }
        countEl.textContent = mobileCount;
      }
      if (endEl) {
        var allLoaded =
          USE_PAGED_API
            ? state.mobileApiPage >= state.apiTotalPages && state.mobileShown >= list.length
            : state.mobileShown >= list.length;
        endEl.classList.toggle("is-visible", allLoaded && list.length > 0);
      }
    }

    if (USE_PAGED_API) syncListUrl();
  }

  function onResizeMode() {
    state.page = 1;
    state.mobileShown = PAGE_SIZE;
    state.mobileApiPage = 0;
    if (USE_PAGED_API) {
      loadInitialPaged();
    } else {
      render();
    }
  }

  function setMobileLoadMoreSpinner(visible) {
    if (!loadMoreEl) return;
    if (!visible) {
      loadMoreEl.hidden = true;
      loadMoreEl.setAttribute("aria-busy", "false");
      loadMoreEl.innerHTML = "";
      return;
    }
    loadMoreEl.hidden = false;
    loadMoreEl.setAttribute("aria-busy", "true");
    loadMoreEl.innerHTML = "";
    if (window.TiLogoSpinner) {
      loadMoreEl.appendChild(
        window.TiLogoSpinner.create({
          size: 64,
          label: "다음 상영작 불러오는 중"
        })
      );
    }
  }

  function finishMobileLoadMore(applyFn) {
    var epoch = state.listEpoch;
    state.isLoadingMore = true;
    setMobileLoadMoreSpinner(true);
    var startedAt = Date.now();
    var minSpinnerMs = TEST_SPINNER_DELAY_MS || 360;

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var elapsed = Date.now() - startedAt;
        var delay = Math.max(0, minSpinnerMs - elapsed);
        window.setTimeout(function () {
          if (!isActiveEpoch(epoch)) return;
          applyFn();
          clearListLoadingUi();
          render();
        }, delay);
      });
    });
  }

  function loadMoreOnMobile() {
    if (isDesktop() || state.isLoadingMore || state.isLoadingPage) return;
    var list = allMovies();

    if (!USE_PAGED_API) {
      if (state.mobileShown >= list.length) return;
      finishMobileLoadMore(function () {
        state.mobileShown = Math.min(state.mobileShown + PAGE_SIZE, list.length);
      });
      return;
    }

    if (state.mobileShown < list.length) {
      finishMobileLoadMore(function () {
        state.mobileShown = Math.min(state.mobileShown + PAGE_SIZE, list.length);
      });
      return;
    }

    if (state.mobileApiPage < 1) return;
    if (state.mobileApiPage >= state.apiTotalPages) return;

    var nextPage = state.mobileApiPage + 1;
    var epoch = state.listEpoch;
    state.isLoadingMore = true;
    setMobileLoadMoreSpinner(true);
    fetchMoviePage(nextPage, normalizeSearchText(state.searchQuery), epoch)
      .then(waitForTestSpinner)
      .then(function (pageList) {
        if (!isActiveEpoch(epoch)) return;
        state.mobileApiPage = nextPage;
        movieList = dedupeMoviesBySlug(movieList.concat(pageList));
        state.mobileShown = Math.min(state.mobileShown + PAGE_SIZE, movieList.length);
        clearListLoadingUi();
        render();
      })
      .catch(function () {
        if (!isActiveEpoch(epoch)) return;
        clearListLoadingUi();
      });
  }

  function setupInfinite() {
    if (io) {
      io.disconnect();
      io = null;
    }
    if (!sentinel) return;
    io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadMoreOnMobile();
        });
      },
      { root: null, rootMargin: "180px 0px", threshold: 0 }
    );
    io.observe(sentinel);
  }

  if (Pager && Pager.mq) {
    Pager.mq.addEventListener("change", function () {
      onResizeMode();
      setupInfinite();
      if (Pager.isDesktop && Pager.isDesktop()) closeMobileSearch();
    });
  }

  function applyPagedSearch() {
    var query = normalizeSearchText(state.searchQuery);
    var epoch = bumpListEpoch();
    state.isLoadingMore = false;
    setMobileLoadMoreSpinner(false);
    if (io) {
      io.disconnect();
      io = null;
    }
    showListMessage(LOADING_MESSAGE, false, true);
    movieList = [];
    state.mobileApiPage = 0;
    state.apiTotal = 0;
    state.apiTotalPages = 0;
    state.page = 1;
    state.mobileShown = PAGE_SIZE;

    if (isDesktop()) {
      renderDesktopPage(1, epoch);
      return;
    }

    state.isLoadingPage = true;
    fetchMoviePage(1, query || undefined, epoch)
      .then(waitForTestSpinner)
      .then(function (list) {
        completePageLoad(epoch, list, {
          page: 1,
          mobileApiPage: 1,
          mobileShown: PAGE_SIZE
        });
        setupInfinite();
      })
      .catch(function (err) {
        if (!isActiveEpoch(epoch)) return;
        clearListLoadingUi();
        movieList = [];
        showListMessage((err && err.message) || ERROR_MESSAGE, true);
      });
  }

  function onSearchInput() {
    if (!searchInput) return;
    state.searchQuery = searchInput.value;
    state.page = 1;
    state.mobileShown = PAGE_SIZE;

    if (USE_PAGED_API) {
      if (searchDebounceTimer) window.clearTimeout(searchDebounceTimer);
      if (SEARCH_DEBOUNCE_MS > 0) {
        searchDebounceTimer = window.setTimeout(applyPagedSearch, SEARCH_DEBOUNCE_MS);
      } else {
        applyPagedSearch();
      }
      return;
    }

    render();
  }

  function loadMobilePagedRestore(targetApiPage, targetShown, query) {
    var epoch = bumpListEpoch();
    state.isLoadingPage = true;
    movieList = [];
    state.mobileApiPage = 0;
    state.apiTotal = 0;
    state.apiTotalPages = 0;
    var chain = Promise.resolve();
    var p;
    for (p = 1; p <= targetApiPage; p++) {
      (function (pageNum) {
        chain = chain.then(function () {
          if (!isActiveEpoch(epoch)) return;
          return fetchMoviePage(pageNum, query, epoch).then(function (list) {
            if (!isActiveEpoch(epoch)) return;
            movieList = dedupeMoviesBySlug(movieList.concat(list));
            state.mobileApiPage = pageNum;
          });
        });
      })(p);
    }
    chain
      .then(waitForTestSpinner)
      .then(function () {
        if (!isActiveEpoch(epoch)) return;
        completePageLoad(epoch, movieList, {
          page: 1,
          mobileShown: Math.min(targetShown, movieList.length)
        });
        setupInfinite();
      })
      .catch(function (err) {
        if (!isActiveEpoch(epoch)) return;
        clearListLoadingUi();
        movieList = [];
        showListMessage((err && err.message) || ERROR_MESSAGE, true);
      });
  }

  function loadInitialPaged() {
    var urlState = readListStateFromUrl();
    if (searchInput && urlState.q) {
      searchInput.value = urlState.q;
      state.searchQuery = urlState.q;
    }

    showListMessage(LOADING_MESSAGE, false, true);
    movieList = [];
    state.mobileApiPage = 0;
    state.apiTotal = 0;
    state.apiTotalPages = 0;
    state.mobileShown = PAGE_SIZE;

    var query = normalizeSearchText(state.searchQuery);
    var initialPage = urlState.page;

    if (isDesktop()) {
      state.page = initialPage;
      renderDesktopPage(initialPage);
      return;
    }

    state.page = 1;

    if (urlState.page > 1 || urlState.mobileShown > PAGE_SIZE) {
      loadMobilePagedRestore(urlState.page, urlState.mobileShown, query);
      return;
    }

    var epoch = bumpListEpoch();
    state.isLoadingPage = true;
    fetchMoviePage(1, query, epoch)
      .then(waitForTestSpinner)
      .then(function (list) {
        completePageLoad(epoch, list, {
          page: 1,
          mobileApiPage: 1,
          mobileShown: PAGE_SIZE
        });
        setupInfinite();
      })
      .catch(function (err) {
        if (!isActiveEpoch(epoch)) return;
        clearListLoadingUi();
        movieList = [];
        showListMessage((err && err.message) || ERROR_MESSAGE, true);
      });
  }

  var SEARCH_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.75"/>' +
    '<path d="M16 16L20.5 20.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="square"/>' +
    "</svg>";

  function createSearchIcon(className) {
    var icon = document.createElement("span");
    icon.className = className || "np-search-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = SEARCH_SVG;
    return icon;
  }

  function ensureSearchPanelStructure() {
    if (!searchWrap) return null;
    var toggle = searchWrap.querySelector(".np-search-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "np-search-toggle";
      toggle.id = "npSearchToggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", "npSearchPanel");
      toggle.setAttribute("aria-label", "검색 열기");
      var toggleIcon = createSearchIcon("np-search-toggle__icon");
      toggleIcon.innerHTML = SEARCH_SVG.replace('width="16" height="16"', 'width="18" height="18"');
      toggle.appendChild(toggleIcon);
      searchWrap.insertBefore(toggle, searchWrap.firstChild);
    }
    var panel = searchWrap.querySelector(".np-search-panel");
    var field = searchWrap.querySelector(".np-search-field");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "np-search-panel";
      panel.id = "npSearchPanel";
      if (field) {
        searchWrap.insertBefore(panel, field);
        panel.appendChild(field);
      } else {
        searchWrap.appendChild(panel);
      }
    } else if (field && field.parentElement !== panel) {
      panel.appendChild(field);
    }
    return panel;
  }

  function closeMobileSearch() {
    if (!searchWrap) return;
    searchWrap.classList.remove("is-open");
    var toggle = document.getElementById("npSearchToggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "검색 열기");
    }
  }

  function setupSearchToggle() {
    ensureSearchPanelStructure();
    var toggle = document.getElementById("npSearchToggle");
    if (!toggle || !searchWrap) return;
    if (toggle.dataset.bound === "1") return;
    toggle.dataset.bound = "1";

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !searchWrap.classList.contains("is-open");
      if (open) {
        searchWrap.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "검색 닫기");
        if (searchInput) {
          window.requestAnimationFrame(function () {
            searchInput.focus();
          });
        }
      } else {
        closeMobileSearch();
      }
    });

    if (!document.documentElement.dataset.npSearchDismissBound) {
      document.documentElement.dataset.npSearchDismissBound = "1";
      document.addEventListener("click", function (e) {
        if (!searchWrap || !searchWrap.classList.contains("is-open")) return;
        if (searchWrap.contains(e.target)) return;
        closeMobileSearch();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeMobileSearch();
      });
    }
  }

  function normalizeSearchToolbarLayout() {
    var toolbar = document.querySelector(".ti-np-root .ti-page-toolbar");
    if (!toolbar) return;
    var legacy = toolbar.querySelector(".ti-page-toolbar__trailing");
    if (legacy) {
      var pagerInLegacy = legacy.querySelector(".ti-page-pager");
      if (pagerInLegacy) toolbar.appendChild(pagerInLegacy);
      legacy.classList.remove("ti-page-toolbar__trailing");
      legacy.classList.add("ti-page-toolbar__meta");
    }
    var meta = toolbar.querySelector(".ti-page-toolbar__meta");
    if (meta) {
      var pagerInMeta = meta.querySelector(".ti-page-pager");
      if (pagerInMeta) toolbar.appendChild(pagerInMeta);
    }
    if (meta || toolbar.querySelector(".np-search")) {
      toolbar.classList.add("ti-page-toolbar--with-search");
    }
  }

  function ensureSearchMetaRow() {
    var toolbar = document.querySelector(".ti-np-root .ti-page-toolbar");
    if (!toolbar) return null;
    normalizeSearchToolbarLayout();
    var meta = toolbar.querySelector(".ti-page-toolbar__meta");
    if (!meta) {
      meta = document.createElement("div");
      meta.className = "ti-page-toolbar__meta";
      var count = toolbar.querySelector(".ti-page-count");
      if (count) meta.appendChild(count);
      toolbar.classList.add("ti-page-toolbar--with-search");
      toolbar.insertBefore(meta, toolbar.firstChild);
      var pagerEl = document.getElementById("npPager");
      if (pagerEl && pagerEl.parentElement !== toolbar) {
        toolbar.appendChild(pagerEl);
      }
    }
    return meta;
  }

  function setupSearch() {
    if (!SEARCH_ENABLED) {
      if (searchWrap) searchWrap.hidden = true;
      return;
    }
    normalizeSearchToolbarLayout();
    if (searchWrap) searchWrap.hidden = false;
    if (!searchInput) {
      var metaRow = ensureSearchMetaRow();
      searchWrap = searchWrap || document.getElementById("npSearch");
      if (!searchWrap) {
        searchWrap = document.createElement("div");
        searchWrap.id = "npSearch";
        searchWrap.className = "np-search";
        if (metaRow) {
          metaRow.appendChild(searchWrap);
        } else {
          var head = document.querySelector(".ti-np-root .np-head");
          if (head) head.insertAdjacentElement("afterend", searchWrap);
        }
      }
      var panel = document.createElement("div");
      panel.className = "np-search-panel";
      panel.id = "npSearchPanel";
      var field = document.createElement("label");
      field.className = "np-search-field";
      field.htmlFor = "npSearchInput";
      field.appendChild(createSearchIcon());
      searchInput = document.createElement("input");
      searchInput.type = "search";
      searchInput.id = "npSearchInput";
      searchInput.className = "np-search-input";
      searchInput.placeholder = SEARCH_PLACEHOLDER;
      searchInput.setAttribute("aria-label", SEARCH_PLACEHOLDER);
      searchInput.autocomplete = "off";
      field.appendChild(searchInput);
      panel.appendChild(field);
      searchWrap.appendChild(panel);
    } else {
      searchInput.placeholder = SEARCH_PLACEHOLDER;
      searchInput.setAttribute("aria-label", SEARCH_PLACEHOLDER);
    }
    ensureSearchPanelStructure();
    setupSearchToggle();
    searchInput.addEventListener("input", onSearchInput);
    searchInput.addEventListener("search", onSearchInput);
    if (USE_PAGED_API) {
      searchInput.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (searchDebounceTimer) {
          window.clearTimeout(searchDebounceTimer);
          searchDebounceTimer = null;
        }
        applyPagedSearch();
      });
    }
  }

  function boot() {
    setupSearch();
    if (USE_PAGED_API) {
      loadInitialPaged();
      return;
    }

    showListMessage(LOADING_MESSAGE, false, true);
    fetchMovieList()
      .then(waitForTestSpinner)
      .then(function (list) {
        movieList = list;
        state.page = 1;
        state.mobileShown = PAGE_SIZE;
        render();
        setupInfinite();
      })
      .catch(function (err) {
        movieList = [];
        showListMessage((err && err.message) || ERROR_MESSAGE, true);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

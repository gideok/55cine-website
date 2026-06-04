/**
 * 상영작 목록 페이지 공통 (현재 / 예정 / 지난)
 * window.TI_MOVIE_LIST_PAGE_CONFIG
 * (하위 호환: TI_NOW_PLAYING_LIST_CONFIG)
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
  var state = { page: 1, mobileShown: PAGE_SIZE, searchQuery: "", isLoadingMore: false };
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

  function buildQueryDetailUrl(slug) {
    var q = "slug=" + encodeURIComponent(slug);
    if (DETAIL_SECTION) {
      q += "&from=" + encodeURIComponent(DETAIL_SECTION);
    }
    return "movies/movie-detail.html?" + q;
  }

  function buildDetailUrl(slug) {
    if (DETAIL_MODE === "query") return buildQueryDetailUrl(slug);
    return buildSeoDetailUrl(slug);
  }

  function detailHref(item) {
    if (!item) return "";
    if (item.detailUrl) return rootPath(item.detailUrl);
    if (item.slug) return rootPath(buildDetailUrl(item.slug));
    return "";
  }

  function fetchMovieList() {
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

  function sliceForView() {
    var list = allMovies();
    if (isDesktop()) {
      var start = (state.page - 1) * PAGE_SIZE;
      return list.slice(start, start + PAGE_SIZE);
    }
    return list.slice(0, state.mobileShown);
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

  function searchStatusMessage() {
    if (!normalizeSearchText(state.searchQuery)) return "";
    if (!movieList.length) return "";
    return SEARCH_NO_RESULTS;
  }

  function render() {
    var list = allMovies();
    if (!list.length) {
      var msg = searchStatusMessage() || EMPTY_MESSAGE;
      showListMessage(msg, false);
      if (countEl && normalizeSearchText(state.searchQuery) && movieList.length) {
        countEl.textContent = "검색 결과 0편";
      }
      return;
    }

    grid.innerHTML = "";
    sliceForView().forEach(function (m) {
      grid.appendChild(renderCard(m));
    });

    if (isDesktop()) {
      var tp = totalPages(list.length);
      if (countEl) {
        var countText = Pager.formatMovies(list.length, state.page, tp);
        if (normalizeSearchText(state.searchQuery) && movieList.length !== list.length) {
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
            state.page = p;
            render();
          }
        });
      }
    } else {
      if (Pager) Pager.updateVisibility(pager, 0);
      if (countEl) {
        var mobileCount =
          "총 " + list.length + "편 · " + Math.min(state.mobileShown, list.length) + "편 표시";
        if (normalizeSearchText(state.searchQuery) && movieList.length !== list.length) {
          mobileCount += " (전체 " + movieList.length + "편)";
        }
        countEl.textContent = mobileCount;
      }
      if (endEl) {
        endEl.classList.toggle(
          "is-visible",
          state.mobileShown >= list.length && list.length > 0
        );
      }
    }
  }

  function onResizeMode() {
    state.page = 1;
    state.mobileShown = PAGE_SIZE;
    render();
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

  function loadMoreOnMobile() {
    if (isDesktop() || state.isLoadingMore) return;
    var list = allMovies();
    if (state.mobileShown >= list.length) return;

    state.isLoadingMore = true;
    setMobileLoadMoreSpinner(true);
    var startedAt = Date.now();
    /* 조치필요(테스트스피너): 무한 스크롤 스피너 최소 표시 시간 */
    var minSpinnerMs = TEST_SPINNER_DELAY_MS || 360;

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var elapsed = Date.now() - startedAt;
        var delay = Math.max(0, minSpinnerMs - elapsed);
        window.setTimeout(function () {
          state.mobileShown = Math.min(state.mobileShown + PAGE_SIZE, list.length);
          state.isLoadingMore = false;
          setMobileLoadMoreSpinner(false);
          render();
        }, delay);
      });
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

  function onSearchInput() {
    if (!searchInput) return;
    state.searchQuery = searchInput.value;
    state.page = 1;
    state.mobileShown = PAGE_SIZE;
    render();
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

  function ensureSearchTrailingHost() {
    var toolbar = document.querySelector(".ti-np-root .ti-page-toolbar");
    if (!toolbar) return null;
    var trailing = toolbar.querySelector(".ti-page-toolbar__trailing");
    if (!trailing) {
      trailing = document.createElement("div");
      trailing.className = "ti-page-toolbar__trailing";
      var pagerEl = document.getElementById("npPager");
      if (pagerEl) trailing.appendChild(pagerEl);
      toolbar.appendChild(trailing);
    }
    return trailing;
  }

  function setupSearch() {
    if (!SEARCH_ENABLED) {
      if (searchWrap) searchWrap.hidden = true;
      return;
    }
    if (searchWrap) searchWrap.hidden = false;
    if (!searchInput) {
      var trailing = ensureSearchTrailingHost();
      searchWrap = searchWrap || document.getElementById("npSearch");
      if (!searchWrap) {
        searchWrap = document.createElement("div");
        searchWrap.id = "npSearch";
        searchWrap.className = "np-search";
        if (trailing) {
          trailing.insertBefore(searchWrap, trailing.firstChild);
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
  }

  function boot() {
    setupSearch();
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

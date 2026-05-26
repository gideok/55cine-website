/**
 * test/now-playing.html — 현재 상영작 목록 (JSON / API)
 * window.TI_NOW_PLAYING_LIST_CONFIG
 */
(function () {
  var cfg = window.TI_NOW_PLAYING_LIST_CONFIG || {};
  var SITE_BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "";
  var LIST_DATA_URL = cfg.dataUrl || "movies/now-playing/data/now-playing-list.json";

  var PAGE_SIZE = 6;
  var Pager = window.TiPagePager;
  var grid = document.getElementById("npGrid");
  var pager = document.getElementById("npPager");
  var countEl = document.getElementById("npCount");
  var sentinel = document.getElementById("npSentinel");
  var endEl = document.getElementById("npEnd");
  var io = null;
  var state = { page: 1, mobileShown: PAGE_SIZE };
  var movieList = [];

  if (!grid) return;

  function isDesktop() {
    return Pager && Pager.isDesktop();
  }

  function rootPath(u) {
    if (!u) return "";
    if (/^https?:/i.test(u)) return u;
    if (u.startsWith("../")) return u;
    if (u.indexOf("movies/now-playing/") === 0) return u;
    return "../" + u.replace(/^\//, "");
  }

  /** SEO 경로: movies/now-playing/{slug}.html (물리 파일 필요, tools/sync-now-playing-slug-pages.js) */
  function buildDetailUrl(slug) {
    return "movies/now-playing/" + slug + ".html";
  }

  function detailHref(item) {
    if (!item) return "";
    if (item.detailUrl) return rootPath(item.detailUrl);
    if (item.slug) return rootPath(buildDetailUrl(item.slug));
    return "";
  }

  /**
   * 추후 API 연동 시 cfg.fetchList 만 교체.
   * @returns {Promise<Array>}
   */
  function fetchMovieList() {
    if (typeof cfg.fetchList === "function") {
      return Promise.resolve(cfg.fetchList()).then(normalizeListPayload);
    }
    return fetch(LIST_DATA_URL, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("상영작 목록을 불러오지 못했습니다. (" + res.status + ")");
        return res.json();
      })
      .then(normalizeListPayload);
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
        detailUrl: item.detailUrl || (slug ? buildDetailUrl(slug) : "")
      };
    });
  }

  function allMovies() {
    return movieList;
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

  function showListMessage(message, isError) {
    grid.innerHTML = "";
    var p = document.createElement("p");
    p.className = "np-list-status" + (isError ? " is-error" : "");
    p.setAttribute("role", "status");
    p.textContent = message;
    grid.appendChild(p);
    if (countEl) countEl.textContent = "";
    if (Pager) Pager.updateVisibility(pager, 0);
    if (endEl) endEl.classList.remove("is-visible");
  }

  function render() {
    var list = allMovies();
    if (!list.length) {
      showListMessage("표시할 상영작이 없습니다.", false);
      return;
    }

    grid.innerHTML = "";
    sliceForView().forEach(function (m) {
      grid.appendChild(renderCard(m));
    });

    if (isDesktop()) {
      var tp = totalPages(list.length);
      if (countEl) {
        countEl.textContent = Pager.formatMovies(list.length, state.page, tp);
      }
      if (Pager) {
        Pager.render(pager, {
          page: state.page,
          totalPages: tp,
          scrollRootSelector: ".ti-np-scroll",
          onChange: function (p) {
            state.page = p;
            render();
          }
        });
      }
    } else {
      if (Pager) Pager.updateVisibility(pager, 0);
      if (countEl) {
        countEl.textContent =
          "총 " + list.length + "편 · " + Math.min(state.mobileShown, list.length) + "편 표시";
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
          if (isDesktop()) return;
          var list = allMovies();
          if (state.mobileShown >= list.length) return;
          state.mobileShown = Math.min(state.mobileShown + PAGE_SIZE, list.length);
          render();
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
    });
  }

  function boot() {
    showListMessage("상영작 목록을 불러오는 중…", false);

    fetchMovieList()
      .then(function (list) {
        movieList = list;
        state.page = 1;
        state.mobileShown = PAGE_SIZE;
        render();
        setupInfinite();
      })
      .catch(function (err) {
        movieList = [];
        showListMessage(
          (err && err.message) || "상영작 목록을 표시할 수 없습니다.",
          true
        );
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

/**
 * 영화 상세 (현재·예정·지난 상영작 공용)
 * URL: movies/movie-detail.html?slug={slug}&from=now-playing|upcoming|past
 * window.TI_MOVIE_DETAIL_CONFIG
 */
(function () {
  var cfg = window.TI_MOVIE_DETAIL_CONFIG || {};
  var SITE_BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "";
  var PAGE_BASE = cfg.pageBase || "movies/now-playing/data/";
  var CATALOG_SECTIONS = ["now-playing", "upcoming", "past"];
  var BOOKING_URL =
    cfg.bookingUrl ||
    "https://www.dtryx.com/cinema/main.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059";
  var LIST_PAGE_PATHS = {
    "now-playing": "now-playing.html",
    upcoming: "upcoming-playing.html",
    past: "past-playing.html"
  };
  var LIST_LABELS = {
    "now-playing": "현재 상영작 목록",
    upcoming: "상영 예정작 목록",
    past: "지난 상영작 목록"
  };

  var root = document.getElementById("movieDetailRoot");
  var statusEl = document.getElementById("movieDetailStatus");
  var titleEl = document.getElementById("movieDetailPageTitle");

  if (!root) return;

  function resolveAssetUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf("//") === 0) return url;
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(url);
    }
    if (url.charAt(0) === "/") return url;
    return SITE_BASE + url.replace(/^\//, "");
  }

  function getMovieSlug() {
    if (cfg.slug) return String(cfg.slug).trim();
    var meta = document.querySelector('meta[name="ti-movie-slug"]');
    if (meta && meta.getAttribute("content")) return meta.getAttribute("content").trim();
    var params = new URLSearchParams(window.location.search);
    if (params.get("slug")) return params.get("slug").trim();
    var path = (location.pathname || "").replace(/\\/g, "/");
    var file = path.split("/").pop() || "";
    if (file === "movie-detail.html" || file === "movies/now-playing/movie-detail.html") return "";
    if (file.endsWith(".html")) return file.slice(0, -5);
    return "";
  }

  function normalizeCatalogSection(raw) {
    if (!raw) return "";
    var s = String(raw).trim().toLowerCase();
    if (s === "now" || s === "current" || s === "now-playing") return "now-playing";
    if (s === "upcoming" || s === "scheduled") return "upcoming";
    if (s === "past" || s === "archive") return "past";
    return "";
  }

  function getCatalogSection() {
    if (cfg.catalogSection) return normalizeCatalogSection(cfg.catalogSection) || cfg.catalogSection;
    var params = new URLSearchParams(window.location.search);
    var fromQuery =
      normalizeCatalogSection(params.get("from")) ||
      normalizeCatalogSection(params.get("section"));
    if (fromQuery) return fromQuery;
    return "now-playing";
  }

  function buildDataUrl() {
    if (cfg.dataUrl) return cfg.dataUrl;
    return PAGE_BASE + getCatalogSection() + "-movies.json";
  }

  function moviesFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.movies)) return payload.movies;
    return [];
  }

  function fetchMovieCatalog() {
    if (typeof cfg.fetchMovies === "function") {
      return Promise.resolve(cfg.fetchMovies());
    }
    if (cfg.dataUrl) {
      return fetch(resolveAssetUrl(cfg.dataUrl), { credentials: "same-origin" }).then(function (res) {
        if (!res.ok) throw new Error("영화 데이터를 불러오지 못했습니다. (" + res.status + ")");
        return res.json();
      });
    }

    return Promise.all(
      CATALOG_SECTIONS.map(function (section) {
        var url = PAGE_BASE + section + "-movies.json";
        return fetch(resolveAssetUrl(url), { credentials: "same-origin" })
          .then(function (res) {
            if (!res.ok) return [];
            return res.json().then(moviesFromPayload);
          })
          .catch(function () {
            return [];
          });
      })
    ).then(function (chunks) {
      var merged = [];
      var seen = {};
      chunks.forEach(function (list) {
        list.forEach(function (movie) {
          var key = String(movie.slug || "").toLowerCase();
          if (!key || seen[key]) return;
          seen[key] = true;
          merged.push(movie);
        });
      });
      if (!merged.length) {
        throw new Error("영화 데이터를 불러오지 못했습니다.");
      }
      return merged;
    });
  }

  function findMovieBySlug(catalog, slug) {
    var list = Array.isArray(catalog) ? catalog : catalog && catalog.movies;
    if (!Array.isArray(list)) return null;
    var key = String(slug || "").toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].slug || "").toLowerCase() === key) return list[i];
    }
    return null;
  }

  function buildDocumentTitle(movie) {
    if (movie.titleEn) {
      return movie.titleKo + " (" + movie.titleEn + ") — 테스트 UI · 55CINE";
    }
    return (movie.titleKo || "영화 상세") + " — 테스트 UI · 55CINE";
  }

  function createSectionDot() {
    var dot = document.createElement("span");
    dot.className = "md-section-dot";
    dot.setAttribute("aria-hidden", "true");
    return dot;
  }

  function createSectionHead(text) {
    var head = document.createElement("h2");
    head.className = "md-section-head";
    head.appendChild(createSectionDot());
    var label = document.createElement("span");
    label.className = "md-section-head__text";
    label.textContent = text;
    head.appendChild(label);
    return head;
  }

  function createMetaDot() {
    var dot = document.createElement("span");
    dot.className = "md-meta-dot";
    dot.setAttribute("aria-hidden", "true");
    return dot;
  }

  function createMetaRow(label, valueNode) {
    var row = document.createElement("div");
    row.className = "md-meta-row";
    if (label === "출연") row.classList.add("md-meta-row--cast");
    var labelEl = document.createElement("span");
    labelEl.className = "md-meta-label";
    labelEl.textContent = label;
    var valueEl = document.createElement("span");
    valueEl.className = "md-meta-value";
    if (typeof valueNode === "string") {
      valueEl.textContent = valueNode;
    } else {
      valueEl.appendChild(valueNode);
    }
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  }

  function createOverviewValue(movie) {
    var wrap = document.createElement("span");
    wrap.className = "md-meta-value md-meta-value--inline";

    var parts = [];
    if (movie.info) {
      var infoText = String(movie.info).replace(/\s*·\s*$/g, "").trim();
      if (infoText) parts.push(infoText);
    }
    var mins = movie.runningMinutes != null ? Number(movie.runningMinutes) : 0;
    if (mins > 0) parts.push(mins + "분");

    parts.forEach(function (part, index) {
      if (index > 0) wrap.appendChild(createMetaDot());
      var span = document.createElement("span");
      span.textContent = part;
      wrap.appendChild(span);
    });

    if (movie.ratingImage) {
      if (wrap.childNodes.length) wrap.appendChild(createMetaDot());
      var rating = document.createElement("img");
      rating.className = "md-rating-icon";
      rating.src = resolveAssetUrl(movie.ratingImage);
      rating.width = 16;
      rating.height = 16;
      rating.alt = movie.ratingAlt || "";
      rating.decoding = "async";
      wrap.appendChild(rating);
    }

    return wrap;
  }

  function formatScreeningDateLabel(raw) {
    var s = String(raw || "").trim();
    var dotted = s.match(/^(\d{1,2})\.(\d{1,2})\.\(([^)]+)\)$/);
    if (dotted) {
      return parseInt(dotted[1], 10) + "/" + parseInt(dotted[2], 10) + " (" + dotted[3] + ")";
    }
    var slashed = s.match(/^(\d{1,2})\/(\d{1,2})\(([^)]+)\)$/);
    if (slashed) {
      return slashed[1] + "/" + slashed[2] + " (" + slashed[3] + ")";
    }
    return s;
  }

  function createScreeningSlot(screening, bookingUrl, movieTitle) {
    var dateLabel = screening.dateLabel || "";
    var timeLabel = screening.timeLabel || "";
    var href = screening.bookingUrl || bookingUrl;
    var displayDate = formatScreeningDateLabel(dateLabel);
    var aria = movieTitle + " " + displayDate + " " + timeLabel + " 예매";

    var link = document.createElement("a");
    link.className = "md-schedule-slot";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", aria);

    var dateSpan = document.createElement("span");
    dateSpan.className = "md-schedule-slot__date";
    dateSpan.textContent = displayDate;

    var timeSpan = document.createElement("span");
    timeSpan.className = "md-schedule-slot__time";
    timeSpan.textContent = timeLabel;

    link.appendChild(dateSpan);
    link.appendChild(timeSpan);
    return link;
  }

  function createBookingButton(movie, bookingUrl, extraClass) {
    var bookBtn = document.createElement("a");
    bookBtn.className = "md-booking-btn" + (extraClass ? " " + extraClass : "");
    bookBtn.href = bookingUrl;
    bookBtn.target = "_blank";
    bookBtn.rel = "noopener noreferrer";
    bookBtn.setAttribute("aria-label", (movie.titleKo || "") + " 예매하기");
    bookBtn.textContent = "예매하기";
    return bookBtn;
  }

  function bindMovieDetailTabs(slug) {
    var tabSynopsis = document.getElementById("movie-tab-synopsis-" + slug);
    var tabTrailer = document.getElementById("movie-tab-trailer-" + slug);
    var panelSynopsis = document.getElementById("movie-tabpanel-synopsis-" + slug);
    var panelTrailer = document.getElementById("movie-tabpanel-trailer-" + slug);
    if (!tabSynopsis || !panelSynopsis) return;

    function activate(which) {
      var isSynopsis = which === "synopsis";
      tabSynopsis.setAttribute("aria-selected", isSynopsis ? "true" : "false");
      tabSynopsis.classList.toggle("is-active", isSynopsis);
      panelSynopsis.hidden = !isSynopsis;
      if (tabTrailer && panelTrailer) {
        tabTrailer.setAttribute("aria-selected", !isSynopsis ? "true" : "false");
        tabTrailer.classList.toggle("is-active", !isSynopsis);
        tabTrailer.tabIndex = !isSynopsis ? 0 : -1;
        panelTrailer.hidden = isSynopsis;
      }
      tabSynopsis.tabIndex = isSynopsis ? 0 : -1;
    }

    tabSynopsis.addEventListener("click", function () {
      activate("synopsis");
    });
    if (tabTrailer) {
      tabTrailer.addEventListener("click", function () {
        activate("trailer");
      });
    }
  }

  function removeMobileBookingButton() {
    var existing = document.getElementById("mdBookingMobile");
    if (existing) existing.remove();
  }

  function renderMovieDetail(movie) {
    var slug = movie.slug;
    var bookingUrl = movie.bookingUrl || BOOKING_URL;
    var showBooking = getCatalogSection() !== "past";

    document.title = buildDocumentTitle(movie);
    if (titleEl) titleEl.textContent = movie.titleKo || "";

    root.innerHTML = "";
    removeMobileBookingButton();

    var body = document.createElement("div");
    body.className = "md-body";

    var hero = document.createElement("div");
    hero.className = "md-hero";

    var posterWrap = document.createElement("div");
    posterWrap.className = "md-poster-wrap";
    if (movie.poster) {
      var poster = document.createElement("img");
      poster.className = "md-poster movie-detail-poster";
      poster.src = resolveAssetUrl(movie.poster);
      poster.width = 567;
      poster.removeAttribute("height");
      poster.alt = (movie.titleKo || "") + " 포스터";
      poster.decoding = "async";
      posterWrap.appendChild(poster);
    }
    hero.appendChild(posterWrap);

    var infoCol = document.createElement("div");
    infoCol.className = "md-info-col";

    var infoBlock = document.createElement("div");
    infoBlock.className = "md-info-block";
    infoBlock.appendChild(createSectionHead("정보"));

    var metaList = document.createElement("div");
    metaList.className = "md-meta-list";
    if (movie.director) metaList.appendChild(createMetaRow("감독", movie.director));
    if (movie.cast) metaList.appendChild(createMetaRow("출연", movie.cast));
    metaList.appendChild(createMetaRow("개요", createOverviewValue(movie)));
    if (movie.releaseDate) metaList.appendChild(createMetaRow("개봉", movie.releaseDate));
    infoBlock.appendChild(metaList);
    infoCol.appendChild(infoBlock);

    var tabsBlock = document.createElement("div");
    tabsBlock.className = "md-tabs-block";

    var hasTrailer = !!movie.trailerYoutubeId;
    var tabs = document.createElement("div");
    tabs.className = "md-tabs movie-detail-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "영화 정보 탭");

    var tabSynopsis = document.createElement("button");
    tabSynopsis.type = "button";
    tabSynopsis.className = "md-tab movie-detail-tab is-active";
    tabSynopsis.setAttribute("role", "tab");
    tabSynopsis.id = "movie-tab-synopsis-" + slug;
    tabSynopsis.setAttribute("aria-controls", "movie-tabpanel-synopsis-" + slug);
    tabSynopsis.setAttribute("aria-selected", "true");
    tabSynopsis.textContent = "줄거리";
    tabs.appendChild(tabSynopsis);

    if (hasTrailer) {
      var tabTrailer = document.createElement("button");
      tabTrailer.type = "button";
      tabTrailer.className = "md-tab movie-detail-tab";
      tabTrailer.setAttribute("role", "tab");
      tabTrailer.id = "movie-tab-trailer-" + slug;
      tabTrailer.setAttribute("aria-controls", "movie-tabpanel-trailer-" + slug);
      tabTrailer.setAttribute("aria-selected", "false");
      tabTrailer.tabIndex = -1;
      tabTrailer.textContent = "예고편";
      tabs.appendChild(tabTrailer);
    }

    tabsBlock.appendChild(tabs);

    var panelSynopsis = document.createElement("div");
    panelSynopsis.id = "movie-tabpanel-synopsis-" + slug;
    panelSynopsis.className = "md-tabpanel movie-detail-tabpanel";
    panelSynopsis.setAttribute("role", "tabpanel");
    panelSynopsis.setAttribute("aria-labelledby", "movie-tab-synopsis-" + slug);
    var synopsis = document.createElement("p");
    synopsis.className = "md-synopsis movie-detail-synopsis";
    synopsis.textContent = movie.synopsis || "";
    panelSynopsis.appendChild(synopsis);
    tabsBlock.appendChild(panelSynopsis);

    if (hasTrailer) {
      var panelTrailer = document.createElement("div");
      panelTrailer.id = "movie-tabpanel-trailer-" + slug;
      panelTrailer.className = "md-tabpanel movie-detail-tabpanel";
      panelTrailer.setAttribute("role", "tabpanel");
      panelTrailer.setAttribute("aria-labelledby", "movie-tab-trailer-" + slug);
      panelTrailer.hidden = true;

      var frame = document.createElement("div");
      frame.className = "md-trailer-frame movie-detail-trailer-frame";
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube.com/embed/" + movie.trailerYoutubeId;
      iframe.title = "「" + (movie.titleKo || "") + "」 예고편";
      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      );
      iframe.allowFullscreen = true;
      iframe.loading = "lazy";
      frame.appendChild(iframe);
      panelTrailer.appendChild(frame);
      tabsBlock.appendChild(panelTrailer);
    }

    infoCol.appendChild(tabsBlock);

    if (showBooking) {
      infoCol.appendChild(createBookingButton(movie, bookingUrl, "md-booking-btn--inline"));
    }

    hero.appendChild(infoCol);
    body.appendChild(hero);

    var screenings = Array.isArray(movie.screenings) ? movie.screenings : [];
    var schedule = null;
    if (screenings.length) {
      schedule = document.createElement("section");
      schedule.className = "md-schedule";

      var scheduleHead = document.createElement("div");
      scheduleHead.className = "md-schedule-head";
      scheduleHead.appendChild(createSectionHead("상영시간표"));

      // var note = document.createElement("p");
      // note.className = "md-schedule-note ref-note";
      // note.textContent = "오오극장 공식 사이트 기준 · 변경될 수 있습니다.";
      // scheduleHead.appendChild(note);
      schedule.appendChild(scheduleHead);

      var scheduleGrid = document.createElement("div");
      scheduleGrid.className = "md-schedule-grid movie-detail-badge-grid";
      screenings.forEach(function (s) {
        scheduleGrid.appendChild(createScreeningSlot(s, bookingUrl, movie.titleKo || ""));
      });
      schedule.appendChild(scheduleGrid);
      body.appendChild(schedule);
    }

    if (showBooking) {
      var mobileBtn = createBookingButton(movie, bookingUrl, "md-booking-btn--mobile");
      mobileBtn.id = "mdBookingMobile";
      if (schedule) {
        schedule.appendChild(mobileBtn);
      } else {
        body.appendChild(mobileBtn);
      }
    }

    root.appendChild(body);

    bindMovieDetailTabs(slug);
    setStatus("");
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.classList.remove("is-error");
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", !!isError);
  }

  function applyListBackLink() {
    var back = document.getElementById("mdBackLink");
    if (!back) return;
    var section = getCatalogSection();
    var listPath = LIST_PAGE_PATHS[section] || LIST_PAGE_PATHS["now-playing"];
    var params = new URLSearchParams(window.location.search);
    var listPage = params.get("listPage");
    var listQ = params.get("listQ");
    var mobileShown = params.get("mobileShown");
    var returnQs = new URLSearchParams();
    if (listPage) returnQs.set("page", listPage);
    if (listQ) returnQs.set("q", listQ);
    if (mobileShown) returnQs.set("mobileShown", mobileShown);
    var href = listPath;
    var retStr = returnQs.toString();
    if (retStr) href += "?" + retStr;
    back.href = resolveAssetUrl(href);
    var textEl = back.querySelector(".md-back__text");
    if (textEl) {
      textEl.textContent = "목록으로";
    }
    back.setAttribute("aria-label", (LIST_LABELS[section] || LIST_LABELS["now-playing"]) + "으로 돌아가기");
  }

  function boot() {
    applyListBackLink();

    var slug = getMovieSlug();
    if (!slug) {
      setStatus("영화 경로(slug)를 확인할 수 없습니다.", true);
      return;
    }

    setStatus("영화 정보를 불러오는 중…", false);

    var loadPromise;
    if (typeof cfg.fetchMovie === "function") {
      loadPromise = Promise.resolve(cfg.fetchMovie(slug));
    } else {
      loadPromise = fetchMovieCatalog().then(function (catalog) {
        return findMovieBySlug(catalog, slug);
      });
    }

    loadPromise
      .then(function (movie) {
        if (!movie) {
          throw new Error('"' + slug + '" 영화 정보를 찾을 수 없습니다.');
        }
        renderMovieDetail(movie);
      })
      .catch(function (err) {
        root.innerHTML = "";
        removeMobileBookingButton();
        setStatus((err && err.message) || "영화 정보를 표시할 수 없습니다.", true);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

/**
 * 기획전 상세 — JSON 샘플 또는 API 응답으로 렌더
 * window.TI_EXHIBITION_DETAIL_CONFIG
 */
(function () {
  var cfg = window.TI_EXHIBITION_DETAIL_CONFIG || {};
  var BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "";
  var PAGE_BASE = cfg.pageBase || "";
  var LIST_PAGE_URL = cfg.listPageUrl || "../../special-exhibition.html";
  var DETAIL_PAGE_URL = cfg.detailPageUrl || "exhibition_detail.html";
  var indexItems = [];
  var BOOKING_URL =
    cfg.bookingUrl ||
    "https://www.dtryx.com/cinema/main.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059";
  var WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

  var root = document.getElementById("exhibitionDetailRoot");
  var statusEl = document.getElementById("exhibitionDetailStatus");
  var titleEl = document.getElementById("exhibitionDetailPageTitle");
  var posterLightboxEl = null;
  var posterLightboxImg = null;
  var posterLightboxOpen = false;
  var posterLightboxScrollY = 0;

  if (!root) return;

  function normalizeExhibitionThumbPath(path) {
    return String(path).replace(
      /(images\/special\/exhibition\/special_exhibition_thumb_)0+(\d+)(\.png)$/i,
      function (_, prefix, num, ext) {
        var n = parseInt(num, 10);
        var padded = n < 100 ? String(n).padStart(2, "0") : String(n);
        return prefix + padded + ext;
      }
    );
  }

  function resolveSiteSpecialPath(path) {
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(path);
    }
    return BASE + path;
  }

  function resolveAssetUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf("//") === 0) return url;
    if (url.charAt(0) === "/") return url;
    var path = url.replace(/^\//, "");
    path = normalizeExhibitionThumbPath(path);
    /* sp·exhibition 썸네일: 사이트 루트 images/special/… */
    if (path.indexOf("images/special/") === 0) {
      return resolveSiteSpecialPath(path);
    }
    /* 상영작 포스터: special/exhibition/images/… — 페이지 기준 */
    if (path.indexOf("images/") === 0) {
      return PAGE_BASE + path;
    }
    return PAGE_BASE + "images/" + path;
  }

  function getExhibitionId() {
    if (cfg.exhibitionId) return String(cfg.exhibitionId);
    var params = new URLSearchParams(window.location.search);
    return params.get("id") || cfg.defaultExhibitionId || "e000001";
  }

  function buildDataUrl(id) {
    if (cfg.dataUrl) return cfg.dataUrl;
    return PAGE_BASE + "data/exhibition-" + id + ".json";
  }

  /**
   * 추후 API 연동 시 cfg.fetchDetail 만 교체하면 됨.
   * @returns {Promise<object>}
   */
  function fetchExhibitionIndex() {
    if (window.TiApi && typeof window.TiApi.getSpecialList === "function") {
      return window.TiApi.getSpecialList("exhibition").then(function (items) {
        return (items || []).map(function (it) {
          return {
            publicId: it.publicId,
            title: it.title,
            thumbnail: it.thumbnail
          };
        });
      });
    }
    return Promise.resolve([]);
  }

  function resolveListPageUrl(pathWithQuery) {
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(pathWithQuery);
    }
    return BASE + String(pathWithQuery || "").replace(/^\//, "");
  }

  function getListReturnUrl() {
    var base = LIST_PAGE_URL;
    var params = new URLSearchParams(window.location.search);
    var listPage = params.get("listPage");
    if (!listPage) return resolveListPageUrl(base);
    var sep = base.indexOf("?") >= 0 ? "&" : "?";
    return resolveListPageUrl(base + sep + "page=" + encodeURIComponent(listPage));
  }

  function applyListBackLink() {
    var back = document.getElementById("mdBackLink");
    if (!back) return;
    back.href = getListReturnUrl();
    back.setAttribute("aria-label", "기획전 목록으로 돌아가기");
  }

  function detailHref(publicId) {
    var url = DETAIL_PAGE_URL + "?id=" + encodeURIComponent(publicId);
    var params = new URLSearchParams(window.location.search);
    var listPage = params.get("listPage");
    if (listPage) url += "&listPage=" + encodeURIComponent(listPage);
    return url;
  }

  function normalizeNeighbor(item) {
    if (!item) return null;
    var publicId = item.publicId || item.id;
    if (!publicId) return null;
    return {
      publicId: String(publicId),
      title: item.title || "",
      thumbnail: item.thumbnail || ""
    };
  }

  function findNeighbors(publicId) {
    var idx = -1;
    for (var i = 0; i < indexItems.length; i++) {
      if (indexItems[i].publicId === publicId) {
        idx = i;
        break;
      }
    }
    if (idx < 0) {
      return { prev: null, next: null };
    }
    return {
      prev: idx > 0 ? normalizeNeighbor(indexItems[idx - 1]) : null,
      next: idx < indexItems.length - 1 ? normalizeNeighbor(indexItems[idx + 1]) : null
    };
  }

  function renderPrevNext(neighbors) {
    neighbors = neighbors || { prev: null, next: null };
    return window.TiSdPrevNext.render({
      returnNavOnly: true,
      panelNav: true,
      mountContextEl: root,
      navLabel: "기획전 이동",
      colsLabel: "이전·다음 기획전",
      listUrl: getListReturnUrl(),
      listText: "목록으로",
      listAriaLabel: "기획전 목록으로",
      neighbors: {
        prev: normalizeNeighbor(neighbors.prev),
        next: normalizeNeighbor(neighbors.next)
      },
      hrefFor: function (item) {
        return detailHref(item.publicId);
      },
      titleFor: function (item) {
        return item.title || "";
      }
    });
  }

  function fetchExhibitionDetail(id) {
    if (typeof cfg.fetchDetail === "function") {
      return Promise.resolve(cfg.fetchDetail(id));
    }
    if (window.TiApi && typeof window.TiApi.getSpecialDetail === "function") {
      return window.TiApi.getSpecialDetail(id, "exhibition");
    }
    var url = buildDataUrl(id);
    return fetch(url, { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error("기획전 데이터를 불러오지 못했습니다. (" + res.status + ")");
      return res.json();
    });
  }

  function formatScreeningDate(isoDate) {
    if (!isoDate) return "";
    var parts = String(isoDate).split("-");
    if (parts.length !== 3) return isoDate;
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    var date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return isoDate;
    var mm = String(m).padStart(2, "0");
    var dd = String(d).padStart(2, "0");
    return mm + "." + dd + ".(" + WEEKDAY_KO[date.getDay()] + ")";
  }

  function ensurePosterLightbox() {
    if (posterLightboxEl) return posterLightboxEl;

    var lb = document.createElement("div");
    lb.className = "exhibition-poster-lightbox";
    lb.id = "exhibitionPosterLightbox";
    lb.hidden = true;
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "기획전 포스터 크게 보기");

    var backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "exhibition-poster-lightbox__backdrop";
    backdrop.setAttribute("aria-label", "닫기");

    posterLightboxImg = document.createElement("img");
    posterLightboxImg.className = "exhibition-poster-lightbox__img";
    posterLightboxImg.alt = "";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "exhibition-poster-lightbox__close";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.innerHTML = "&times;";

    backdrop.addEventListener("click", closePosterLightbox);
    closeBtn.addEventListener("click", closePosterLightbox);

    lb.appendChild(backdrop);
    lb.appendChild(posterLightboxImg);
    lb.appendChild(closeBtn);
    document.body.appendChild(lb);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && posterLightboxOpen) closePosterLightbox();
    });

    posterLightboxEl = lb;
    return lb;
  }

  function openPosterLightbox(src, alt) {
    ensurePosterLightbox();
    posterLightboxImg.src = src;
    posterLightboxImg.alt = alt || "";
    posterLightboxEl.hidden = false;
    posterLightboxOpen = true;
    posterLightboxScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add("exhibition-poster-lightbox-open");
    document.body.style.top = "-" + posterLightboxScrollY + "px";
    posterLightboxEl.querySelector(".exhibition-poster-lightbox__close").focus();
  }

  function closePosterLightbox() {
    if (!posterLightboxEl || !posterLightboxOpen) return;
    posterLightboxEl.hidden = true;
    posterLightboxOpen = false;
    posterLightboxImg.removeAttribute("src");
    document.body.classList.remove("exhibition-poster-lightbox-open");
    document.body.style.top = "";
    window.scrollTo(0, posterLightboxScrollY);
  }

  function createExhibitionPosterTrigger(src, alt, openLabel) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "exhibition-detail-poster-btn";
    btn.setAttribute("aria-label", openLabel || (alt ? alt + " 크게 보기" : "기획전 포스터 크게 보기"));

    var img = document.createElement("img");
    img.className = "exhibition-detail-poster";
    img.src = src;
    img.alt = alt || "";
    img.decoding = "async";
    img.draggable = false;

    btn.appendChild(img);
    btn.addEventListener("click", function () {
      openPosterLightbox(src, alt);
    });

    return btn;
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

  function getKstDateTimeParts(date) {
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    var map = {};
    fmt.formatToParts(date).forEach(function (part) {
      if (part.type !== "literal") map[part.type] = part.value;
    });
    return map;
  }

  /** 상영 일시가 KST 기준 현재보다 이전이면 true */
  function isScreeningPast(screening) {
    if (!screening || !screening.date) return false;
    var dateStr = String(screening.date).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

    var kst = getKstDateTimeParts(new Date());
    var todayStr = kst.year + "-" + kst.month + "-" + kst.day;
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;

    var timeStr = String(screening.time || "").trim();
    if (!timeStr) return false;

    var tp = timeStr.split(":");
    var sh = Number(tp[0]) || 0;
    var sm = Number(tp[1]) || 0;
    var nh = Number(kst.hour) || 0;
    var nm = Number(kst.minute) || 0;
    return sh * 60 + sm <= nh * 60 + nm;
  }

  function createScreeningBadge(screening, bookingUrl, filmTitle) {
    var dateLabel = formatScreeningDate(screening.date);
    var timeLabel = screening.time || "";
    var gv = !!screening.gv;
    var aria =
      filmTitle +
      " " +
      dateLabel +
      " " +
      timeLabel +
      (gv ? " GV" : "") +
      " 예매";

    var past = isScreeningPast(screening);
    var badge = document.createElement(past ? "span" : "a");
    badge.className = "exhibition-detail-time-badge" + (past ? " is-past" : "");
    if (!past) {
      badge.href = bookingUrl;
      badge.target = "_blank";
      badge.rel = "noopener noreferrer";
    } else {
      badge.setAttribute("aria-disabled", "true");
    }
    badge.setAttribute("aria-label", aria + (past ? " (종료)" : ""));

    var dateRow = document.createElement("span");
    dateRow.className = "badge-date-row";

    var dateSpan = document.createElement("span");
    dateSpan.className = "badge-date";
    dateSpan.textContent = dateLabel;
    dateRow.appendChild(dateSpan);

    if (gv) {
      var gvSpan = document.createElement("span");
      gvSpan.className = "badge-gv";
      gvSpan.textContent = "GV";
      dateRow.appendChild(gvSpan);
    }

    var timeSpan = document.createElement("span");
    timeSpan.className = "badge-time";
    timeSpan.textContent = timeLabel;

    badge.appendChild(dateRow);
    badge.appendChild(timeSpan);
    return badge;
  }

  function createFilmSection(film, bookingUrl) {
    var section = document.createElement("section");
    section.className = "exhibition-detail-section exhibition-detail-film";

    if (film && film.title === "EmptyFilms") {
      section.className += " exhibition-film-empty";
      var emptyInner = document.createElement("div");
      emptyInner.className = "exhibition-detail-section__inner exhibition-detail-section__inner--empty-film";
      section.appendChild(emptyInner);
      return section;
    }

    var inner = document.createElement("div");
    inner.className = "exhibition-detail-section__inner";

    var head = document.createElement("div");
    head.className = "exhibition-film-head";

    var titleRow = document.createElement("div");
    titleRow.className = "exhibition-film-head-row";

    var title = document.createElement("h3");
    title.className = "exhibition-film-title";
    title.textContent = film.title || "";
    titleRow.appendChild(title);

    var rawSectionName = typeof film.sectionname === "string" ? film.sectionname : "";
    var trimmedSectionName = rawSectionName.trim();
    if (trimmedSectionName) {
      var badge = document.createElement("span");
      badge.className = "exhibition-film-section-badge";

      var lines = trimmedSectionName.split(/\n+/).slice(0, 2);
      lines.forEach(function (line, idx) {
        badge.appendChild(document.createTextNode(line));
        if (idx < lines.length - 1) {
          badge.appendChild(document.createElement("br"));
        }
      });

      titleRow.appendChild(badge);
    }

    head.appendChild(titleRow);

    var info = document.createElement("p");
    info.className = "exhibition-film-info";
    info.textContent = film.info || "";

    if (film.info) head.appendChild(info);

    if (film.image) {
      var img = document.createElement("img");
      img.className = "exhibition-film-poster";
      img.src = resolveAssetUrl(film.image);
      img.alt = (film.title || "") + " 포스터";
      img.loading = "lazy";
      img.decoding = "async";
      inner.appendChild(head);
      inner.appendChild(img);
    } else {
      inner.appendChild(head);
    }

    var meta = document.createElement("dl");
    meta.className = "exhibition-film-meta";

    if (film.director) {
      var dirRow = document.createElement("div");
      dirRow.className = "meta-block";
      var dirDt = document.createElement("dt");
      dirDt.textContent = "감독:";
      var dirDd = document.createElement("dd");
      dirDd.textContent = film.director;
      dirRow.appendChild(dirDt);
      dirRow.appendChild(dirDd);
      meta.appendChild(dirRow);
    }

    if (film.cast) {
      var castRow = document.createElement("div");
      castRow.className = "meta-block";
      var castDt = document.createElement("dt");
      castDt.textContent = "출연:";
      var castDd = document.createElement("dd");
      castDd.textContent = film.cast;
      castRow.appendChild(castDt);
      castRow.appendChild(castDd);
      meta.appendChild(castRow);
    }

    inner.appendChild(meta);

    if (film.description) {
      var desc = document.createElement("p");
      desc.className = "exhibition-film-description";
      desc.textContent = film.description;
      inner.appendChild(desc);
    }

    var screenings = Array.isArray(film.screenings) ? film.screenings : [];
    if (screenings.length) {
      var schedTitle = document.createElement("h4");
      schedTitle.className = "exhibition-film-schedule-title";
      schedTitle.textContent = "상영시간";
      inner.appendChild(schedTitle);

      var badgeGrid = document.createElement("div");
      badgeGrid.className = "exhibition-detail-badge-grid";
      screenings.forEach(function (s) {
        badgeGrid.appendChild(createScreeningBadge(s, bookingUrl, film.title || ""));
      });
      inner.appendChild(badgeGrid);
    }

    section.appendChild(inner);
    return section;
  }

  function renderExhibitionDetail(data) {
    if (!data) return;

    var bookingUrl = data.bookingUrl || BOOKING_URL;
    var pageTitle = data.title || "기획전 상세";

    document.title = pageTitle + " — 테스트 UI · 55CINE";
    if (titleEl) titleEl.textContent = pageTitle;

    root.innerHTML = "";

    var grid = document.createElement("div");
    grid.className = "exhibition-detail-grid";

    var hero = document.createElement("section");
    hero.className = "exhibition-detail-section exhibition-detail-section--hero";
    var heroInner = document.createElement("div");
    heroInner.className = "exhibition-detail-section__inner";
    if (data.image) {
      var posterSrc = resolveAssetUrl(data.image);
      heroInner.appendChild(
        createExhibitionPosterTrigger(posterSrc, pageTitle + " 포스터", pageTitle + " 포스터 크게 보기")
      );
    }
    hero.appendChild(heroInner);
    grid.appendChild(hero);

    var infoSec = document.createElement("section");
    infoSec.className = "exhibition-detail-section exhibition-detail-section--info";
    var infoInner = document.createElement("div");
    infoInner.className = "exhibition-detail-section__inner";

    var lead = document.createElement("div");
    lead.className = "exhibition-detail-info-lead";

    if (data.introduction) {
      var intro = document.createElement("p");
      intro.className = "exhibition-detail-intro";
      intro.textContent = data.introduction;
      lead.appendChild(intro);
    }

    var bookBtn = document.createElement("a");
    bookBtn.className = "md-booking-btn md-booking-btn--inline";
    bookBtn.href = bookingUrl;
    bookBtn.target = "_blank";
    bookBtn.rel = "noopener noreferrer";
    bookBtn.setAttribute("aria-label", pageTitle + " 예매하기");
    bookBtn.textContent = "예매하기";
    lead.appendChild(bookBtn);

    infoInner.appendChild(lead);

    infoSec.appendChild(infoInner);
    grid.appendChild(infoSec);

    var films = Array.isArray(data.films) ? data.films : [];
    if (films.length) {
      var filmsWrap = document.createElement("div");
      filmsWrap.className = "exhibition-detail-films";
      films.forEach(function (film) {
        filmsWrap.appendChild(createFilmSection(film, bookingUrl));
      });
      grid.appendChild(filmsWrap);
    }

    root.appendChild(grid);

    var neighbors = data.neighbors
      ? {
          prev: normalizeNeighbor(data.neighbors.prev),
          next: normalizeNeighbor(data.neighbors.next)
        }
      : findNeighbors(data.id);
    renderPrevNext(neighbors);

    setStatus("");

    root.querySelectorAll(".exhibition-film-poster, .exhibition-detail-poster").forEach(function (img) {
      if (img.complete) return;
      img.addEventListener("load", scheduleEqualizeFilmRows, { once: true });
    });

    scheduleEqualizeFilmRows();
  }

  function equalizeFilmRowHeights() {
    var filmsWrap = document.querySelector(".exhibition-detail-films");
    if (!filmsWrap) return;

    var films = filmsWrap.querySelectorAll(".exhibition-detail-film");
    var rowSelectors = [
      ".exhibition-film-head",
      ".exhibition-film-poster",
      ".exhibition-film-meta",
      ".exhibition-film-description",
      ".exhibition-film-schedule-title",
      ".exhibition-detail-badge-grid"
    ];

    films.forEach(function (film) {
      rowSelectors.forEach(function (sel) {
        var el = film.querySelector(sel);
        if (el) el.style.minHeight = "";
      });
    });

    if (window.matchMedia("(max-width: 900px)").matches) return;

    for (var i = 0; i < films.length; i += 2) {
      var pair = [];
      if (films[i]) pair.push(films[i]);
      if (films[i + 1]) pair.push(films[i + 1]);
      if (pair.length < 2) continue;

      rowSelectors.forEach(function (sel) {
        var maxH = 0;
        var nodes = [];

        pair.forEach(function (film) {
          var el = film.querySelector(sel);
          if (!el) return;
          nodes.push(el);
          maxH = Math.max(maxH, el.getBoundingClientRect().height);
        });

        if (!maxH || nodes.length < 2) return;

        nodes.forEach(function (el) {
          el.style.minHeight = Math.ceil(maxH) + "px";
        });
      });
    }
  }

  var equalizeTimer;

  function scheduleEqualizeFilmRows() {
    clearTimeout(equalizeTimer);
    equalizeTimer = window.setTimeout(function () {
      window.requestAnimationFrame(equalizeFilmRowHeights);
    }, 48);
  }

  window.addEventListener("resize", scheduleEqualizeFilmRows, { passive: true });
  window.addEventListener("ti-shell:relayout", scheduleEqualizeFilmRows, { passive: true });

  function boot() {
    applyListBackLink();
    var id = getExhibitionId();
    setStatus("기획전 정보를 불러오는 중…", false);

    Promise.all([
      fetchExhibitionIndex().catch(function () {
        return [];
      }),
      fetchExhibitionDetail(id)
    ])
      .then(function (results) {
        indexItems = results[0] || [];
        renderExhibitionDetail(results[1]);
      })
      .catch(function (err) {
        root.innerHTML = "";
        setStatus(
          (err && err.message) || "기획전 정보를 표시할 수 없습니다.",
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

/**
 * 기획전 상세 — JSON 샘플 또는 API 응답으로 렌더
 * window.TI_EXHIBITION_DETAIL_CONFIG
 */
(function () {
  var cfg = window.TI_EXHIBITION_DETAIL_CONFIG || {};
  var BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "";
  var PAGE_BASE = cfg.pageBase || "";
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

  function resolveAssetUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf("//") === 0) return url;
    if (url.charAt(0) === "/") return url;
    return PAGE_BASE + url.replace(/^\//, "");
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
  function fetchExhibitionDetail(id) {
    if (typeof cfg.fetchDetail === "function") {
      return Promise.resolve(cfg.fetchDetail(id));
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

    var link = document.createElement("a");
    link.className = "exhibition-detail-time-badge";
    link.href = bookingUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", aria);

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

    link.appendChild(dateRow);
    link.appendChild(timeSpan);
    return link;
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

    if (data.introduction) {
      var intro = document.createElement("p");
      intro.className = "exhibition-detail-intro";
      intro.textContent = data.introduction;
      infoInner.appendChild(intro);
    }

    var bookBtn = document.createElement("a");
    bookBtn.className = "md2-booking-btn";
    bookBtn.href = bookingUrl;
    bookBtn.target = "_blank";
    bookBtn.rel = "noopener noreferrer";
    bookBtn.setAttribute("aria-label", pageTitle + " 예매하기");
    bookBtn.textContent = "예매하기";
    infoInner.appendChild(bookBtn);

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
    var id = getExhibitionId();
    setStatus("기획전 정보를 불러오는 중…", false);

    fetchExhibitionDetail(id)
      .then(function (data) {
        renderExhibitionDetail(data);
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

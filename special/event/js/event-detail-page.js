/**
 * 행사 상세 — JSON 샘플 또는 API 응답으로 렌더 (films 없음)
 * window.TI_EVENT_DETAIL_CONFIG
 */
(function () {
  var cfg = window.TI_EVENT_DETAIL_CONFIG || {};
  var BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "";
  var PAGE_BASE = cfg.pageBase || "";
  var LIST_PAGE_URL = cfg.listPageUrl || "../../special-event.html";
  var BOOKING_URL =
    cfg.bookingUrl ||
    "https://www.dtryx.com/cinema/main.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059";

  var root = document.getElementById("eventDetailRoot");
  var statusEl = document.getElementById("eventDetailStatus");
  var titleEl = document.getElementById("eventDetailPageTitle");

  if (!root) return;

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
    if (path.indexOf("images/special/") === 0) {
      return resolveSiteSpecialPath(path);
    }
    if (path.indexOf("images/") === 0) {
      return PAGE_BASE + path;
    }
    return PAGE_BASE + "images/" + path;
  }

  function resolveListPageUrl(pathWithQuery) {
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(pathWithQuery);
    }
    return BASE + String(pathWithQuery || "").replace(/^\//, "");
  }

  function getEventId() {
    if (cfg.eventId) return String(cfg.eventId);
    var params = new URLSearchParams(window.location.search);
    return params.get("id") || cfg.defaultEventId || "ev000001";
  }

  function buildDataUrl(id) {
    if (cfg.dataUrl) return cfg.dataUrl;
    return PAGE_BASE + "data/event-" + id + ".json";
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
    var base = LIST_PAGE_URL;
    var params = new URLSearchParams(window.location.search);
    var listPage = params.get("listPage");
    if (listPage) {
      var sep = base.indexOf("?") >= 0 ? "&" : "?";
      back.href = resolveListPageUrl(base + sep + "page=" + encodeURIComponent(listPage));
    } else {
      back.href = resolveListPageUrl(base);
    }
    back.setAttribute("aria-label", "행사 목록으로 돌아가기");
  }

  function fetchEventDetail(id) {
    if (typeof cfg.fetchDetail === "function") {
      return Promise.resolve(cfg.fetchDetail(id));
    }
    if (window.TiApi && typeof window.TiApi.getSpecialDetail === "function") {
      return window.TiApi.getSpecialDetail(id, "event");
    }
    var url = buildDataUrl(id);
    return fetch(url, { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error("행사 데이터를 불러오지 못했습니다. (" + res.status + ")");
      return res.json();
    });
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

  function createBookingButton(pageTitle, bookingUrl, extraClass) {
    var bookBtn = document.createElement("a");
    bookBtn.className = "md-booking-btn" + (extraClass ? " " + extraClass : "");
    bookBtn.href = bookingUrl;
    bookBtn.target = "_blank";
    bookBtn.rel = "noopener noreferrer";
    bookBtn.setAttribute("aria-label", pageTitle + " 예매하기");
    bookBtn.textContent = "예매하기";
    return bookBtn;
  }

  function render(data) {
    root.innerHTML = "";

    var pageTitle = data && data.title ? String(data.title) : "행사 상세";
    if (titleEl) titleEl.textContent = pageTitle;
    document.title = pageTitle + " — 행사 상세 · 55CINE";

    var bookingUrl = (data && data.bookingUrl) || BOOKING_URL;

    var body = document.createElement("div");
    body.className = "md-body";

    var hero = document.createElement("div");
    hero.className = "md-hero";

    var posterWrap = document.createElement("div");
    posterWrap.className = "md-poster-wrap";
    if (data && data.image) {
      var img = document.createElement("img");
      img.className = "md-poster movie-detail-poster";
      img.src = resolveAssetUrl(data.image);
      img.width = 567;
      img.removeAttribute("height");
      img.alt = pageTitle + " 포스터";
      img.decoding = "async";
      posterWrap.appendChild(img);
    }
    hero.appendChild(posterWrap);

    var infoCol = document.createElement("div");
    infoCol.className = "md-info-col";

    var infoBlock = document.createElement("div");
    infoBlock.className = "md-info-block";
    infoBlock.appendChild(createSectionHead("소개"));

    if (data && data.introduction) {
      var intro = document.createElement("p");
      intro.className = "md-synopsis";
      intro.textContent = data.introduction;
      infoBlock.appendChild(intro);
    }

    infoCol.appendChild(infoBlock);
    infoCol.appendChild(createBookingButton(pageTitle, bookingUrl, "md-booking-btn--inline"));
    hero.appendChild(infoCol);

    body.appendChild(hero);
    body.appendChild(createBookingButton(pageTitle, bookingUrl, "md-booking-btn--mobile"));
    root.appendChild(body);
    setStatus("");
    if (window.TiAnalytics && typeof window.TiAnalytics.pageview === "function") {
      window.TiAnalytics.pageview({ pageKey: String(data.id || "") });
    }
  }

  function boot() {
    applyListBackLink();
    var id = getEventId();
    setStatus("행사 데이터를 불러오는 중…");
    fetchEventDetail(id)
      .then(function (data) {
        render(data || {});
      })
      .catch(function (err) {
        console.error(err);
        setStatus(err && err.message ? err.message : "행사 데이터를 불러오지 못했습니다.", true);
      });
  }

  boot();
})();

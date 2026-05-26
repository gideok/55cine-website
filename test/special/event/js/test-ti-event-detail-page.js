/**
 * 행사 상세 — JSON 샘플 또는 API 응답으로 렌더 (films 없음)
 * window.TEST_TI_EVENT_DETAIL_CONFIG
 */
(function () {
  var cfg = window.TEST_TI_EVENT_DETAIL_CONFIG || {};
  var PAGE_BASE = cfg.pageBase || "";
  var BOOKING_URL =
    cfg.bookingUrl ||
    "https://www.dtryx.com/cinema/main.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059";

  var root = document.getElementById("eventDetailRoot");
  var statusEl = document.getElementById("eventDetailStatus");
  var titleEl = document.getElementById("eventDetailPageTitle");

  if (!root) return;

  function resolveAssetUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf("//") === 0) return url;
    if (url.charAt(0) === "/") return url;
    return PAGE_BASE + url.replace(/^\//, "");
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

  function fetchEventDetail(id) {
    if (typeof cfg.fetchDetail === "function") {
      return Promise.resolve(cfg.fetchDetail(id));
    }
    var url = buildDataUrl(id);
    return fetch(url, { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error("행사 데이터를 불러오지 못했습니다. (" + res.status + ")");
      return res.json();
    });
  }

  function render(data) {
    root.innerHTML = "";
    var grid = document.createElement("div");
    grid.className = "exhibition-detail-grid";

    var pageTitle = data && data.title ? String(data.title) : "행사 상세";
    if (titleEl) titleEl.textContent = pageTitle;
    document.title = pageTitle + " — 행사 상세 · 55CINE";

    var bookingUrl = (data && data.bookingUrl) || BOOKING_URL;

    var heroSec = document.createElement("section");
    heroSec.className = "exhibition-detail-section exhibition-detail-section--hero";
    var heroInner = document.createElement("div");
    heroInner.className = "exhibition-detail-section__inner";

    if (data && data.image) {
      var img = document.createElement("img");
      img.className = "exhibition-detail-poster";
      img.src = resolveAssetUrl(data.image);
      img.alt = pageTitle + " 포스터";
      img.decoding = "async";
      heroInner.appendChild(img);
    }

    heroSec.appendChild(heroInner);
    grid.appendChild(heroSec);

    var infoSec = document.createElement("section");
    infoSec.className = "exhibition-detail-section exhibition-detail-section--info";
    var infoInner = document.createElement("div");
    infoInner.className = "exhibition-detail-section__inner";

    if (data && data.introduction) {
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

    root.appendChild(grid);
    setStatus("");
  }

  function boot() {
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


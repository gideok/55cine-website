/**
 * 현재상영작 상세 — 고양이 보물찾기 이벤트
 * 설정: data/cat-treasure-event.json
 * API: GET/POST /api/v1/events/cat-treasure
 */
(function (global) {
  var STORAGE_KEY = "ti_cat_treasure_won_v1";
  var CAT_IMAGES = [
    "images/events/cat-treasure/cat-1.png",
    "images/events/cat-treasure/cat-2.png",
    "images/events/cat-treasure/cat-3.png"
  ];
  var WIN_IMAGE = "images/events/cat-treasure/win-popup.png";

  function resolveAssetUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(url);
    }
    var base = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "";
    return base + String(url).replace(/^\//, "");
  }

  function apiBase() {
    if (typeof global.TiResolveApiBase === "function") {
      return global.TiResolveApiBase();
    }
    if (typeof global.TI_API_BASE === "string" && global.TI_API_BASE) {
      return global.TI_API_BASE;
    }
    return "/api/v1";
  }

  function alreadyWonLocally() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_e) {
      return false;
    }
  }

  function markWonLocally() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (_e) {
      /* ignore */
    }
  }

  function isPageReload() {
    try {
      if (typeof performance !== "undefined" && performance.getEntriesByType) {
        var nav = performance.getEntriesByType("navigation")[0];
        if (nav && nav.type === "reload") return true;
      }
      // legacy
      if (performance.navigation && performance.navigation.type === 1) return true;
    } catch (_e) {
      /* ignore */
    }
    return false;
  }

  function parseStartAt(raw) {
    var s = String(raw || "").trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(s);
    if (!m) return null;
    var d = new Date(m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":00+09:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function statusFromConfig(cfg) {
    var total = Math.max(0, Math.floor(Number(cfg.totalWinners) || 0));
    var current = Math.max(0, Math.floor(Number(cfg.currentWinners) || 0));
    var remaining = Math.max(0, total - current);
    var start = parseStartAt(cfg.startAt);
    var now = Date.now();
    var active =
      cfg.enabled !== false &&
      !!start &&
      now >= start.getTime() &&
      remaining > 0 &&
      Number(cfg.appearProbability) > 0;
    return {
      active: active,
      startAt: cfg.startAt,
      appearProbability: Number(cfg.appearProbability) || 0,
      totalWinners: total,
      currentWinners: current,
      remainingWinners: remaining,
      fadeMs: Math.max(1000, Number(cfg.fadeMs) || 5000),
      preventSameBrowserReWin: cfg.preventSameBrowserReWin !== false,
      blockOnPageRefresh: cfg.blockOnPageRefresh === true
    };
  }

  function fetchStatusFromStatic() {
    return fetch(resolveAssetUrl("data/cat-treasure-event.json"), { cache: "no-store" }).then(
      function (res) {
        if (!res.ok) throw new Error("event config fetch failed");
        return res.json().then(statusFromConfig);
      }
    );
  }

  function fetchStatus() {
    var apiPromise;
    if (global.TiApi && typeof global.TiApi.apiGet === "function") {
      apiPromise = global.TiApi.apiGet("/events/cat-treasure");
    } else {
      apiPromise = fetch(apiBase() + "/events/cat-treasure", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store"
      }).then(function (res) {
        if (!res.ok) throw new Error("event api " + res.status);
        return res.json();
      });
    }
    return apiPromise.catch(function () {
      return fetchStatusFromStatic();
    });
  }

  function claimWin() {
    return fetch(apiBase() + "/events/cat-treasure/claim", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "same-origin",
      body: "{}"
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          var msg =
            (body && body.error && body.error.message) ||
            "당첨 처리에 실패했습니다.";
          var err = new Error(msg);
          err.code = body && body.error && body.error.code;
          throw err;
        }
        return body;
      });
    });
  }

  function showWinPopup() {
    if (document.getElementById("catTreasureWinModal")) return;

    var overlay = document.createElement("div");
    overlay.id = "catTreasureWinModal";
    overlay.className = "cat-treasure-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "이벤트 당첨");

    var panel = document.createElement("div");
    panel.className = "cat-treasure-modal__panel";

    var img = document.createElement("img");
    img.className = "cat-treasure-modal__img";
    img.src = resolveAssetUrl(WIN_IMAGE);
    img.alt =
      "당첨! 당첨 화면을 캡처해 오오극장 인스타그램 DM 또는 이메일로 보내주세요.";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "cat-treasure-modal__close";
    closeBtn.setAttribute("aria-label", "닫기");
    closeBtn.textContent = "×";

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }

    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", onKey);

    panel.appendChild(closeBtn);
    panel.appendChild(img);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  function pickCatSrc() {
    return CAT_IMAGES[Math.floor(Math.random() * CAT_IMAGES.length)];
  }

  function mountCat(posterWrap, fadeMs, options) {
    options = options || {};
    posterWrap.classList.add("md-poster-wrap--cat-treasure");

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-treasure-hit";
    btn.setAttribute("aria-label", "숨은 고양이 이벤트");
    btn.style.setProperty("--cat-treasure-fade-ms", String(fadeMs) + "ms");
    btn.style.left = 18 + Math.random() * 64 + "%";
    btn._catTreasurePreventReWin = options.preventSameBrowserReWin === true;

    var catSrc = pickCatSrc();
    var img = document.createElement("img");
    img.className = "cat-treasure-hit__img";
    if (/cat-2\.png(?:\?|$)/i.test(catSrc)) {
      img.classList.add("cat-treasure-hit__img--lg");
      btn.classList.add("cat-treasure-hit--cat2");
    }
    img.src = resolveAssetUrl(catSrc);
    img.alt = "";
    img.draggable = false;
    btn.appendChild(img);

    var claimed = false;
    var removed = false;

    function cleanup() {
      if (removed) return;
      removed = true;
      btn.remove();
    }

    btn.addEventListener("animationend", function (e) {
      if (e.animationName === "cat-treasure-fade") cleanup();
    });

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (claimed || removed) return;
      claimed = true;
      btn.classList.add("is-claimed");
      btn.disabled = true;

      claimWin()
        .then(function () {
          if (btn._catTreasurePreventReWin) markWonLocally();
          cleanup();
          showWinPopup();
        })
        .catch(function (err) {
          claimed = false;
          btn.classList.remove("is-claimed");
          btn.disabled = false;
          if (err && err.code === "SOLD_OUT") {
            cleanup();
            window.alert(err.message || "이벤트가 종료되었습니다.");
            return;
          }
          window.alert(
            (err && err.message) || "당첨 처리에 실패했습니다. 잠시 후 다시 시도해 주세요."
          );
        });
    });

    posterWrap.appendChild(btn);
    window.setTimeout(cleanup, fadeMs + 80);
  }

  function tryStart(posterWrap) {
    if (!posterWrap) return;

    fetchStatus()
      .then(function (status) {
        if (!status || !status.active) return;

        var preventReWin = status.preventSameBrowserReWin !== false;
        if (preventReWin && alreadyWonLocally()) return;

        if (status.blockOnPageRefresh === true && isPageReload()) return;

        var p = Number(status.appearProbability) || 0;
        if (p <= 0 || Math.random() > p) return;
        var fadeMs = Math.max(1000, Number(status.fadeMs) || 5000);
        mountCat(posterWrap, fadeMs, { preventSameBrowserReWin: preventReWin });
      })
      .catch(function () {
        /* 이벤트 실패는 상세 페이지를 막지 않음 */
      });
  }

  global.TiCatTreasureEvent = {
    tryStart: tryStart,
    showWinPopup: showWinPopup
  };
})(typeof window !== "undefined" ? window : globalThis);

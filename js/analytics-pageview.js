/**
 * 공개 페이지 페이지뷰 수집 (MSSQL 비사용 · SQLite API)
 * 자동: 로드 시 1회. 동적 상세: TiAnalytics.pageview({ pageKey })
 */
(function (global) {
  var sentKeys = {};
  var AUTO_FLAG = "data-ti-analytics-auto";

  function apiBase() {
    if (typeof global.TiResolveApiBase === "function") {
      return global.TiResolveApiBase();
    }
    if (typeof global.TI_API_BASE === "string" && global.TI_API_BASE) {
      return global.TI_API_BASE;
    }
    return "/api/v1";
  }

  function currentPath() {
    var path = (global.location && global.location.pathname) || "/";
    var search = (global.location && global.location.search) || "";
    // site root prefix 제거는 서버 normalize 에서도 처리. 여기선 pathname+의미있는 query만
    var params = new URLSearchParams(search);
    var keep = [];
    ["slug", "id", "from", "section"].forEach(function (k) {
      var v = params.get(k);
      if (v) keep.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    });
    return path + (keep.length ? "?" + keep.join("&") : "");
  }

  function inferPageKey() {
    var params = new URLSearchParams((global.location && global.location.search) || "");
    return params.get("slug") || params.get("id") || "";
  }

  function isAdminPath() {
    var path = ((global.location && global.location.pathname) || "").toLowerCase();
    return path.indexOf("/admin/") !== -1 || /\/admin\.html$/i.test(path);
  }

  function postPageview(payload) {
    var url = apiBase().replace(/\/$/, "") + "/analytics/pageview";
    var body = JSON.stringify({
      path: payload.path,
      pageKey: payload.pageKey || undefined
    });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return Promise.resolve({ ok: true });
      }
    } catch (_e) {
      /* fall through */
    }
    return fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: body,
      keepalive: true
    }).then(
      function () {
        return { ok: true };
      },
      function () {
        return { ok: false };
      }
    );
  }

  function pageview(opts) {
    if (isAdminPath()) return Promise.resolve({ ok: false, skipped: true });
    opts = opts || {};
    var path = opts.path || currentPath();
    var pageKey = opts.pageKey != null ? String(opts.pageKey) : inferPageKey();
    var key = path + "\0" + pageKey;
    if (!opts.force && sentKeys[key]) {
      return Promise.resolve({ ok: true, deduped: true });
    }
    sentKeys[key] = true;
    return postPageview({ path: path, pageKey: pageKey });
  }

  function autoTrack() {
    if (isAdminPath()) return;
    if (document.documentElement.getAttribute(AUTO_FLAG) === "1") return;
    if (global.__TI_ANALYTICS_MANUAL__) return;
    document.documentElement.setAttribute(AUTO_FLAG, "1");
    pageview({});
  }

  global.TiAnalytics = {
    pageview: pageview,
    autoTrack: autoTrack
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoTrack, { once: true });
  } else {
    autoTrack();
  }
})(typeof window !== "undefined" ? window : globalThis);

/**
 * 매거진 GV 모먼트 상세 — JSON / API 공통
 * window.TI_MAGAZINE_GV_MOMENT_DETAIL_CONFIG
 */
(function () {
  var cfg = window.TI_MAGAZINE_GV_MOMENT_DETAIL_CONFIG || {};
  var BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "../";
  var DATA_BASE = cfg.dataBase || "magazine/gv-moment/data/";
  var LIST_URL = cfg.listPageUrl || "../gv-moment.html";
  var INDEX_URL = cfg.indexUrl || DATA_BASE + "index.json";

  var root = document.getElementById("gvMomentDetailRoot");
  var statusEl = document.getElementById("gvMomentDetailStatus");
  var titleEl = document.getElementById("gvMomentDetailPageTitle");
  var backLink = document.getElementById("mdBackLink");
  var indexItems = [];
  var imageCacheKey = "";

  if (!root) return;

  function applyBackLink() {
    if (!backLink) return;
    backLink.href = LIST_URL;
    backLink.setAttribute("aria-label", "GV 모먼트 목록으로 돌아가기");
  }

  function prepareBodyHtml(html) {
    if (window.TiMagazineBodyHtml && typeof window.TiMagazineBodyHtml.prepare === "function") {
      return window.TiMagazineBodyHtml.prepare(html);
    }
    return (html || "")
      .replace(/\r\n/g, "\n")
      .replace(/\.\.\/\.\.\/images\//g, "images/")
      .replace(/\.\.\/images\//g, "images/")
      .replace(/\s+onerror="[^"]*"/gi, "")
      .replace(/\s+srcset="[^"]*"/gi, "");
  }

  function resolveAssetUrl(url) {
    if (window.TiMagazineAsset && typeof window.TiMagazineAsset.resolve === "function") {
      return window.TiMagazineAsset.resolve(url, { base: BASE, cacheKey: imageCacheKey });
    }
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf("//") === 0) return "https:" + url;
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(url);
    }
    if (url.charAt(0) === "/") return url;
    return BASE + url.replace(/^\//, "");
  }

  function normalizeArticleId(raw) {
    if (!raw) return "";
    return String(raw).trim();
  }

  function getArticleId() {
    if (cfg.articleId) return normalizeArticleId(cfg.articleId);
    var params = new URLSearchParams(window.location.search);
    return normalizeArticleId(params.get("id") || params.get("slug") || "");
  }

  function buildDataUrl(id) {
    if (cfg.dataUrl) return cfg.dataUrl;
    return DATA_BASE + id + ".json";
  }

  function fetchArticle(id) {
    if (typeof cfg.fetchArticle === "function") {
      return Promise.resolve(cfg.fetchArticle(id));
    }
    if (window.TiApi && typeof window.TiApi.getMagazineDetail === "function") {
      return window.TiApi.getMagazineDetail(id);
    }
    return fetch(buildDataUrl(id), { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) throw new Error("GV 모먼트를 불러오지 못했습니다. (" + res.status + ")");
      return res.json();
    });
  }

  function fetchIndex() {
    if (typeof cfg.fetchIndex === "function") {
      return Promise.resolve(cfg.fetchIndex());
    }
    return fetch(INDEX_URL, { credentials: "same-origin" }).then(function (res) {
      if (!res.ok) return [];
      return res.json().then(function (data) {
        return (data && data.items) || [];
      });
    });
  }

  function detailHref(id) {
    var base = cfg.detailPageUrl || "article-detail.html";
    return base + "?id=" + encodeURIComponent(id);
  }

  function findNeighbors(id) {
    var idx = -1;
    for (var i = 0; i < indexItems.length; i++) {
      if (indexItems[i].id === id) {
        idx = i;
        break;
      }
    }
    return {
      prev: idx > 0 ? indexItems[idx - 1] : null,
      next: idx >= 0 && idx < indexItems.length - 1 ? indexItems[idx + 1] : null
    };
  }

  function renderPrevNext(neighbors) {
    return window.TiSdPrevNext.render({
      returnNavOnly: true,
      panelNav: true,
      mountContextEl: root,
      navLabel: "GV 모먼트 이동",
      colsLabel: "이전·다음 GV 모먼트",
      listUrl: LIST_URL,
      listText: "목록으로",
      listAriaLabel: "GV 모먼트 목록으로",
      neighbors: neighbors || { prev: null, next: null },
      hrefFor: function (item) {
        return detailHref(item.id);
      },
      titleFor: function (item) {
        return item.title || "";
      }
    });
  }

  function hydrateBodyImages(bodyEl) {
    if (!bodyEl) return;
    bodyEl.querySelectorAll("[data-url], [data-phocus]").forEach(function (el) {
      ["data-url", "data-phocus"].forEach(function (attr) {
        var val = el.getAttribute(attr) || "";
        if (val && !/^https?:\/\//i.test(val)) {
          el.setAttribute(attr, resolveAssetUrl(val));
        }
      });
    });
    bodyEl.querySelectorAll("img").forEach(function (img) {
      var src = img.getAttribute("src") || "";
      if (src) img.src = resolveAssetUrl(src);
      img.removeAttribute("onerror");
      img.removeAttribute("srcset");
    });
  }

  function renderArticle(article) {
    imageCacheKey =
      window.TiMagazineAsset && typeof window.TiMagazineAsset.cacheKeyFromArticle === "function"
        ? window.TiMagazineAsset.cacheKeyFromArticle(article)
        : String(Date.now());

    var neighbors = article.neighbors || findNeighbors(article.id);
    var pageTitle = article.title || "";
    if (titleEl) titleEl.textContent = pageTitle;
    root.innerHTML = "";
    if (statusEl) statusEl.hidden = true;

    if (article.publishedLabel || article.date) {
      var meta = document.createElement("p");
      meta.className = "mz-detail-meta";
      meta.textContent = article.publishedLabel || article.date;
      root.appendChild(meta);
    }

    var body = document.createElement("div");
    body.className = "mz-detail-body";
    body.setAttribute("aria-labelledby", "gvMomentDetailPageTitle");
    body.innerHTML = prepareBodyHtml(article.bodyHtml || "");
    hydrateBodyImages(body);
    root.appendChild(body);

    renderPrevNext(neighbors);

    document.title = (pageTitle || "GV 모먼트") + " — 55CINE";
  }

  function showError(message) {
    root.innerHTML = "";
    if (titleEl) titleEl.textContent = "GV 모먼트";
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = message;
    }
    document.title = "GV 모먼트 — 55CINE";
  }

  function boot() {
    applyBackLink();
    var id = getArticleId();
    if (!id) {
      showError("GV 모먼트 ID가 없습니다.");
      return;
    }

    Promise.all([
      window.TiApi && window.TiApi.getMagazineDetail ? Promise.resolve([]) : fetchIndex().catch(function () { return []; }),
      fetchArticle(id)
    ])
      .then(function (results) {
        indexItems = results[0] || [];
        renderArticle(results[1]);
      })
      .catch(function (err) {
        showError((err && err.message) || "GV 모먼트를 표시할 수 없습니다.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

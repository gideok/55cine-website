/**
 * 매거진 프리뷰 상세 — JSON / API 공통
 * window.TI_MAGAZINE_PREVIEW_DETAIL_CONFIG
 */
(function () {
  var cfg = window.TI_MAGAZINE_PREVIEW_DETAIL_CONFIG || {};
  var BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "../";
  var DATA_BASE = cfg.dataBase || "magazine/preview/data/";
  var LIST_URL = cfg.listPageUrl || "../magazine-preview.html";
  var INDEX_URL = cfg.indexUrl || DATA_BASE + "index.json";

  var root = document.getElementById("previewDetailRoot");
  var statusEl = document.getElementById("previewDetailStatus");
  var titleEl = document.getElementById("previewDetailPageTitle");
  var backLink = document.getElementById("mdBackLink");
  var indexItems = [];
  var imageCacheKey = "";

  if (!root) return;

  function applyBackLink() {
    if (!backLink) return;
    backLink.href = LIST_URL;
    backLink.setAttribute("aria-label", "프리뷰 목록으로 돌아가기");
  }

  function prepareBodyHtml(html) {
    var out = (html || "").replace(/\s+white-space:\s*pre-line/gi, "");
    if (window.TiMagazineBodyHtml && typeof window.TiMagazineBodyHtml.prepare === "function") {
      return window.TiMagazineBodyHtml.prepare(out);
    }
    return out;
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
      if (!res.ok) throw new Error("프리뷰를 불러오지 못했습니다. (" + res.status + ")");
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
      navLabel: "프리뷰 이동",
      colsLabel: "이전·다음 프리뷰",
      listUrl: LIST_URL,
      listText: "목록으로",
      listAriaLabel: "프리뷰 목록으로",
      neighbors: neighbors || { prev: null, next: null },
      hrefFor: function (item) {
        return detailHref(item.id);
      },
      titleFor: function (item) {
        return item.title || "";
      }
    });
  }

  function renderArticle(article) {
    imageCacheKey =
      window.TiMagazineAsset && typeof window.TiMagazineAsset.cacheKeyFromArticle === "function"
        ? window.TiMagazineAsset.cacheKeyFromArticle(article)
        : String(Date.now());

    var neighbors = article.neighbors || findNeighbors(article.id);
    var pageTitle = article.movieTitle || article.title || "";
    if (titleEl) titleEl.textContent = pageTitle;
    var headEl = document.querySelector(".md-head");
    var editSeq = article.seq || article.id;
    if (headEl && editSeq && window.TiAdminDetailEdit) {
      TiAdminDetailEdit.mount(
        headEl,
        TiAdminDetailEdit.buildHref("admin/magazine-edit.html", editSeq)
      );
    }
    root.innerHTML = "";
    if (statusEl) statusEl.hidden = true;

    if (article.subtitle) {
      var sub = document.createElement("p");
      sub.className = "mz-detail-subtitle";
      sub.textContent = article.subtitle;
      root.appendChild(sub);
    }

    if (article.publishedLabel) {
      var meta = document.createElement("p");
      meta.className = "mz-detail-meta";
      meta.textContent = article.publishedLabel;
      root.appendChild(meta);
    }

    if (article.coverImage) {
      var coverFig = document.createElement("figure");
      coverFig.className = "mz-detail-cover";
      var coverImg = document.createElement("img");
      coverImg.src = resolveAssetUrl(article.coverImage);
      coverImg.alt = (article.title || pageTitle) + " 썸네일";
      coverImg.loading = "eager";
      coverImg.decoding = "async";
      coverFig.appendChild(coverImg);
      root.appendChild(coverFig);
    }

    var body = document.createElement("div");
    body.className = "mz-detail-body";
    body.setAttribute("aria-labelledby", "previewDetailPageTitle");
    body.innerHTML = prepareBodyHtml(article.bodyHtml || "");
    body.querySelectorAll("img").forEach(function (img) {
      var src = img.getAttribute("src") || "";
      if (src) img.src = resolveAssetUrl(src);
    });
    root.appendChild(body);

    renderPrevNext(neighbors);

    document.title = (article.title || pageTitle || "프리뷰") + " — 55CINE";
    if (window.TiAnalytics && typeof window.TiAnalytics.pageview === "function") {
      window.TiAnalytics.pageview({ pageKey: String(article.seq || article.id || "") });
    }
  }

  function showError(message) {
    root.innerHTML = "";
    if (titleEl) titleEl.textContent = "프리뷰";
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = message;
    }
    document.title = "프리뷰 — 55CINE";
  }

  function boot() {
    applyBackLink();
    var id = getArticleId();
    if (!id) {
      showError("프리뷰 ID가 없습니다.");
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
        showError((err && err.message) || "프리뷰를 표시할 수 없습니다.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

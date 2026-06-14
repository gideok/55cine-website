/**
 * 지난 기사 상세 — JSON / API 공통
 * window.TI_MAGAZINE_PAST_DETAIL_CONFIG
 */
(function () {
  var cfg = window.TI_MAGAZINE_PAST_DETAIL_CONFIG || {};
  var BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "../";
  var DATA_BASE = cfg.dataBase || "magazine/past-articles/data/";
  var LIST_URL = cfg.listPageUrl || "../magazine-past-articles.html";
  var INDEX_URL = cfg.indexUrl || DATA_BASE + "index.json";

  var root = document.getElementById("pastArticleRoot");
  var statusEl = document.getElementById("pastArticleStatus");
  var titleEl = document.getElementById("pastArticlePageTitle");
  var backLink = document.getElementById("mdBackLink");
  var indexItems = [];

  if (!root) return;

  function applyBackLink() {
    if (!backLink) return;
    backLink.href = LIST_URL;
    backLink.setAttribute("aria-label", "지난 기사 목록으로 돌아가기");
  }

  function cleanStyleValue(styleContent) {
    return styleContent
      .split(";")
      .map(function (part) {
        return part.trim();
      })
      .filter(function (part) {
        if (!part) return false;
        var prop = part.split(":")[0].trim().toLowerCase();
        return prop.indexOf("background") !== 0;
      })
      .join("; ")
      .trim();
  }

  function stripBackgroundStyles(html) {
    if (!html) return "";
    var out = html.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, function (_match, quote, styleContent) {
      var cleaned = cleanStyleValue(styleContent);
      if (!cleaned) return "";
      return " style=" + quote + cleaned + quote;
    });
    out = out.replace(/\sbgcolor=(["'])[^"']*\1/gi, "");
    out = out.replace(/\sbgcolor=[^\s>]+/gi, "");
    return out;
  }

  function prepareBodyHtml(html) {
    return stripBackgroundStyles(html || "")
      .replace(/\s+onerror="[^"]*"/gi, "")
      .replace(/\s+srcset="[^"]*"/gi, "");
  }

  function hydrateBodyImages(bodyEl, attachments, coverImage) {
    if (!bodyEl) return;
    var paths = (attachments || []).map(function (a) {
      return a.path;
    });
    if (!paths.length && coverImage) paths = [coverImage];
    var idx = 0;

    bodyEl.querySelectorAll("img").forEach(function (img) {
      var src = img.getAttribute("src") || "";
      var mapped = paths.length ? paths[Math.min(idx, paths.length - 1)] : src;
      if (paths.length) idx += 1;
      img.removeAttribute("onerror");
      img.removeAttribute("srcset");
      img.src = resolveAssetUrl(mapped || src);
    });
  }

  function resolveAssetUrl(url) {
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
      if (!res.ok) throw new Error("기사를 불러오지 못했습니다. (" + res.status + ")");
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

  function renderAttachments(article) {
    var list = article.attachments;
    if (!Array.isArray(list) || list.length < 2) return null;
    var section = document.createElement("section");
    section.className = "mz-detail-attachments";
    section.setAttribute("aria-label", "첨부 이미지");
    var h2 = document.createElement("h2");
    h2.className = "mz-detail-attachments__title";
    h2.textContent = "첨부 이미지";
    section.appendChild(h2);
    var grid = document.createElement("div");
    grid.className = "mz-detail-attachments-grid";
    list.forEach(function (att, i) {
      if (att.path === article.coverImage && i === 0 && list.length > 1) return;
      var fig = document.createElement("figure");
      fig.className = "mz-detail-attachments-item";
      var img = document.createElement("img");
      img.src = resolveAssetUrl(att.path);
      img.alt = att.alt || article.title || "";
      img.loading = "lazy";
      img.decoding = "async";
      fig.appendChild(img);
      grid.appendChild(fig);
    });
    if (!grid.children.length) return null;
    section.appendChild(grid);
    return section;
  }

  function renderPrevNext(article, neighbors) {
    return window.TiSdPrevNext.render({
      returnNavOnly: true,
      navLabel: "기사 이동",
      colsLabel: "이전·다음 기사",
      listUrl: LIST_URL,
      listText: "목록으로",
      listAriaLabel: "지난 기사 목록으로",
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
    var neighbors = article.neighbors || findNeighbors(article.id);
    var pageTitle = article.title || "";
    if (titleEl) titleEl.textContent = pageTitle;
    root.innerHTML = "";
    if (statusEl) statusEl.hidden = true;

    if (article.publishedLabel) {
      var meta = document.createElement("p");
      meta.className = "mz-detail-meta";
      meta.textContent = article.publishedLabel;
      root.appendChild(meta);
    }

    var body = document.createElement("div");
    body.className = "mz-detail-body";
    body.setAttribute("aria-labelledby", "pastArticlePageTitle");
    body.innerHTML = prepareBodyHtml(article.bodyHtml || "");
    hydrateBodyImages(body, article.attachments, article.coverImage);
    root.appendChild(body);

    var attachments = renderAttachments(article);
    if (attachments) root.appendChild(attachments);

    root.appendChild(renderPrevNext(article, neighbors));

    document.title = (pageTitle || "지난 기사") + " — 55CINE";
  }

  function showError(message) {
    root.innerHTML = "";
    if (titleEl) titleEl.textContent = "지난 기사";
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = message;
    }
    document.title = "지난 기사 — 55CINE";
  }

  function boot() {
    applyBackLink();
    var id = getArticleId();
    if (!id) {
      showError("기사 ID가 없습니다.");
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
        showError((err && err.message) || "기사를 표시할 수 없습니다.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

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
  var indexItems = [];

  if (!root) return;

  function decodeHtmlEntities(text) {
    if (!text) return "";
    var el = document.createElement("textarea");
    el.innerHTML = text;
    return el.value;
  }

  function prepareBodyHtml(html) {
    return decodeHtmlEntities(html || "")
      .replace(/\r\n/g, "\n")
      .replace(/\.\.\/\.\.\/images\//g, "images/")
      .replace(/\.\.\/images\//g, "images/")
      .replace(/\s+onerror="[^"]*"/gi, "")
      .replace(/\s+srcset="[^"]*"/gi, "");
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
    var id = String(raw).trim();
    if (/^gm\d{3}$/i.test(id)) return id.toLowerCase();
    if (/^\d+$/.test(id)) return "gm" + String(parseInt(id, 10)).padStart(3, "0");
    return id;
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
    var nav = document.createElement("nav");
    nav.className = "sd-nav";
    nav.setAttribute("aria-label", "GV 모먼트 이동");

    var back = document.createElement("a");
    back.className = "sd-back";
    back.href = LIST_URL;
    back.textContent = "← GV 모먼트 목록";
    nav.appendChild(back);

    var cols = document.createElement("div");
    cols.className = "sd-pn-cols";
    cols.setAttribute("aria-label", "이전·다음 GV 모먼트");

    function buildCol(dir, item) {
      var col = document.createElement("div");
      col.className = "sd-pn-col sd-pn-col--" + dir;
      var label = document.createElement("p");
      label.className = "sd-pn-dir";
      label.textContent = dir === "prev" ? "이전" : "다음";
      col.appendChild(label);
      if (!item) {
        var empty = document.createElement("div");
        empty.className = "sd-pn-body sd-pn-body--empty";
        var thumbEmpty = document.createElement("div");
        thumbEmpty.className = "sd-pn-thumb-wrap sd-pn-thumb-wrap--empty";
        thumbEmpty.setAttribute("aria-hidden", "true");
        empty.appendChild(thumbEmpty);
        var note = document.createElement("p");
        note.className = "sd-pn-empty-note";
        note.textContent = "—";
        empty.appendChild(note);
        col.appendChild(empty);
        return col;
      }
      var card = document.createElement("a");
      card.className = "sd-pn-card";
      card.href = detailHref(item.id);
      card.setAttribute("aria-label", (dir === "prev" ? "이전: " : "다음: ") + item.title);
      var thumbWrap = document.createElement("div");
      thumbWrap.className = "sd-pn-thumb-wrap";
      if (item.thumbnail) {
        var thumb = document.createElement("img");
        thumb.className = "sd-pn-thumb";
        thumb.src = resolveAssetUrl(item.thumbnail);
        thumb.alt = "";
        thumb.loading = "lazy";
        thumbWrap.appendChild(thumb);
      }
      card.appendChild(thumbWrap);
      var t = document.createElement("p");
      t.className = "sd-pn-item-title";
      t.textContent = item.title;
      card.appendChild(t);
      col.appendChild(card);
      return col;
    }

    cols.appendChild(buildCol("prev", neighbors.prev));
    cols.appendChild(buildCol("next", neighbors.next));
    nav.appendChild(cols);
    return nav;
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
    var neighbors = article.neighbors || findNeighbors(article.id);
    root.innerHTML = "";
    if (statusEl) statusEl.hidden = true;

    var articleEl = document.createElement("article");

    var kicker = document.createElement("p");
    kicker.className = "sd-kicker";
    kicker.textContent = "매거진 삼삼오오 · GV 모먼트";
    articleEl.appendChild(kicker);

    var head = document.createElement("header");
    head.className = "sd-head";
    var h1 = document.createElement("h1");
    h1.className = "sd-title";
    h1.id = "article-title";
    h1.textContent = article.title || "";
    head.appendChild(h1);
    articleEl.appendChild(head);

    if (article.publishedLabel || article.date) {
      var meta = document.createElement("p");
      meta.className = "sd-meta";
      meta.textContent = article.publishedLabel || article.date;
      articleEl.appendChild(meta);
    }

    var body = document.createElement("section");
    body.className = "sd-body";
    body.setAttribute("aria-labelledby", "article-title");
    body.innerHTML = prepareBodyHtml(article.bodyHtml || "");
    hydrateBodyImages(body);
    articleEl.appendChild(body);

    articleEl.appendChild(renderPrevNext(neighbors));
    root.appendChild(articleEl);

    document.title = (article.title || "GV 모먼트") + " — 55CINE";
  }

  function showError(message) {
    root.innerHTML = "";
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = message;
    }
    document.title = "GV 모먼트 — 55CINE";
  }

  function boot() {
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

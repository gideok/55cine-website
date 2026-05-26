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
  var pageTitleEl = document.getElementById("pastArticlePageTitle");
  var indexItems = [];

  if (!root) return;

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
    if (url.charAt(0) === "/") return url;
    return BASE + url.replace(/^\//, "");
  }

  function getArticleId() {
    if (cfg.articleId) return String(cfg.articleId);
    var params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("slug") || "";
  }

  function buildDataUrl(id) {
    if (cfg.dataUrl) return cfg.dataUrl;
    return DATA_BASE + id + ".json";
  }

  function fetchArticle(id) {
    if (typeof cfg.fetchArticle === "function") {
      return Promise.resolve(cfg.fetchArticle(id));
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
    section.className = "sd-attachments";
    section.setAttribute("aria-label", "첨부 이미지");
    var h2 = document.createElement("h2");
    h2.className = "sd-subhead";
    h2.textContent = "첨부 이미지";
    section.appendChild(h2);
    var grid = document.createElement("div");
    grid.className = "sd-attachments-grid";
    list.forEach(function (att, i) {
      if (att.path === article.coverImage && i === 0 && list.length > 1) return;
      var fig = document.createElement("figure");
      fig.className = "sd-attachments-item";
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
    var nav = document.createElement("nav");
    nav.className = "sd-nav";
    nav.setAttribute("aria-label", "기사 이동");

    var back = document.createElement("a");
    back.className = "sd-back";
    back.href = LIST_URL;
    back.textContent = "← 지난 기사 목록";
    nav.appendChild(back);

    var cols = document.createElement("div");
    cols.className = "sd-pn-cols";
    cols.setAttribute("aria-label", "이전·다음 기사");

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
        thumb.width = 401;
        thumb.height = 226;
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

  function renderArticle(article) {
    var neighbors = findNeighbors(article.id);
    root.innerHTML = "";
    if (statusEl) statusEl.hidden = true;

    var articleEl = document.createElement("article");

    var kicker = document.createElement("p");
    kicker.className = "sd-kicker";
    kicker.textContent = "매거진 삼삼오오 · 지난 기사";
    articleEl.appendChild(kicker);

    var head = document.createElement("header");
    head.className = "sd-head";
    var h1 = document.createElement("h1");
    h1.className = "sd-title";
    h1.id = "article-title";
    h1.textContent = article.title || "";
    head.appendChild(h1);
    articleEl.appendChild(head);

    if (article.publishedLabel) {
      var meta = document.createElement("p");
      meta.className = "sd-meta";
      meta.textContent = article.publishedLabel;
      articleEl.appendChild(meta);
    }

    var body = document.createElement("section");
    body.className = "sd-body";
    body.setAttribute("aria-labelledby", "article-title");
    body.innerHTML = prepareBodyHtml(article.bodyHtml || "");
    hydrateBodyImages(body, article.attachments, article.coverImage);
    articleEl.appendChild(body);

    var attachments = renderAttachments(article);
    if (attachments) articleEl.appendChild(attachments);

    articleEl.appendChild(renderPrevNext(article, neighbors));
    root.appendChild(articleEl);

    if (pageTitleEl) pageTitleEl.textContent = article.title || "지난 기사";
    document.title = (article.title || "지난 기사") + " — 55CINE";
  }

  function showError(message) {
    root.innerHTML = "";
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = message;
    }
    if (pageTitleEl) pageTitleEl.textContent = "지난 기사";
  }

  function boot() {
    var id = getArticleId();
    if (!id) {
      showError("기사 ID가 없습니다.");
      return;
    }

    Promise.all([fetchIndex().catch(function () { return []; }), fetchArticle(id)])
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

/**
 * test/magazine-preview-test.html — 루트 magazine-preview.html 과 동일 로직, 상세 링크 ../ 보정
 */
(function () {
  var ITEMS_PER_PAGE = 12;
  var currentPage = 1;
  var currentView = "thumb";
  var dataset = [];

  var INTERNAL_PREVIEW_DETAIL_BY_ID = {
    1: "magazine-preview-detail-01.html",
    2: "magazine-preview-detail-02.html",
    3: "magazine-preview-detail-03.html",
    4: "magazine-preview-detail-04.html",
    5: "magazine-preview-detail-05.html",
    6: "magazine-preview-detail-06.html",
    7: "magazine-preview-detail-07.html",
    8: "magazine-preview-detail-08.html",
    9: "magazine-preview-detail-09.html",
    10: "magazine-preview-detail-10.html",
    11: "magazine-preview-detail-11.html",
    12: "magazine-preview-detail-12.html",
    13: "magazine-preview-detail-13.html",
    14: "magazine-preview-detail-14.html",
    15: "magazine-preview-detail-15.html",
    16: "magazine-preview-detail-16.html",
    17: "magazine-preview-detail-17.html",
    18: "magazine-preview-detail-18.html",
    19: "magazine-preview-detail-19.html",
    20: "magazine-preview-detail-20.html",
    21: "magazine-preview-detail-21.html",
    22: "magazine-preview-detail-22.html",
    23: "magazine-preview-detail-23.html",
    24: "magazine-preview-detail-24.html"
  };

  function toInternalArticleHref(item) {
    if (!item || !item.id) return "";
    var name = INTERNAL_PREVIEW_DETAIL_BY_ID[item.id] || "";
    if (!name) return "";
    return "../" + name;
  }

  function refreshDataset() {
    dataset = Array.isArray(window.MAGAZINE_PREVIEW_DATA) ? window.MAGAZINE_PREVIEW_DATA.slice() : [];
  }

  function ensureDatasetThenRender() {
    refreshDataset();
    if (!dataset.length) {
      window.setTimeout(function () {
        refreshDataset();
        renderCount();
        renderList();
        renderPagination();
      }, 0);
    }
  }

  function getTotalPages() {
    return Math.max(1, Math.ceil(dataset.length / ITEMS_PER_PAGE));
  }

  function getPageItems(page) {
    var start = (page - 1) * ITEMS_PER_PAGE;
    return dataset.slice(start, start + ITEMS_PER_PAGE);
  }

  function thumbSrc(src) {
    if (!src) return "";
    if (/^https?:/i.test(src)) return src;
    if (src.startsWith("../")) return src;
    return "../" + src.replace(/^\//, "");
  }

  function createPreviewItemElement(item) {
    var href = toInternalArticleHref(item);
    var article = document.createElement("article");
    article.className = "preview-item";

    var thumbLink = document.createElement("a");
    thumbLink.className = "preview-thumb-link";
    thumbLink.href = href;
    thumbLink.setAttribute("aria-label", item.title || "");

    var image = document.createElement("img");
    image.className = "preview-thumb";
    image.src = thumbSrc(item.thumbnail || "");
    image.alt = (item.title || "") + " 썸네일";
    image.loading = "lazy";
    thumbLink.appendChild(image);

    var body = document.createElement("div");
    body.className = "preview-body";

    var titleLink = document.createElement("a");
    titleLink.className = "preview-title-link";
    titleLink.href = href;
    titleLink.textContent = item.title || "";

    var excerptLink = document.createElement("a");
    excerptLink.className = "preview-excerpt-link";
    excerptLink.href = href;
    excerptLink.textContent = item.excerpt || "";

    body.appendChild(titleLink);
    body.appendChild(excerptLink);

    article.appendChild(thumbLink);
    article.appendChild(body);
    return article;
  }

  function renderList() {
    var list = document.getElementById("previewList");
    list.classList.toggle("is-thumb", currentView === "thumb");
    list.classList.toggle("is-list", currentView === "list");
    list.innerHTML = "";
    getPageItems(currentPage).forEach(function (item) {
      list.appendChild(createPreviewItemElement(item));
    });
  }

  function renderPagination() {
    var total = getTotalPages();
    var fractionEl = document.getElementById("mzPagerFraction");
    var dotsEl = document.getElementById("mzPagerDots");
    var btnPrev = document.getElementById("mzPagerPrev");
    var btnNext = document.getElementById("mzPagerNext");
    if (!fractionEl || !dotsEl || !btnPrev || !btnNext) return;

    fractionEl.textContent = total ? currentPage + " / " + total : "0 / 0";
    btnPrev.disabled = currentPage <= 1;
    btnNext.disabled = currentPage >= total;

    dotsEl.innerHTML = "";
    for (var i = 1; i <= total; i++) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "se-dot" + (i === currentPage ? " is-active" : "");
      dot.setAttribute("aria-label", "페이지 " + i);
      dot.setAttribute("data-page", String(i));
      dotsEl.appendChild(dot);
    }
  }

  function goToPage(page) {
    var total = getTotalPages();
    page = Math.max(1, Math.min(total, page));
    if (page === currentPage) return;
    currentPage = page;
    renderList();
    renderPagination();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCount() {
    var count = document.getElementById("resultCount");
    count.textContent = "총 " + dataset.length + "건";
  }

  function bindEvents() {
    document.querySelectorAll(".mode-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        var nextView = button.getAttribute("data-view");
        if (nextView === currentView) return;
        currentView = nextView;
        document.querySelectorAll(".mode-btn").forEach(function (btn) {
          var active = btn === button;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        renderList();
      });
    });

    var btnPrev = document.getElementById("mzPagerPrev");
    var btnNext = document.getElementById("mzPagerNext");
    var dotsEl = document.getElementById("mzPagerDots");

    if (btnPrev) {
      btnPrev.addEventListener("click", function () {
        goToPage(currentPage - 1);
      });
    }
    if (btnNext) {
      btnNext.addEventListener("click", function () {
        goToPage(currentPage + 1);
      });
    }
    if (dotsEl) {
      dotsEl.addEventListener("click", function (event) {
        var target = event.target.closest(".se-dot");
        if (!target) return;
        var p = Number(target.getAttribute("data-page") || 0);
        if (p >= 1) goToPage(p);
      });
    }
  }

  function boot() {
    ensureDatasetThenRender();
    currentPage = 1;
    renderCount();
    renderList();
    renderPagination();
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

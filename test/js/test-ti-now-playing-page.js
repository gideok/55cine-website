/**
 * test/now-playing-test.html — 루트 now-playing.html 과 동일 로직, 경로만 ../ 보정
 */
(function () {
  var PAGE_SIZE = 6;
  var DESKTOP = window.matchMedia("(min-width: 900px)");
  var grid = document.getElementById("npGrid");
  var pager = document.getElementById("npPager");
  var countEl = document.getElementById("npCount");
  var sentinel = document.getElementById("npSentinel");
  var endEl = document.getElementById("npEnd");
  var io = null;
  var state = { page: 1, mobileShown: PAGE_SIZE };

  function rootPath(u) {
    if (!u) return "";
    if (/^https?:/i.test(u)) return u;
    if (u.startsWith("../")) return u;
    /* 상세 HTML은 test/movies/now-playing/ 에 두고, 목록은 /test/*.html 기준 상대경로로 연결 */
    if (u.indexOf("movies/now-playing/") === 0) return u;
    return "../" + u.replace(/^\//, "");
  }

  function allMovies() {
    return window.NOW_PLAYING_MOVIES || [];
  }

  function totalPages(n) {
    return Math.max(1, Math.ceil(n / PAGE_SIZE));
  }

  function sliceForView() {
    var list = allMovies();
    if (DESKTOP.matches) {
      var start = (state.page - 1) * PAGE_SIZE;
      return list.slice(start, start + PAGE_SIZE);
    }
    return list.slice(0, state.mobileShown);
  }

  function renderCard(m) {
    var article = document.createElement("article");
    article.className = "np-card";
    var media = document.createElement("div");
    media.className = "np-card-media";
    var img = document.createElement("img");
    img.src = rootPath(m.poster);
    img.width = 400;
    img.height = 600;
    img.alt = m.titleKo + " 포스터";
    img.loading = "lazy";
    img.decoding = "async";
    var link = document.createElement("a");
    link.href = rootPath(m.detailUrl);
    link.className = "np-stretch-link";
    link.setAttribute("aria-label", m.titleKo + " 상세 보기");
    media.appendChild(img);
    media.appendChild(link);
    var body = document.createElement("div");
    body.className = "np-card-body";
    var h2 = document.createElement("h2");
    h2.className = "np-card-title";
    var tlink = document.createElement("a");
    tlink.href = rootPath(m.detailUrl);
    tlink.textContent = m.titleKo;
    h2.appendChild(tlink);
    body.appendChild(h2);
    if (m.titleEn) {
      var en = document.createElement("p");
      en.className = "np-card-en";
      en.textContent = m.titleEn;
      body.appendChild(en);
    }
    article.appendChild(media);
    article.appendChild(body);
    return article;
  }

  function renderPager(total) {
    pager.innerHTML = "";
    var pages = totalPages(total);
    if (pages <= 1) return;

    var prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "이전";
    prev.disabled = state.page <= 1;
    prev.addEventListener("click", function () {
      if (state.page > 1) {
        state.page--;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    pager.appendChild(prev);

    for (var p = 1; p <= pages; p++) {
      (function (num) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = String(num);
        if (num === state.page) b.setAttribute("aria-current", "page");
        b.addEventListener("click", function () {
          state.page = num;
          render();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
        pager.appendChild(b);
      })(p);
    }

    var next = document.createElement("button");
    next.type = "button";
    next.textContent = "다음";
    next.disabled = state.page >= pages;
    next.addEventListener("click", function () {
      if (state.page < pages) {
        state.page++;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    pager.appendChild(next);
  }

  function render() {
    var list = allMovies();
    grid.innerHTML = "";
    sliceForView().forEach(function (m) {
      grid.appendChild(renderCard(m));
    });

    if (DESKTOP.matches) {
      var tp = totalPages(list.length);
      pager.classList.toggle("is-visible", tp > 1);
      countEl.textContent = "총 " + list.length + "편 · " + state.page + " / " + tp + " 페이지";
      if (tp > 1) renderPager(list.length);
    } else {
      pager.classList.remove("is-visible");
      countEl.textContent =
        "총 " + list.length + "편 · " + Math.min(state.mobileShown, list.length) + "편 표시";
      endEl.classList.toggle(
        "is-visible",
        state.mobileShown >= list.length && list.length > 0
      );
    }
  }

  function onResizeMode() {
    state.page = 1;
    state.mobileShown = PAGE_SIZE;
    render();
  }

  function setupInfinite() {
    if (io) {
      io.disconnect();
      io = null;
    }
    if (!sentinel) return;
    io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (DESKTOP.matches) return;
          var list = allMovies();
          if (state.mobileShown >= list.length) return;
          state.mobileShown = Math.min(state.mobileShown + PAGE_SIZE, list.length);
          render();
        });
      },
      { root: null, rootMargin: "180px 0px", threshold: 0 }
    );
    io.observe(sentinel);
  }

  DESKTOP.addEventListener("change", function () {
    onResizeMode();
    setupInfinite();
  });

  function boot() {
    render();
    setupInfinite();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

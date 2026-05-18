/**
 * test/now-playing-test.html — 루트 now-playing.html 과 동일 로직, 경로만 ../ 보정
 */
(function () {
  var PAGE_SIZE = 6;
  var Pager = window.TiPagePager;
  var grid = document.getElementById("npGrid");
  var pager = document.getElementById("npPager");
  var countEl = document.getElementById("npCount");
  var sentinel = document.getElementById("npSentinel");
  var endEl = document.getElementById("npEnd");
  var io = null;
  var state = { page: 1, mobileShown: PAGE_SIZE };

  function isDesktop() {
    return Pager && Pager.isDesktop();
  }

  function rootPath(u) {
    if (!u) return "";
    if (/^https?:/i.test(u)) return u;
    if (u.startsWith("../")) return u;
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
    if (isDesktop()) {
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

  function render() {
    var list = allMovies();
    grid.innerHTML = "";
    sliceForView().forEach(function (m) {
      grid.appendChild(renderCard(m));
    });

    if (isDesktop()) {
      var tp = totalPages(list.length);
      if (countEl) {
        countEl.textContent = Pager.formatMovies(list.length, state.page, tp);
      }
      if (Pager) {
        Pager.render(pager, {
          page: state.page,
          totalPages: tp,
          scrollRootSelector: ".ti-np-scroll",
          onChange: function (p) {
            state.page = p;
            render();
          }
        });
      }
    } else {
      if (Pager) Pager.updateVisibility(pager, 0);
      if (countEl) {
        countEl.textContent =
          "총 " + list.length + "편 · " + Math.min(state.mobileShown, list.length) + "편 표시";
      }
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
          if (isDesktop()) return;
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

  if (Pager && Pager.mq) {
    Pager.mq.addEventListener("change", function () {
      onResizeMode();
      setupInfinite();
    });
  }

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

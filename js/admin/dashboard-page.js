(function () {
  TiAdminAuth.guard(function () {

  var POSTER_PLACEHOLDER = "images/schedule-poster-placeholder.svg";

  TiAdminLayout.mount("dashboard", "대시보드");
  var el = TiAdminLayout.contentEl();

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveAssetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || /^blob:/i.test(path) || /^data:/i.test(path)) {
      return path;
    }
    var rel = String(path).replace(/^\//, "");
    if (window.TiSiteRoot && typeof window.TiSiteRoot.relativePrefix === "function") {
      return window.TiSiteRoot.relativePrefix() + rel;
    }
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(rel);
    }
    return "../" + rel;
  }

  function renderNowPlayingGrid(items) {
    if (!items || !items.length) {
      return "";
    }

    var cells = items
      .map(function (item) {
        var poster = resolveAssetUrl(item.poster || POSTER_PLACEHOLDER);
        var title = esc(item.titleKo || "상영작");
        var href = "programs.html?editSeq=" + encodeURIComponent(String(item.seq));
        return (
          '<a class="admin-now-playing-grid__item" href="' +
          href +
          '" title="' +
          title +
          '">' +
          '<img src="' +
          esc(poster) +
          '" alt="' +
          title +
          '" width="150" loading="lazy" decoding="async" />' +
          "</a>"
        );
      })
      .join("");

    return (
      '<section class="admin-now-playing-grid" aria-label="현재 상영작 포스터">' +
      cells +
      "</section>"
    );
  }

  function renderCard(c) {
    var toneClass = c.tone ? " admin-card--" + c.tone : "";
    var inner =
      '<div class="admin-card__label">' +
      c.label +
      '</div><div class="admin-card__value">' +
      c.value +
      "</div>";
    if (c.href) {
      return (
        '<a class="admin-card admin-card--link' +
        toneClass +
        '" href="' +
        c.href +
        '">' +
        inner +
        "</a>"
      );
    }
    return '<div class="admin-card' + toneClass + '">' + inner + "</div>";
  }

  function renderCardRows(groups) {
    return (
      '<div class="admin-dashboard-stats">' +
      groups
        .map(function (cards) {
          return (
            '<div class="admin-cards">' +
            cards.map(renderCard).join("") +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  el.innerHTML = '<p>집계 불러오는 중…</p>';

  TiAdminApi.getDashboard()
    .then(function (stats) {
      var cardGroups = [
        [
          { label: "총상영작", value: stats.programs.total, tone: "total" },
          { label: "현재 상영", value: stats.movies.nowPlaying },
          { label: "상영 예정", value: stats.movies.upcoming },
          { label: "지난 상영", value: stats.movies.past },
          {
            label: "데스크톱만 등록된 자료",
            value: stats.programs.desktopOnlyFrom2026,
            href: "programs.html?desktopOnly=1",
            tone: "desktop-only"
          }
        ],
        [
          { label: "기획전", value: stats.special.exhibition },
          { label: "행사", value: stats.special.event }
        ],
        [
          { label: "매거진 프리뷰", value: stats.magazine.preview },
          { label: "매거진 연재", value: stats.magazine.serial },
          { label: "GV 모먼트", value: stats.magazine.gvMoment },
          { label: "지난 기사", value: stats.magazine.past },
          { label: "매거진 전체", value: stats.magazine.total, tone: "magazine-total" }
        ]
      ];

      el.innerHTML =
        renderNowPlayingGrid(stats.nowPlayingPrograms || []) +
        renderCardRows(cardGroups) +
        '<div class="admin-toolbar">' +
        '<a class="admin-btn admin-btn--primary" href="programs.html">상영작 관리</a>' +
        '<a class="admin-btn admin-btn--primary" href="special.html">기획전·행사 관리</a>' +
        '<a class="admin-btn admin-btn--primary" href="magazine.html">매거진 관리</a>' +
        "</div>";
    })
    .catch(function (err) {
      el.innerHTML =
        '<div class="admin-msg admin-msg--error">' +
        (err.message || "대시보드 로드 실패") +
        "</div>";
    });
  });
})();

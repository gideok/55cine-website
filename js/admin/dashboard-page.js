(function () {
  if (!window.TiAdminAuth.require()) return;

  TiAdminLayout.mount("dashboard", "대시보드");
  var el = TiAdminLayout.contentEl();

  el.innerHTML = '<p>집계 불러오는 중…</p>';

  TiAdminApi.getDashboard()
    .then(function (stats) {
      var cards = [
        { label: "웹 상영작 (web_program)", value: stats.programs.total },
        { label: "현재 상영", value: stats.movies.nowPlaying },
        { label: "상영 예정", value: stats.movies.upcoming },
        { label: "지난 상영", value: stats.movies.past },
        { label: "기획전", value: stats.special.exhibition },
        { label: "행사", value: stats.special.event },
        { label: "매거진 프리뷰", value: stats.magazine.preview },
        { label: "매거진 연재", value: stats.magazine.serial },
        { label: "GV 모먼트", value: stats.magazine.gvMoment },
        { label: "지난 기사", value: stats.magazine.past },
        { label: "매거진 전체", value: stats.magazine.total }
      ];

      el.innerHTML =
        '<div class="admin-cards">' +
        cards
          .map(function (c) {
            return (
              '<div class="admin-card"><div class="admin-card__label">' +
              c.label +
              '</div><div class="admin-card__value">' +
              c.value +
              "</div></div>"
            );
          })
          .join("") +
        "</div>" +
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
})();

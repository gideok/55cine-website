(function () {
  TiAdminAuth.guard(function () {
    TiAdminLayout.mount("cat-treasure", "고양이 이벤트");
    var el = TiAdminLayout.contentEl();

    function esc(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function yn(v) {
      return v ? "예" : "아니오";
    }

    function statusLabel(status) {
      if (!status) return "—";
      if (status.active) return "진행 중";
      var map = {
        disabled: "비활성",
        not_started: "시작 전",
        sold_out: "당첨 마감",
        invalid_startAt: "시작일시 오류"
      };
      return map[status.reason] || status.reason || "종료/비활성";
    }

    el.innerHTML = '<p class="admin-muted">불러오는 중…</p>';

    TiAdminApi.getCatTreasureEvent()
      .then(function (data) {
        var cfg = data.config || {};
        var status = data.status || {};
        var winners = Array.isArray(cfg.winners) ? cfg.winners.slice() : [];
        // 최신 당첨이 위로
        winners = winners.slice().reverse();

        var fields = [
          { key: "enabled", label: "활성화", value: yn(cfg.enabled) },
          { key: "status", label: "상태", value: statusLabel(status) },
          { key: "startAt", label: "시작일시", value: cfg.startAt || "—" },
          {
            key: "appearProbability",
            label: "등장확률",
            value:
              cfg.appearProbability == null
                ? "—"
                : String(cfg.appearProbability) +
                  " (" +
                  Math.round(Number(cfg.appearProbability) * 1000) / 10 +
                  "%)"
          },
          {
            key: "winnersCount",
            label: "당첨 현황",
            value: String(cfg.currentWinners || 0) + " / " + String(cfg.totalWinners || 0)
          },
          {
            key: "remaining",
            label: "남은 당첨",
            value: String(status.remainingWinners != null ? status.remainingWinners : "—")
          },
          { key: "fadeMs", label: "페이드(ms)", value: String(cfg.fadeMs || "—") },
          {
            key: "preventSameBrowserReWin",
            label: "같은 브라우저 재당첨 방지",
            value: yn(cfg.preventSameBrowserReWin)
          },
          {
            key: "blockOnPageRefresh",
            label: "새로고침 시 출연 차단",
            value: yn(cfg.blockOnPageRefresh)
          }
        ];

        var dl =
          '<dl class="admin-readonly-dl">' +
          fields
            .map(function (f) {
              return (
                "<div class=\"admin-readonly-dl__row\">" +
                "<dt>" +
                esc(f.label) +
                "</dt><dd>" +
                esc(f.value) +
                "</dd></div>"
              );
            })
            .join("") +
          "</dl>";

        var cards;
        if (!winners.length) {
          cards = '<p class="admin-muted">아직 당첨 기록이 없습니다.</p>';
        } else {
          cards =
            '<div class="admin-winners-grid" role="list">' +
            winners
              .map(function (w, i) {
                var n = winners.length - i;
                return (
                  '<article class="admin-winner-card" role="listitem">' +
                  '<div class="admin-winner-card__idx">#' +
                  esc(String(n)) +
                  "</div>" +
                  '<div class="admin-winner-card__label">클릭 시각</div>' +
                  '<div class="admin-winner-card__value">' +
                  esc(w.clickedAt || "—") +
                  "</div>" +
                  '<div class="admin-winner-card__label">IP</div>' +
                  '<div class="admin-winner-card__value admin-winner-card__ip">' +
                  esc(w.ip || "—") +
                  "</div>" +
                  "</article>"
                );
              })
              .join("") +
            "</div>";
        }

        el.innerHTML =
          '<p class="admin-muted admin-cat-treasure-note">읽기 전용 · 설정 파일 <code>data/cat-treasure-event.json</code></p>' +
          '<section class="admin-panel">' +
          '<h2 class="admin-panel__title">이벤트 설정</h2>' +
          dl +
          "</section>" +
          '<section class="admin-panel" style="margin-top:1.25rem">' +
          '<h2 class="admin-panel__title">당첨자 (winners) — ' +
          esc(String(winners.length)) +
          "건</h2>" +
          cards +
          "</section>";
      })
      .catch(function (err) {
        el.innerHTML =
          '<p class="admin-error">' +
          esc((err && err.message) || "고양이 이벤트 설정을 불러오지 못했습니다.") +
          "</p>";
      });
  });
})();

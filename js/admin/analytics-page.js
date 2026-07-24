(function () {
  TiAdminAuth.guard(function () {
    TiAdminLayout.mount("analytics", "접속 통계");
    var el = TiAdminLayout.contentEl();

    function esc(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function todaySeoul() {
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date());
      var get = function (t) {
        return (
          (
            parts.find(function (p) {
              return p.type === t;
            }) || {}
          ).value || "00"
        );
      };
      return get("year") + "-" + get("month") + "-" + get("day");
    }

    function addDays(day, delta) {
      var bits = day.split("-").map(Number);
      var d = new Date(Date.UTC(bits[0], bits[1] - 1, bits[2] + delta));
      var y = d.getUTCFullYear();
      var m = String(d.getUTCMonth() + 1).padStart(2, "0");
      var dd = String(d.getUTCDate()).padStart(2, "0");
      return y + "-" + m + "-" + dd;
    }

    var state = {
      range: 14,
      selectedDay: todaySeoul()
    };

    function render() {
      el.innerHTML = '<p class="admin-muted">불러오는 중…</p>';
      var to = todaySeoul();
      var from = addDays(to, -(state.range - 1));

      Promise.all([
        TiAdminApi.getAnalyticsSummary(from, to),
        TiAdminApi.getAnalyticsPages({ day: state.selectedDay, limit: 50 })
      ])
        .then(function (results) {
          var summary = results[0] || {};
          var pages = (results[1] && results[1].items) || [];
          var today = summary.today || { uv: 0, pv: 0, day: to };
          var totals = summary.totals || { uv: 0, pv: 0 };
          var days = summary.days || [];

          var dayRows = days
            .slice()
            .reverse()
            .map(function (row) {
              var selected = row.day === state.selectedDay ? " is-selected" : "";
              return (
                '<tr class="admin-analytics-day-row' +
                selected +
                '" data-day="' +
                esc(row.day) +
                '">' +
                "<td>" +
                esc(row.day) +
                "</td>" +
                "<td>" +
                esc(String(row.uv)) +
                "</td>" +
                "<td>" +
                esc(String(row.pv)) +
                "</td>" +
                "</tr>"
              );
            })
            .join("");

          if (!dayRows) {
            dayRows =
              '<tr><td colspan="3" class="admin-muted">아직 집계된 일별 데이터가 없습니다.</td></tr>';
          }

          var pageRows = pages
            .map(function (row) {
              return (
                "<tr>" +
                "<td>" +
                esc(row.path) +
                "</td>" +
                "<td>" +
                esc(row.pageKey || "—") +
                "</td>" +
                "<td>" +
                esc(String(row.pv)) +
                "</td>" +
                "</tr>"
              );
            })
            .join("");

          if (!pageRows) {
            pageRows =
              '<tr><td colspan="3" class="admin-muted">선택한 날짜의 페이지뷰가 없습니다.</td></tr>';
          }

          el.innerHTML =
            '<div class="admin-cards admin-analytics-summary">' +
            '<div class="admin-card"><div class="admin-card__label">오늘 접속자(UV)</div>' +
            '<div class="admin-card__value">' +
            esc(String(today.uv || 0)) +
            "</div></div>" +
            '<div class="admin-card"><div class="admin-card__label">오늘 페이지뷰(PV)</div>' +
            '<div class="admin-card__value">' +
            esc(String(today.pv || 0)) +
            "</div></div>" +
            '<div class="admin-card"><div class="admin-card__label">기간 합계 UV</div>' +
            '<div class="admin-card__value">' +
            esc(String(totals.uv || 0)) +
            "</div></div>" +
            '<div class="admin-card"><div class="admin-card__label">기간 합계 PV</div>' +
            '<div class="admin-card__value">' +
            esc(String(totals.pv || 0)) +
            "</div></div>" +
            "</div>" +
            '<div class="admin-toolbar admin-analytics-toolbar">' +
            "<label>기간 <select id=\"analyticsRange\">" +
            '<option value="7"' +
            (state.range === 7 ? " selected" : "") +
            ">최근 7일</option>" +
            '<option value="14"' +
            (state.range === 14 ? " selected" : "") +
            ">최근 14일</option>" +
            '<option value="30"' +
            (state.range === 30 ? " selected" : "") +
            ">최근 30일</option>" +
            "</select></label>" +
            '<span class="admin-muted">일별 행을 클릭하면 페이지별 PV를 볼 수 있습니다. (선택: ' +
            esc(state.selectedDay) +
            ")</span>" +
            "</div>" +
            '<div class="admin-analytics-grid">' +
            '<section class="admin-panel">' +
            '<h2 class="admin-panel__title">일별 UV · PV</h2>' +
            '<div class="admin-table-wrap"><table class="admin-table">' +
            "<thead><tr><th>날짜</th><th>UV</th><th>PV</th></tr></thead>" +
            '<tbody id="analyticsDayBody">' +
            dayRows +
            "</tbody></table></div></section>" +
            '<section class="admin-panel">' +
            '<h2 class="admin-panel__title">페이지별 PV — ' +
            esc(state.selectedDay) +
            "</h2>" +
            '<div class="admin-table-wrap"><table class="admin-table">' +
            "<thead><tr><th>경로</th><th>pageKey</th><th>PV</th></tr></thead>" +
            "<tbody>" +
            pageRows +
            "</tbody></table></div></section>" +
            "</div>";

          var rangeSel = document.getElementById("analyticsRange");
          if (rangeSel) {
            rangeSel.addEventListener("change", function () {
              state.range = Number(rangeSel.value) || 14;
              render();
            });
          }

          var body = document.getElementById("analyticsDayBody");
          if (body) {
            body.addEventListener("click", function (e) {
              var tr = e.target && e.target.closest ? e.target.closest("tr[data-day]") : null;
              if (!tr) return;
              state.selectedDay = tr.getAttribute("data-day") || state.selectedDay;
              render();
            });
          }
        })
        .catch(function (err) {
          el.innerHTML =
            '<p class="admin-error">' +
            esc((err && err.message) || "접속 통계를 불러오지 못했습니다.") +
            "</p>";
        });
    }

    render();
  });
})();

(function () {
  TiAdminAuth.guard(function () {

  var WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  var state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    loading: false
  };

  TiAdminLayout.mount("work-schedule", "근무스케줄");
  var el = TiAdminLayout.contentEl();

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function todayYmd() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function monthInputValue() {
    return state.year + "-" + pad2(state.month);
  }

  function syncMonthInput() {
    var monthInput = document.getElementById("wsMonthInput");
    if (monthInput) monthInput.value = monthInputValue();
  }

  function shiftMonth(delta) {
    var m = state.month + delta;
    var y = state.year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    state.year = y;
    state.month = m;
    syncMonthInput();
    loadMonth();
  }

  function setMonthNavDisabled(disabled) {
    ["wsPrevMonth", "wsNextMonth", "wsMonthInput", "wsTodayBtn"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.disabled = disabled;
    });
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shiftLine(label, names) {
    var list = (names || []).filter(Boolean);
    if (!list.length) {
      return (
        '<div class="ws-day__shift ws-day__shift--empty">' +
        '<span class="ws-day__shift-label">' +
        esc(label) +
        "</span>" +
        '<span class="ws-day__shift-value">—</span></div>'
      );
    }
    return (
      '<div class="ws-day__shift">' +
      '<span class="ws-day__shift-label">' +
      esc(label) +
      "</span>" +
      '<span class="ws-day__shift-value">' +
      esc(list.join(", ")) +
      "</span></div>"
    );
  }

  function remarksHtml(day) {
    var items = [day.remark1, day.remark2, day.remark3].filter(Boolean);
    if (!items.length) return "";
    return (
      '<ul class="ws-day__remarks">' +
      items
        .map(function (r) {
          return "<li>" + esc(r) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function renderDay(day) {
    var parts = day.workdate.split("-");
    var dayNum = parts[2] ? String(Number(parts[2])) : "";
    var cls = "ws-day";
    if (!day.inMonth) cls += " ws-day--other-month";
    if (day.workdate === todayYmd()) cls += " ws-day--today";

    var meeting =
      day.divMeeting ?
        '<span class="ws-day__meeting">집행부 회의</span>'
      : "";

    return (
      '<article class="' +
      cls +
      '" data-date="' +
      esc(day.workdate) +
      '">' +
      '<header class="ws-day__head">' +
      '<span class="ws-day__num">' +
      esc(dayNum) +
      "</span>" +
      meeting +
      "</header>" +
      '<div class="ws-day__body">' +
      shiftLine("주간", [day.emp1Name, day.emp1_2Name]) +
      shiftLine("야간", [day.emp2Name, day.emp2_2Name]) +
      remarksHtml(day) +
      "</div>" +
      "</article>"
    );
  }

  function renderCalendar(data) {
    var days = (data && data.days) || [];
    var weekdayHead =
      '<div class="ws-calendar__weekdays">' +
      WEEKDAYS.map(function (w) {
        return '<div class="ws-calendar__weekday">' + w + "</div>";
      }).join("") +
      "</div>";

    var grid =
      '<div class="ws-calendar__grid">' +
      days.map(renderDay).join("") +
      "</div>";

    return weekdayHead + grid;
  }

  function renderShell(statusText) {
    el.innerHTML =
      '<div class="ws-calendar">' +
      '<div class="ws-calendar__toolbar">' +
      '<div class="ws-calendar__month-picker">' +
      '<span class="ws-calendar__month-label">월 선택</span>' +
      '<div class="ws-calendar__month-nav">' +
      '<button type="button" class="admin-btn ws-calendar__month-btn" id="wsPrevMonth" aria-label="이전 달">‹</button>' +
      '<input type="month" id="wsMonthInput" value="' +
      esc(monthInputValue()) +
      '" aria-label="조회 월" />' +
      '<button type="button" class="admin-btn ws-calendar__month-btn" id="wsNextMonth" aria-label="다음 달">›</button>' +
      "</div></div>" +
      '<button type="button" class="admin-btn" id="wsTodayBtn">이번 달</button>' +
      '<span class="ws-calendar__readonly">조회 전용 · TRMS에서 편집</span>' +
      "</div>" +
      '<p class="admin-msg" id="wsStatus">' +
      esc(statusText || "") +
      "</p>" +
      '<div id="wsCalendarMount"></div>' +
      "</div>";
  }

  function setStatus(msg, isError) {
    var status = document.getElementById("wsStatus");
    if (!status) return;
    status.textContent = msg || "";
    status.className = isError ? "admin-msg admin-msg--error" : "admin-msg";
  }

  function bindToolbar() {
    var monthInput = document.getElementById("wsMonthInput");
    var todayBtn = document.getElementById("wsTodayBtn");
    var prevBtn = document.getElementById("wsPrevMonth");
    var nextBtn = document.getElementById("wsNextMonth");

    if (monthInput) {
      monthInput.onchange = function () {
        var raw = monthInput.value || "";
        var m = raw.match(/^(\d{4})-(\d{2})$/);
        if (!m) return;
        state.year = Number(m[1]);
        state.month = Number(m[2]);
        loadMonth();
      };
    }

    if (prevBtn) {
      prevBtn.onclick = function () {
        shiftMonth(-1);
      };
    }

    if (nextBtn) {
      nextBtn.onclick = function () {
        shiftMonth(1);
      };
    }

    if (todayBtn) {
      todayBtn.onclick = function () {
        var d = new Date();
        state.year = d.getFullYear();
        state.month = d.getMonth() + 1;
        syncMonthInput();
        loadMonth();
      };
    }
  }

  function loadMonth() {
    if (state.loading) return;
    state.loading = true;
    setMonthNavDisabled(true);
    setStatus("불러오는 중…");

    TiAdminApi.getWorkSchedule(state.year, state.month)
      .then(function (data) {
        var mount = document.getElementById("wsCalendarMount");
        if (mount) mount.innerHTML = renderCalendar(data);
        setStatus(state.year + "년 " + state.month + "월");
      })
      .catch(function (err) {
        setStatus((err && err.message) || "근무스케줄을 불러오지 못했습니다.", true);
      })
      .finally(function () {
        state.loading = false;
        setMonthNavDisabled(false);
      });
  }

  renderShell("");
  bindToolbar();
  loadMonth();
  });
})();

(function () {
  TiAdminAuth.guard(function () {
    var POSTER_PLACEHOLDER = "images/schedule-poster-placeholder.svg";
    var DEFAULT_ROWS = 6;

    var state = {
      anchor: todayIso(),
      expanded: false,
      loading: false,
      week: null
    };

    TiAdminLayout.mount("screening-schedule", "상영시간표");
    var el = TiAdminLayout.contentEl();

    function pad2(n) {
      return String(n).padStart(2, "0");
    }

    function todayIso() {
      var d = new Date();
      return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    }

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

    function shiftAnchor(days) {
      var parts = String(state.anchor || todayIso()).split("-");
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() + days);
      state.anchor =
        d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    }

    function setNavDisabled(disabled) {
      ["scPrevWeek", "scNextWeek", "scTodayBtn", "scExpandBtn"].forEach(function (id) {
        var node = document.getElementById(id);
        if (node) node.disabled = disabled;
      });
    }

    function badgeHtml(slot) {
      var badges = [];
      if (slot.opening) badges.push('<span class="admin-sc-badge admin-sc-badge--open">개봉</span>');
      if (slot.closing) badges.push('<span class="admin-sc-badge admin-sc-badge--end">종영</span>');
      if (slot.gv) badges.push('<span class="admin-sc-badge admin-sc-badge--gv">GV</span>');
      if (slot.ct) badges.push('<span class="admin-sc-badge admin-sc-badge--ct">CT</span>');
      return badges.join("");
    }

    function slotCellHtml(slot) {
      var poster = resolveAssetUrl(slot.imgThumb || POSTER_PLACEHOLDER);
      var hiddenClass = slot.hidden ? " admin-sc-slot--hidden" : "";
      var toggleLabel = slot.hidden ? "숨김" : "표시";
      var togglePressed = slot.hidden ? "true" : "false";
      return (
        '<article class="admin-sc-slot' +
        hiddenClass +
        '" data-seq="' +
        esc(String(slot.seq)) +
        '">' +
        '<div class="admin-sc-slot__head">' +
        '<img class="admin-sc-slot__thumb" src="' +
        esc(poster) +
        '" alt="" width="36" height="36" loading="lazy" decoding="async" />' +
        '<div class="admin-sc-slot__meta">' +
        '<div class="admin-sc-slot__time">' +
        esc(slot.time) +
        (slot.timeEnd ? '<span class="admin-sc-slot__time-end">~' + esc(slot.timeEnd) + "</span>" : "") +
        "</div>" +
        '<div class="admin-sc-slot__title" title="' +
        esc(slot.title) +
        '">' +
        esc(slot.title) +
        "</div>" +
        "</div>" +
        "</div>" +
        (badgeHtml(slot) ? '<div class="admin-sc-slot__badges">' + badgeHtml(slot) + "</div>" : "") +
        '<button type="button" class="admin-sc-slot__toggle' +
        (slot.hidden ? " is-hidden" : " is-visible") +
        '" data-action="toggle-visibility" aria-pressed="' +
        togglePressed +
        '" title="GNB 표시 여부">' +
        esc(toggleLabel) +
        "</button>" +
        "</article>"
      );
    }

    function emptySlotHtml() {
      return '<div class="admin-sc-slot admin-sc-slot--empty" aria-hidden="true"><span>—</span></div>';
    }

    function renderGrid() {
      var mount = document.getElementById("scWeekGrid");
      if (!mount) return;

      var week = state.week;
      if (!week || !Array.isArray(week.days)) {
        mount.innerHTML = '<p class="admin-msg">표시할 상영시간표가 없습니다.</p>';
        return;
      }

      var maxSlots = Number(week.maxSlotCount || 0);
      var rowCount = state.expanded
        ? Math.max(DEFAULT_ROWS, maxSlots)
        : DEFAULT_ROWS;
      var canExpand = maxSlots > DEFAULT_ROWS;

      var expandBtn = document.getElementById("scExpandBtn");
      if (expandBtn) {
        expandBtn.hidden = !canExpand;
        expandBtn.textContent = state.expanded
          ? "6회차까지만 보기"
          : "전체 " + maxSlots + "회차 보기";
      }

      var rangeEl = document.getElementById("scWeekRange");
      if (rangeEl) {
        rangeEl.textContent =
          formatRangeLabel(week.weekStart) + " ~ " + formatRangeLabel(week.weekEnd) + " (목~수)";
      }

      var html = '<div class="admin-sc-week">';
      html += '<div class="admin-sc-week__head">';
      week.days.forEach(function (day) {
        html +=
          '<div class="admin-sc-week__day-head">' +
          '<span class="admin-sc-week__day-label">' +
          esc(day.label) +
          "</span>" +
          '<span class="admin-sc-week__day-count">' +
          esc(String((day.slots || []).length)) +
          "회</span>" +
          "</div>";
      });
      html += "</div>";

      for (var row = 0; row < rowCount; row += 1) {
        html += '<div class="admin-sc-week__row">';
        week.days.forEach(function (day) {
          var slot = (day.slots || [])[row];
          html +=
            '<div class="admin-sc-week__cell">' +
            (slot ? slotCellHtml(slot) : emptySlotHtml()) +
            "</div>";
        });
        html += "</div>";
      }
      html += "</div>";
      mount.innerHTML = html;
    }

    function formatRangeLabel(iso) {
      if (!iso) return "";
      var parts = String(iso).split("-");
      if (parts.length !== 3) return iso;
      return Number(parts[1]) + "/" + Number(parts[2]);
    }

    function renderShell() {
      el.innerHTML =
        '<div class="admin-sc-toolbar">' +
        '<div class="admin-sc-toolbar__nav">' +
        '<button type="button" class="admin-btn" id="scPrevWeek">← 이전 주</button>' +
        '<button type="button" class="admin-btn" id="scTodayBtn">이번 주</button>' +
        '<button type="button" class="admin-btn" id="scNextWeek">다음 주 →</button>' +
        "</div>" +
        '<div class="admin-sc-toolbar__meta">' +
        '<p class="admin-sc-toolbar__range" id="scWeekRange"></p>' +
        '<p class="admin-sc-toolbar__hint">주간 기준: 목요일 ~ 수요일 · 숨김 회차는 GNB 상영시간표에 표시되지 않습니다.</p>' +
        "</div>" +
        '<div class="admin-sc-toolbar__actions">' +
        '<button type="button" class="admin-btn admin-btn--primary" id="scExpandBtn" hidden>전체 회차 보기</button>' +
        "</div>" +
        "</div>" +
        '<div id="scWeekGrid" class="admin-sc-grid-mount" aria-live="polite"></div>';

      document.getElementById("scPrevWeek").addEventListener("click", function () {
        shiftAnchor(-7);
        loadWeek();
      });
      document.getElementById("scNextWeek").addEventListener("click", function () {
        shiftAnchor(7);
        loadWeek();
      });
      document.getElementById("scTodayBtn").addEventListener("click", function () {
        state.anchor = todayIso();
        loadWeek();
      });
      document.getElementById("scExpandBtn").addEventListener("click", function () {
        state.expanded = !state.expanded;
        renderGrid();
      });

      el.addEventListener("click", onGridClick);
    }

    function findSlot(seq) {
      if (!state.week || !state.week.days) return null;
      for (var i = 0; i < state.week.days.length; i += 1) {
        var slots = state.week.days[i].slots || [];
        for (var j = 0; j < slots.length; j += 1) {
          if (Number(slots[j].seq) === Number(seq)) return slots[j];
        }
      }
      return null;
    }

    function onGridClick(e) {
      var btn = e.target.closest("[data-action='toggle-visibility']");
      if (!btn) return;
      var slotEl = btn.closest(".admin-sc-slot[data-seq]");
      if (!slotEl) return;
      var seq = Number(slotEl.getAttribute("data-seq"));
      if (!seq) return;

      var slot = findSlot(seq);
      if (!slot) return;

      var nextHidden = !slot.hidden;
      btn.disabled = true;

      TiAdminApi.setScreeningVisibility(seq, nextHidden)
        .then(function () {
          slot.hidden = nextHidden;
          renderGrid();
        })
        .catch(function (err) {
          window.alert((err && err.message) || "표시 여부를 변경하지 못했습니다.");
        })
        .finally(function () {
          btn.disabled = false;
        });
    }

    function loadWeek() {
      state.loading = true;
      setNavDisabled(true);
      var mount = document.getElementById("scWeekGrid");
      if (mount) {
        mount.innerHTML = '<p class="admin-msg">상영시간표를 불러오는 중…</p>';
      }

      TiAdminApi.getScreeningScheduleWeek(state.anchor)
        .then(function (data) {
          state.week = data;
          if (data && data.anchor) state.anchor = data.anchor;
          if (!state.expanded && data && Number(data.maxSlotCount) <= DEFAULT_ROWS) {
            state.expanded = false;
          }
          renderGrid();
        })
        .catch(function (err) {
          if (mount) {
            mount.innerHTML =
              '<p class="admin-msg admin-msg--error">' +
              esc((err && err.message) || "상영시간표를 불러오지 못했습니다.") +
              "</p>";
          }
        })
        .finally(function () {
          state.loading = false;
          setNavDisabled(false);
        });
    }

    renderShell();
    loadWeek();
  });
})();

(function () {
  if (!window.TiAdminAuth.require()) return;

  TiAdminLayout.mount("special", "기획전·행사 관리");
  var el = TiAdminLayout.contentEl();
  var state = { kind: "", q: "", page: 1, pageSize: 20 };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function kindLabel(k) {
    return k === "event" ? "행사" : "기획전";
  }

  function renderList(data) {
    var rows = (data.items || [])
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" +
          esc(item.publicId) +
          "</td>" +
          "<td>" +
          kindLabel(item.kind) +
          "</td>" +
          "<td>" +
          esc(item.title) +
          "</td>" +
          "<td>" +
          esc(item.dateLabel) +
          "</td>" +
          '<td class="actions">' +
          '<a class="admin-btn" href="special-edit.html?id=' +
          encodeURIComponent(item.publicId) +
          '">수정</a>' +
          '<button type="button" class="admin-btn admin-btn--danger" data-del="' +
          esc(item.publicId) +
          '">삭제</button>' +
          "</td></tr>"
        );
      })
      .join("");

    el.innerHTML =
      '<div class="admin-toolbar">' +
      '<select id="spKind"><option value="">전체</option><option value="exhibition">기획전</option><option value="event">행사</option></select>' +
      '<input type="search" id="spSearch" placeholder="제목·ID 검색" value="' +
      esc(state.q) +
      '">' +
      '<button type="button" class="admin-btn admin-btn--primary" id="spSearchBtn">검색</button>' +
      '<a class="admin-btn admin-btn--primary" href="special-edit.html">+ 추가</a>' +
      "</div>" +
      '<div class="admin-table-wrap"><table class="admin-table">' +
      "<thead><tr><th>ID</th><th>구분</th><th>제목</th><th>일정</th><th></th></tr></thead><tbody>" +
      (rows || '<tr><td colspan="5">데이터 없음</td></tr>') +
      "</tbody></table></div>" +
      '<div class="admin-pager"><button type="button" class="admin-btn" id="spPrev"' +
      (data.page <= 1 ? " disabled" : "") +
      ">이전</button><span>" +
      data.page +
      " / " +
      data.totalPages +
      " (총 " +
      data.total +
      "건)</span>" +
      '<button type="button" class="admin-btn" id="spNext"' +
      (data.page >= data.totalPages ? " disabled" : "") +
      ">다음</button></div>";

    document.getElementById("spKind").value = state.kind;
    document.getElementById("spSearchBtn").onclick = function () {
      state.kind = document.getElementById("spKind").value;
      state.q = document.getElementById("spSearch").value.trim();
      state.page = 1;
      load();
    };
    document.getElementById("spPrev").onclick = function () {
      state.page--;
      load();
    };
    document.getElementById("spNext").onclick = function () {
      state.page++;
      load();
    };
    el.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-del");
        if (!confirm(id + " 을(를) 삭제할까요?")) return;
        TiAdminApi.deleteSpecial(id)
          .then(function () {
            load();
          })
          .catch(function (err) {
            alert(err.message);
          });
      };
    });
  }

  function load() {
    el.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getSpecialList(state.kind || undefined, state.q, state.page, state.pageSize)
      .then(renderList)
      .catch(function (err) {
        el.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }

  load();
})();

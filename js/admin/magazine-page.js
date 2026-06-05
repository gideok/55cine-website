(function () {
  if (!window.TiAdminAuth.require()) return;

  TiAdminLayout.mount("magazine", "매거진 삼삼오오 관리");
  var el = TiAdminLayout.contentEl();
  var state = { section: "", isPast: false, q: "", page: 1, pageSize: 20 };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sectionLabel(s, isPast) {
    if (isPast) return "지난기사";
    if (s === "serial") return "연재";
    if (s === "gv-moment") return "GV모먼트";
    return "프리뷰";
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
          sectionLabel(item.section, item.isPast) +
          "</td>" +
          "<td>" +
          esc(item.title) +
          "</td>" +
          "<td>" +
          esc(item.movieTitle) +
          "</td>" +
          "<td>" +
          esc(item.publishedLabel) +
          "</td>" +
          '<td class="actions">' +
          '<a class="admin-btn" href="magazine-edit.html?id=' +
          encodeURIComponent(item.publicId) +
          '">수정</a>' +
          (!item.isPast
            ? '<button type="button" class="admin-btn" data-past="' +
              esc(item.publicId) +
              '">지난기사</button>'
            : "") +
          '<button type="button" class="admin-btn admin-btn--danger" data-del="' +
          esc(item.publicId) +
          '">삭제</button>' +
          "</td></tr>"
        );
      })
      .join("");

    el.innerHTML =
      '<div class="admin-toolbar">' +
      '<select id="mzFilter">' +
      '<option value="">프리뷰</option>' +
      '<option value="serial">연재</option>' +
      '<option value="gv-moment">GV모먼트</option>' +
      '<option value="past">지난기사</option>' +
      "</select>" +
      '<input type="search" id="mzSearch" placeholder="제목·ID 검색" value="' +
      esc(state.q) +
      '">' +
      '<button type="button" class="admin-btn admin-btn--primary" id="mzSearchBtn">검색</button>' +
      '<a class="admin-btn admin-btn--primary" href="magazine-edit.html">+ 추가</a>' +
      "</div>" +
      '<div class="admin-table-wrap"><table class="admin-table">' +
      "<thead><tr><th>ID</th><th>구분</th><th>제목</th><th>영화제목</th><th>게시일</th><th></th></tr></thead><tbody>" +
      (rows || '<tr><td colspan="6">데이터 없음</td></tr>') +
      "</tbody></table></div>" +
      '<div class="admin-pager"><button type="button" class="admin-btn" id="mzPrev"' +
      (data.page <= 1 ? " disabled" : "") +
      ">이전</button><span>" +
      data.page +
      " / " +
      data.totalPages +
      " (총 " +
      data.total +
      "건)</span>" +
      '<button type="button" class="admin-btn" id="mzNext"' +
      (data.page >= data.totalPages ? " disabled" : "") +
      ">다음</button></div>";

    var filterVal = state.isPast ? "past" : state.section || "";
    document.getElementById("mzFilter").value = filterVal;
    document.getElementById("mzSearchBtn").onclick = function () {
      var v = document.getElementById("mzFilter").value;
      state.isPast = v === "past";
      state.section = state.isPast ? "" : v || "preview";
      state.q = document.getElementById("mzSearch").value.trim();
      state.page = 1;
      load();
    };
    document.getElementById("mzPrev").onclick = function () {
      state.page--;
      load();
    };
    document.getElementById("mzNext").onclick = function () {
      state.page++;
      load();
    };
    el.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-del");
        if (!confirm(id + " 을(를) 삭제할까요?")) return;
        TiAdminApi.deleteMagazine(id).then(load).catch(function (err) {
          alert(err.message);
        });
      };
    });
    el.querySelectorAll("[data-past]").forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute("data-past");
        if (!confirm(id + " 을(를) 지난기사로 이동할까요? (public_id가 pa### 로 변경됩니다)"))
          return;
        TiAdminApi.markMagazinePast(id)
          .then(function (res) {
            alert("지난기사 처리됨: " + res.publicId);
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
    TiAdminApi.getMagazineList({
      section: state.isPast ? undefined : state.section || "preview",
      isPast: state.isPast,
      q: state.q,
      page: state.page,
      pageSize: state.pageSize
    })
      .then(renderList)
      .catch(function (err) {
        el.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }

  load();
})();

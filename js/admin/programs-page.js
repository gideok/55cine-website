(function () {
  if (!window.TiAdminAuth.require()) return;

  TiAdminLayout.mount("programs", "상영작 관리");
  var el = TiAdminLayout.contentEl();
  var state = { q: "", page: 1, pageSize: 20, editing: null };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderList(data) {
    var rows = (data.items || [])
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" +
          item.seq +
          "</td>" +
          "<td>" +
          item.progId +
          "</td>" +
          "<td>" +
          esc(item.titleKo) +
          "</td>" +
          "<td>" +
          esc(item.titleEn) +
          "</td>" +
          "<td>" +
          esc(item.slug) +
          "</td>" +
          "<td>" +
          esc(item.dateOpen) +
          " ~ " +
          esc(item.dateClose) +
          "</td>" +
          '<td class="actions"><button type="button" class="admin-btn" data-edit="' +
          item.seq +
          '">수정</button></td>' +
          "</tr>"
        );
      })
      .join("");

    el.innerHTML =
      '<div class="admin-toolbar">' +
      '<input type="search" id="progSearch" placeholder="제목·영제·slug 검색" value="' +
      esc(state.q) +
      '">' +
      '<button type="button" class="admin-btn admin-btn--primary" id="progSearchBtn">검색</button>' +
      "</div>" +
      '<div class="admin-table-wrap"><table class="admin-table">' +
      "<thead><tr><th>seq</th><th>prog_id</th><th>한글제목</th><th>영제</th><th>slug</th><th>상영기간</th><th></th></tr></thead>" +
      "<tbody>" +
      (rows || '<tr><td colspan="7">데이터 없음</td></tr>') +
      "</tbody></table></div>" +
      '<div class="admin-pager">' +
      '<button type="button" class="admin-btn" id="progPrev"' +
      (data.page <= 1 ? " disabled" : "") +
      ">이전</button>" +
      "<span>" +
      data.page +
      " / " +
      data.totalPages +
      " (총 " +
      data.total +
      "건)</span>" +
      '<button type="button" class="admin-btn" id="progNext"' +
      (data.page >= data.totalPages ? " disabled" : "") +
      ">다음</button>" +
      "</div>" +
      '<div id="progFormArea"></div>';

    document.getElementById("progSearchBtn").onclick = function () {
      state.q = document.getElementById("progSearch").value.trim();
      state.page = 1;
      load();
    };
    document.getElementById("progPrev").onclick = function () {
      state.page--;
      load();
    };
    document.getElementById("progNext").onclick = function () {
      state.page++;
      load();
    };
    el.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.onclick = function () {
        openEdit(Number(btn.getAttribute("data-edit")));
      };
    });
  }

  function openEdit(seq) {
    TiAdminApi.getProgram(seq).then(function (detail) {
      state.editing = detail;
      var area = document.getElementById("progFormArea");
      area.innerHTML =
        '<form class="admin-form" id="progForm">' +
        "<h2>상영작 수정 (seq " +
        detail.seq +
        ", prog_id " +
        detail.progId +
        ")</h2>" +
        '<p><strong>' +
        esc(detail.titleKo) +
        "</strong> / " +
        esc(detail.titleEn) +
        "</p>" +
        field("slug", "slug", detail.slug) +
        field("detailUrl", "detail_url", detail.detailUrl) +
        field("imgThumb", "썸네일 경로", detail.imgThumb) +
        field("img1", "포스터 img1", detail.img1) +
        field("director", "감독", detail.director) +
        field("castNames", "출연", detail.castNames) +
        field("info", "info", detail.info) +
        field("trailerUrl", "예고편 URL", detail.trailerUrl) +
        '<div class="field"><label>시놉시스</label><textarea name="synopsis">' +
        esc(detail.synopsis) +
        "</textarea></div>" +
        '<div class="admin-form-actions">' +
        '<button type="submit" class="admin-btn admin-btn--primary">저장</button>' +
        '<button type="button" class="admin-btn" id="progCancel">닫기</button>' +
        "</div></form>";

      document.getElementById("progCancel").onclick = function () {
        area.innerHTML = "";
      };
      document.getElementById("progForm").onsubmit = function (e) {
        e.preventDefault();
        var f = e.target;
        TiAdminApi.updateProgram(seq, {
          slug: f.slug.value,
          detailUrl: f.detailUrl.value || null,
          imgThumb: f.imgThumb.value || null,
          img1: f.img1.value || null,
          director: f.director.value || null,
          castNames: f.castNames.value || null,
          info: f.info.value || null,
          synopsis: f.synopsis.value || null,
          trailerUrl: f.trailerUrl.value || null
        })
          .then(function () {
            alert("저장되었습니다.");
            area.innerHTML = "";
            load();
          })
          .catch(function (err) {
            alert(err.message);
          });
      };
    });
  }

  function field(name, label, val) {
    return (
      '<div class="field"><label>' +
      label +
      '</label><input type="text" name="' +
      name +
      '" value="' +
      esc(val) +
      '"></div>'
    );
  }

  function load() {
    el.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getPrograms(state.q, state.page, state.pageSize)
      .then(renderList)
      .catch(function (err) {
        el.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }

  load();
})();

(function () {
  if (!window.TiAdminAuth.require()) return;

  TiAdminLayout.mount("notice", "공지사항 관리");
  var el = TiAdminLayout.contentEl();
  var listEl = null;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatLabel(item) {
    if (item.formatType === "image-text") return "이미지+텍스트";
    return "텍스트";
  }

  function statusBadge(item) {
    if (item.isActive) {
      return '<span class="admin-badge admin-badge--ok">활성</span>';
    }
    return '<span class="admin-badge admin-badge--muted">비활성</span>';
  }

  function bindActions(root) {
    if (!root) return;
    root.querySelectorAll("[data-notice-activate]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var seq = Number(btn.getAttribute("data-notice-activate"));
        if (!seq) return;
        if (!confirm("이 공지를 활성화하면 다른 공지는 모두 비활성화됩니다. 계속할까요?")) return;
        TiAdminApi.activateNotice(seq).then(loadList).catch(function (err) {
          alert(err.message || "활성화 실패");
        });
      });
    });
    root.querySelectorAll("[data-notice-deactivate]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var seq = Number(btn.getAttribute("data-notice-deactivate"));
        if (!seq) return;
        TiAdminApi.deactivateNotice(seq).then(loadList).catch(function (err) {
          alert(err.message || "비활성화 실패");
        });
      });
    });
    root.querySelectorAll("[data-notice-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var seq = Number(btn.getAttribute("data-notice-del"));
        if (!seq) return;
        if (!confirm("이 공지를 삭제할까요?")) return;
        TiAdminApi.deleteNotice(seq).then(loadList).catch(function (err) {
          alert(err.message || "삭제 실패");
        });
      });
    });
  }

  function renderList(data) {
    if (!listEl) return;
    var items = data.items || [];
    var rows = items
      .map(function (item) {
        return (
          "<tr" +
          (item.isActive ? ' class="admin-row--active"' : "") +
          ">" +
          "<td>" +
          item.seq +
          "</td>" +
          "<td>" +
          esc(item.title) +
          "</td>" +
          "<td>" +
          esc(formatLabel(item)) +
          "</td>" +
          "<td>" +
          item.contentWidth +
          "%</td>" +
          "<td>" +
          statusBadge(item) +
          "</td>" +
          "<td>" +
          esc(item.updatedAt ? item.updatedAt.slice(0, 10) : "") +
          "</td>" +
          '<td class="actions">' +
          '<a class="admin-btn" href="notice-edit.html?seq=' +
          encodeURIComponent(String(item.seq)) +
          '">수정</a> ' +
          (item.isActive
            ? '<button type="button" class="admin-btn" data-notice-deactivate="' +
              item.seq +
              '">비활성</button> '
            : '<button type="button" class="admin-btn admin-btn--primary" data-notice-activate="' +
              item.seq +
              '">활성화</button> ') +
          '<button type="button" class="admin-btn" data-notice-del="' +
          item.seq +
          '">삭제</button>' +
          "</td></tr>"
        );
      })
      .join("");

    listEl.innerHTML =
      '<p class="admin-lead">공지는 <strong>0개 또는 1개</strong>만 활성화할 수 있습니다. 활성 공지는 사이트 좌측 패널에 표시됩니다.</p>' +
      '<div class="admin-table-wrap"><table class="admin-table">' +
      "<thead><tr><th>seq</th><th>관리제목</th><th>형식</th><th>폭</th><th>상태</th><th>수정일</th><th></th></tr></thead>" +
      "<tbody>" +
      (rows || '<tr><td colspan="7">등록된 공지가 없습니다.</td></tr>') +
      "</tbody></table></div>";
    bindActions(listEl);
  }

  function loadList() {
    if (!listEl) return;
    listEl.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getNoticeList()
      .then(renderList)
      .catch(function (err) {
        listEl.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }

  el.innerHTML =
    '<div class="admin-toolbar admin-toolbar--split">' +
    '<div class="admin-toolbar__col admin-toolbar__col--action">' +
    '<a class="admin-btn admin-btn--primary" href="notice-edit.html">+ 공지 추가</a>' +
    "</div></div>" +
    '<div id="noticeListArea"></div>';

  listEl = document.getElementById("noticeListArea");
  loadList();
})();

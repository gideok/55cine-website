(function () {
  if (!window.TiAdminAuth.require()) return;

  var LIST_KEY = "programs";
  var STATE_FIELDS = ["q", "page", "pageSize"];
  var PAGER_PREFIX = "prog";

  TiAdminLayout.mount("programs", "상영작 관리");
  var el = TiAdminLayout.contentEl();
  var listEl = null;
  var searchTimer = null;
  var SEARCH_DELAY_MS = 350;
  var state = { q: "", page: 1, pageSize: 20 };

  TiAdminList.restoreState(LIST_KEY, state, STATE_FIELDS);

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function runSearch() {
    var input = document.getElementById("progSearch");
    state.q = input ? input.value.trim() : "";
    state.page = 1;
    loadList();
  }

  function scheduleSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, SEARCH_DELAY_MS);
  }

  function bindSearch() {
    var input = document.getElementById("progSearch");
    var btn = document.getElementById("progSearchBtn");
    if (!input) return;

    input.addEventListener("input", scheduleSearch);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (searchTimer) clearTimeout(searchTimer);
        runSearch();
      }
    });
    if (btn) {
      btn.addEventListener("click", function () {
        if (searchTimer) clearTimeout(searchTimer);
        runSearch();
      });
    }
  }

  function renderList(data) {
    if (!listEl) return;

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
          '<td class="actions">' +
          '<a class="admin-btn" data-admin-edit href="program-edit.html?seq=' +
          encodeURIComponent(String(item.seq)) +
          '">수정</a>' +
          "</td></tr>"
        );
      })
      .join("");

    listEl.innerHTML =
      '<div class="admin-table-wrap"><table class="admin-table">' +
      "<thead><tr><th>seq</th><th>prog_id</th><th>한글제목</th><th>영제</th><th>slug</th><th>상영기간</th><th></th></tr></thead>" +
      "<tbody>" +
      (rows || '<tr><td colspan="7">데이터 없음</td></tr>') +
      "</tbody></table></div>" +
      TiAdminList.renderPagerHtml(data, PAGER_PREFIX);

    TiAdminList.bindPager(PAGER_PREFIX, state, data, loadList);
    TiAdminList.bindEditLinks(listEl, LIST_KEY, state);
  }

  function loadList() {
    if (!listEl) return;
    TiAdminList.persist(LIST_KEY, state);
    TiAdminList.syncUrl("programs.html", LIST_KEY, state, STATE_FIELDS);
    listEl.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getPrograms(state.q, state.page, state.pageSize)
      .then(renderList)
      .catch(function (err) {
        listEl.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }

  function mountShell() {
    el.innerHTML =
      '<div class="admin-toolbar">' +
      '<input type="search" id="progSearch" placeholder="제목·영제·slug 검색" value="' +
      esc(state.q) +
      '" autocomplete="off">' +
      '<button type="button" class="admin-btn admin-btn--primary" id="progSearchBtn">검색</button>' +
      "</div>" +
      '<div id="progListArea"></div>';

    listEl = document.getElementById("progListArea");
    bindSearch();
    loadList();
  }

  mountShell();
})();

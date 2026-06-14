(function () {
  if (!window.TiAdminAuth.require()) return;

  var LIST_KEY = "programs";
  var STATE_FIELDS = ["q", "page", "pageSize", "desktopOnly"];
  var PAGER_PREFIX = "prog";

  TiAdminLayout.mount("programs", "상영작 관리");
  var el = TiAdminLayout.contentEl();
  var listEl = null;
  var searchTimer = null;
  var SEARCH_DELAY_MS = 350;
  var state = { q: "", page: 1, pageSize: 20, desktopOnly: false };

  TiAdminList.restoreState(LIST_KEY, state, STATE_FIELDS);

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function editUrl(item) {
    if (item.seq) {
      return "program-edit.html?seq=" + encodeURIComponent(String(item.seq));
    }
    return "program-edit.html?progId=" + encodeURIComponent(String(item.progId));
  }

  function webStatusBadge(item) {
    if (item.hasWebProgram) {
      return '<span class="admin-badge admin-badge--ok">웹 등록</span>';
    }
    return '<span class="admin-badge admin-badge--warn">데스크톱만</span>';
  }

  function updateFilterUi() {
    var allBtn = document.getElementById("progFilterAll");
    var desktopBtn = document.getElementById("progFilterDesktop");
    if (!allBtn || !desktopBtn) return;
    allBtn.classList.toggle("is-active", !state.desktopOnly);
    desktopBtn.classList.toggle("is-active", !!state.desktopOnly);
    allBtn.setAttribute("aria-pressed", state.desktopOnly ? "false" : "true");
    desktopBtn.setAttribute("aria-pressed", state.desktopOnly ? "true" : "false");
  }

  function setDesktopOnlyFilter(desktopOnly) {
    state.desktopOnly = !!desktopOnly;
    state.page = 1;
    updateFilterUi();
    loadList();
  }

  function bindFilterToggle() {
    var allBtn = document.getElementById("progFilterAll");
    var desktopBtn = document.getElementById("progFilterDesktop");
    if (allBtn) {
      allBtn.addEventListener("click", function () {
        setDesktopOnlyFilter(false);
      });
    }
    if (desktopBtn) {
      desktopBtn.addEventListener("click", function () {
        setDesktopOnlyFilter(true);
      });
    }
    updateFilterUi();
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
        var actionLabel = item.hasWebProgram ? "수정" : "추가정보 입력";
        return (
          "<tr" +
          (item.hasWebProgram ? "" : ' class="admin-row--pending"') +
          ">" +
          "<td>" +
          (item.seq != null ? item.seq : "—") +
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
          webStatusBadge(item) +
          "</td>" +
          "<td>" +
          esc(item.slug || "—") +
          "</td>" +
          "<td>" +
          esc(item.dateOpen) +
          " ~ " +
          esc(item.dateClose) +
          "</td>" +
          '<td class="actions">' +
          '<a class="admin-btn' +
          (item.hasWebProgram ? "" : " admin-btn--primary") +
          '" data-admin-edit href="' +
          esc(editUrl(item)) +
          '">' +
          actionLabel +
          "</a>" +
          "</td></tr>"
        );
      })
      .join("");

    var emptyMsg = state.desktopOnly
      ? "데스크톱만 등록된 상영작이 없습니다."
      : "데이터 없음";

    listEl.innerHTML =
      '<div class="admin-table-wrap"><table class="admin-table">' +
      "<thead><tr><th>seq</th><th>prog_id</th><th>한글제목</th><th>영제</th><th>웹</th><th>slug</th><th>상영기간</th><th></th></tr></thead>" +
      "<tbody>" +
      (rows || '<tr><td colspan="8">' + emptyMsg + "</td></tr>") +
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
    TiAdminApi.getPrograms(state.q, state.page, state.pageSize, state.desktopOnly)
      .then(renderList)
      .catch(function (err) {
        listEl.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }

  function mountShell() {
    el.innerHTML =
      '<p class="admin-lead">데스크톱(<code>prog_base</code>)에 등록된 상영작 목록입니다. <strong>데스크톱만</strong> 필터로 웹 미등록 항목만 볼 수 있습니다.</p>' +
      '<div class="admin-toolbar admin-toolbar--split">' +
      '<div class="admin-toolbar__col admin-toolbar__col--filter">' +
      '<div class="admin-segment" role="group" aria-label="등록 상태 필터">' +
      '<button type="button" class="admin-segment__btn" id="progFilterAll">전체</button>' +
      '<button type="button" class="admin-segment__btn" id="progFilterDesktop">데스크톱만</button>' +
      "</div></div>" +
      '<div class="admin-toolbar__col admin-toolbar__col--search">' +
      '<input type="search" id="progSearch" placeholder="제목·영제·prog_id·slug 검색" value="' +
      esc(state.q) +
      '" autocomplete="off">' +
      '<button type="button" class="admin-btn admin-btn--primary" id="progSearchBtn">검색</button>' +
      "</div></div>" +
      '<div id="progListArea"></div>';

    listEl = document.getElementById("progListArea");
    bindFilterToggle();
    bindSearch();
    loadList();
  }

  mountShell();
})();

(function () {
  TiAdminAuth.guard(function () {

  var LIST_KEY = "special";
  var STATE_FIELDS = ["kind", "q", "page", "pageSize"];
  var PAGER_PREFIX = "sp";

  TiAdminLayout.mount("special", "기획전·행사 관리");
  var el = TiAdminLayout.contentEl();
  var listEl = null;
  var searchTimer = null;
  var SEARCH_DELAY_MS = 350;
  var state = { kind: "", q: "", page: 1, pageSize: 20 };

  TiAdminList.restoreState(LIST_KEY, state, STATE_FIELDS);

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

  function applyFilterFromUi() {
    state.kind = document.getElementById("spKind").value;
    state.q = document.getElementById("spSearch").value.trim();
    state.page = 1;
    loadList();
  }

  function scheduleSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = document.getElementById("spSearch").value.trim();
      state.page = 1;
      loadList();
    }, SEARCH_DELAY_MS);
  }

  function bindToolbar() {
    var kind = document.getElementById("spKind");
    var search = document.getElementById("spSearch");
    var btn = document.getElementById("spSearchBtn");
    var addLink = document.getElementById("spAddLink");

    if (kind) {
      kind.value = state.kind;
      kind.onchange = applyFilterFromUi;
    }
    if (search) {
      search.addEventListener("input", scheduleSearch);
      search.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (searchTimer) clearTimeout(searchTimer);
          applyFilterFromUi();
        }
      });
    }
    if (btn) {
      btn.onclick = function () {
        if (searchTimer) clearTimeout(searchTimer);
        applyFilterFromUi();
      };
    }
    if (addLink) {
      addLink.addEventListener("click", function () {
        TiAdminList.persist(LIST_KEY, state);
      });
    }
  }

  function collectPageSeqs(tbody) {
    return Array.prototype.map
      .call(tbody.querySelectorAll("tr[data-seq]"), function (tr) {
        return Number(tr.getAttribute("data-seq"));
      })
      .filter(function (n) {
        return Number.isInteger(n) && n > 0;
      });
  }

  function bindListDragDrop(tbody) {
    if (!tbody) return;
    var dragSeq = null;

    tbody.querySelectorAll("tr[data-seq]").forEach(function (row) {
      var handle = row.querySelector(".admin-mz-drag");
      if (!handle) return;

      handle.addEventListener("dragstart", function (e) {
        dragSeq = Number(row.getAttribute("data-seq"));
        row.classList.add("is-dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(dragSeq));
        }
      });

      handle.addEventListener("dragend", function () {
        row.classList.remove("is-dragging");
        tbody.querySelectorAll(".is-drag-over").forEach(function (el) {
          el.classList.remove("is-drag-over");
        });
        dragSeq = null;
      });

      row.addEventListener("dragover", function (e) {
        if (dragSeq == null) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        row.classList.add("is-drag-over");
      });

      row.addEventListener("dragleave", function () {
        row.classList.remove("is-drag-over");
      });

      row.addEventListener("drop", function (e) {
        e.preventDefault();
        row.classList.remove("is-drag-over");
        var targetSeq = Number(row.getAttribute("data-seq"));
        if (!dragSeq || !targetSeq || dragSeq === targetSeq) return;

        var fromRow = tbody.querySelector('tr[data-seq="' + dragSeq + '"]');
        if (!fromRow || fromRow === row) return;

        var rect = row.getBoundingClientRect();
        var before = e.clientY < rect.top + rect.height / 2;
        if (before) tbody.insertBefore(fromRow, row);
        else tbody.insertBefore(fromRow, row.nextSibling);

        var seqs = collectPageSeqs(tbody);
        TiAdminApi.reorderSpecialList(seqs)
          .then(function () {
            loadList();
          })
          .catch(function (err) {
            alert(err.message || "순서 변경에 실패했습니다.");
            loadList();
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
          '<tr data-seq="' +
          item.seq +
          '">' +
          '<td class="admin-mz-drag-cell">' +
          '<button type="button" class="admin-mz-drag" draggable="true" aria-label="순서 변경" title="드래그하여 순서 변경">⋮⋮</button>' +
          "</td>" +
          "<td>" +
          item.seq +
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
          '<a class="admin-btn" data-admin-edit href="special-edit.html?seq=' +
          encodeURIComponent(String(item.seq)) +
          '">수정</a>' +
          '<button type="button" class="admin-btn admin-btn--danger" data-del="' +
          item.seq +
          '">삭제</button>' +
          "</td></tr>"
        );
      })
      .join("");

    listEl.innerHTML =
      '<p class="field-hint admin-mz-order-hint">왼쪽 ⋮⋮ 핸들을 드래그하여 목록 순서를 변경할 수 있습니다. (현재 페이지 기준)</p>' +
      '<div class="admin-table-wrap"><table class="admin-table admin-table--mz-order">' +
      '<thead><tr><th class="admin-mz-drag-cell"></th><th>seq</th><th>구분</th><th>제목</th><th>일정</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6">데이터 없음</td></tr>') +
      "</tbody></table></div>" +
      TiAdminList.renderPagerHtml(data, PAGER_PREFIX);

    TiAdminList.bindPager(PAGER_PREFIX, state, data, loadList);
    TiAdminList.bindEditLinks(listEl, LIST_KEY, state);
    bindListDragDrop(listEl.querySelector("tbody"));

    listEl.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.onclick = function () {
        var seq = Number(btn.getAttribute("data-del"));
        if (!confirm("seq " + seq + " 을(를) 삭제할까요?")) return;
        TiAdminApi.deleteSpecial(seq)
          .then(function () {
            loadList();
          })
          .catch(function (err) {
            alert(err.message);
          });
      };
    });
  }

  function loadList() {
    if (!listEl) return;
    TiAdminList.persist(LIST_KEY, state);
    TiAdminList.syncUrl("special.html", LIST_KEY, state, STATE_FIELDS);
    listEl.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getSpecialList(state.kind || undefined, state.q, state.page, state.pageSize)
      .then(renderList)
      .catch(function (err) {
        listEl.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }

  function mountShell() {
    el.innerHTML =
      '<div class="admin-toolbar admin-toolbar--split">' +
      '<div class="admin-toolbar__col admin-toolbar__col--filter">' +
      '<select id="spKind"><option value="">전체</option><option value="exhibition">기획전</option><option value="event">행사</option></select>' +
      "</div>" +
      '<div class="admin-toolbar__col admin-toolbar__col--search">' +
      '<input type="search" id="spSearch" placeholder="제목·seq 검색" value="' +
      esc(state.q) +
      '" autocomplete="off">' +
      '<button type="button" class="admin-btn admin-btn--primary" id="spSearchBtn">검색</button>' +
      "</div>" +
      '<div class="admin-toolbar__col admin-toolbar__col--action">' +
      '<a class="admin-btn admin-btn--primary" href="special-edit.html" id="spAddLink">+ 추가</a>' +
      "</div></div>" +
      '<div id="spListArea"></div>';

    listEl = document.getElementById("spListArea");
    bindToolbar();
    loadList();
  }

  mountShell();
  });
})();

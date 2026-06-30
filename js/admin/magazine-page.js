(function () {
  if (!window.TiAdminAuth.require()) return;

  var LIST_KEY = "magazine";
  var STATE_FIELDS = ["section", "isPast", "q", "page", "pageSize"];
  var PAGER_PREFIX = "mz";

  TiAdminLayout.mount("magazine", "매거진 삼삼오오 관리");
  var el = TiAdminLayout.contentEl();
  var listEl = null;
  var searchTimer = null;
  var SEARCH_DELAY_MS = 350;
  var state = { section: "preview", isPast: false, q: "", page: 1, pageSize: 20 };
  var restoreModalSeq = null;

  TiAdminList.restoreState(LIST_KEY, state, STATE_FIELDS);
  if (!state.isPast && !state.section) state.section = "preview";

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

  function applyFilterFromUi() {
    var v = document.getElementById("mzFilter").value;
    state.isPast = v === "past";
    state.section = state.isPast ? "" : v || "preview";
    state.q = document.getElementById("mzSearch").value.trim();
    state.page = 1;
    loadList();
  }

  function scheduleSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = document.getElementById("mzSearch").value.trim();
      state.page = 1;
      loadList();
    }, SEARCH_DELAY_MS);
  }

  function bindToolbar() {
    var filter = document.getElementById("mzFilter");
    var search = document.getElementById("mzSearch");
    var btn = document.getElementById("mzSearchBtn");
    var addLink = document.getElementById("mzAddLink");

    if (filter) {
      filter.value = state.isPast ? "past" : state.section || "preview";
      filter.onchange = applyFilterFromUi;
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
          '<a class="admin-btn" data-admin-edit href="magazine-edit.html?seq=' +
          encodeURIComponent(String(item.seq)) +
          '">수정</a>' +
          (!item.isPast
            ? '<button type="button" class="admin-btn" data-past="' +
              item.seq +
              '">지난기사</button>'
            : '<button type="button" class="admin-btn" data-restore="' +
              item.seq +
              '">복원</button>') +
          '<button type="button" class="admin-btn admin-btn--danger" data-del="' +
          item.seq +
          '">삭제</button>' +
          "</td></tr>"
        );
      })
      .join("");

    listEl.innerHTML =
      '<div class="admin-table-wrap"><table class="admin-table">' +
      "<thead><tr><th>seq</th><th>구분</th><th>제목</th><th>영화제목</th><th>게시일</th><th></th></tr></thead><tbody>" +
      (rows || '<tr><td colspan="6">데이터 없음</td></tr>') +
      "</tbody></table></div>" +
      TiAdminList.renderPagerHtml(data, PAGER_PREFIX);

    TiAdminList.bindPager(PAGER_PREFIX, state, data, loadList);
    TiAdminList.bindEditLinks(listEl, LIST_KEY, state);

    listEl.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.onclick = function () {
        var seq = Number(btn.getAttribute("data-del"));
        if (!confirm("seq " + seq + " 을(를) 삭제할까요?")) return;
        TiAdminApi.deleteMagazine(seq).then(loadList).catch(function (err) {
          alert(err.message);
        });
      };
    });
    listEl.querySelectorAll("[data-past]").forEach(function (btn) {
      btn.onclick = function () {
        var seq = Number(btn.getAttribute("data-past"));
        if (!confirm("seq " + seq + " 을(를) 지난기사로 이동할까요?")) return;
        TiAdminApi.markMagazinePast(seq)
          .then(function (res) {
            alert("지난기사 처리됨: seq " + res.seq);
            loadList();
          })
          .catch(function (err) {
            alert(err.message);
          });
      };
    });
    listEl.querySelectorAll("[data-restore]").forEach(function (btn) {
      btn.onclick = function () {
        openRestoreModal(Number(btn.getAttribute("data-restore")));
      };
    });
  }

  function ensureRestoreModal() {
    var modal = document.getElementById("mzRestoreModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "mzRestoreModal";
    modal.className = "admin-modal admin-modal--restore";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="admin-modal__backdrop" data-restore-close></div>' +
      '<div class="admin-modal__dialog admin-modal__dialog--narrow" role="dialog" aria-modal="true" aria-labelledby="mzRestoreTitle">' +
      '<header class="admin-modal__head">' +
      '<h2 id="mzRestoreTitle">지난기사 복원</h2>' +
      '<button type="button" class="admin-modal__close" data-restore-close aria-label="닫기">&times;</button>' +
      "</header>" +
      '<div class="admin-modal__body admin-restore-body">' +
      '<p class="admin-restore-msg" id="mzRestoreDesc"></p>' +
      '<div class="admin-restore-field field">' +
      '<label for="mzRestoreSection">복원 카테고리</label>' +
      '<select id="mzRestoreSection" class="admin-restore-select">' +
      '<option value="preview">프리뷰</option>' +
      '<option value="serial">연재</option>' +
      '<option value="gv-moment">GV모먼트</option>' +
      "</select>" +
      '<p class="field-hint">복원 후 선택한 카테고리 목록·상세 페이지에 다시 노출됩니다.</p>' +
      "</div></div>" +
      '<footer class="admin-modal__footer">' +
      '<div class="admin-form-actions admin-form-actions--modal">' +
      '<button type="button" class="admin-btn" data-restore-close>취소</button>' +
      '<button type="button" class="admin-btn admin-btn--primary" id="mzRestoreConfirm">복원</button>' +
      "</div></footer></div>";
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-restore-close]").forEach(function (el) {
      el.addEventListener("click", closeRestoreModal);
    });

    document.getElementById("mzRestoreConfirm").onclick = confirmRestoreModal;

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeRestoreModal();
    });

    return modal;
  }

  function openRestoreModal(seq) {
    restoreModalSeq = seq;
    var modal = ensureRestoreModal();
    var desc = document.getElementById("mzRestoreDesc");
    if (desc) {
      desc.textContent =
        "seq " + seq + " 기사를 지난기사에서 해제하고, 아래 카테고리로 복원합니다.";
    }
    var sectionSelect = document.getElementById("mzRestoreSection");
    if (sectionSelect) sectionSelect.value = "preview";
    modal.hidden = false;
    document.body.classList.add("admin-modal-open");
    if (sectionSelect) sectionSelect.focus();
  }

  function closeRestoreModal() {
    restoreModalSeq = null;
    var modal = document.getElementById("mzRestoreModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("admin-modal-open");
  }

  function confirmRestoreModal() {
    if (!restoreModalSeq) return;
    var sectionSelect = document.getElementById("mzRestoreSection");
    var section = sectionSelect ? sectionSelect.value : "preview";
    var label = sectionLabel(section, false);
    if (!confirm("seq " + restoreModalSeq + " 을(를) 「" + label + "」로 복원할까요?")) {
      return;
    }

    var btn = document.getElementById("mzRestoreConfirm");
    if (btn) btn.disabled = true;

    TiAdminApi.restoreMagazineFromPast(restoreModalSeq, section)
      .then(function (res) {
        alert("복원됨: seq " + res.seq + " → " + sectionLabel(res.section, false));
        closeRestoreModal();
        loadList();
      })
      .catch(function (err) {
        alert(err.message || "복원에 실패했습니다.");
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function loadList() {
    if (!listEl) return;
    TiAdminList.persist(LIST_KEY, state);
    TiAdminList.syncUrl("magazine.html", LIST_KEY, state, STATE_FIELDS);
    listEl.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getMagazineList({
      section: state.isPast ? undefined : state.section || "preview",
      isPast: state.isPast,
      q: state.q,
      page: state.page,
      pageSize: state.pageSize
    })
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
      '<select id="mzFilter">' +
      '<option value="preview">프리뷰</option>' +
      '<option value="serial">연재</option>' +
      '<option value="gv-moment">GV모먼트</option>' +
      '<option value="past">지난기사</option>' +
      "</select></div>" +
      '<div class="admin-toolbar__col admin-toolbar__col--search">' +
      '<input type="search" id="mzSearch" placeholder="제목·seq 검색" value="' +
      esc(state.q) +
      '" autocomplete="off">' +
      '<button type="button" class="admin-btn admin-btn--primary" id="mzSearchBtn">검색</button>' +
      "</div>" +
      '<div class="admin-toolbar__col admin-toolbar__col--action">' +
      '<a class="admin-btn admin-btn--primary" href="magazine-edit.html" id="mzAddLink">+ 추가</a>' +
      "</div></div>" +
      '<div id="mzListArea"></div>';

    listEl = document.getElementById("mzListArea");
    bindToolbar();
    loadList();
  }

  mountShell();
})();

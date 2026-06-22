/**
 * 상영작 추가 모달 — FormProgramSave AddNew 모드 대응
 */
(function (global) {
  var overlayEl = null;
  var formEl = null;
  var msgEl = null;
  var optionsCache = null;
  var onSavedCb = null;
  var isOpen = false;
  var isSaving = false;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function fieldSelect(id, label, name, required) {
    return (
      '<div class="field admin-form-grid__cell admin-form-grid__cell--half">' +
      "<label for=\"" +
      id +
      '">' +
      esc(label) +
      (required ? ' <span class="admin-req">*</span>' : "") +
      "</label>" +
      '<select id="' +
      id +
      '" name="' +
      name +
      '"' +
      (required ? " required" : "") +
      "></select></div>"
    );
  }

  function fieldInput(id, label, name, opts) {
    opts = opts || {};
    var type = opts.type || "text";
    var extra = opts.full ? " admin-form-grid__cell--full" : " admin-form-grid__cell--half";
    var attrs = "";
    if (opts.required) attrs += " required";
    if (opts.disabled) attrs += " disabled";
    if (opts.placeholder) attrs += ' placeholder="' + esc(opts.placeholder) + '"';
    if (opts.min != null) attrs += ' min="' + esc(String(opts.min)) + '"';
    if (opts.step != null) attrs += ' step="' + esc(String(opts.step)) + '"';
    return (
      '<div class="field admin-form-grid__cell' +
      extra +
      '">' +
      "<label for=\"" +
      id +
      '">' +
      esc(label) +
      (opts.required ? ' <span class="admin-req">*</span>' : "") +
      "</label>" +
      '<input type="' +
      type +
      '" id="' +
      id +
      '" name="' +
      (name || "") +
      '"' +
      attrs +
      ' autocomplete="off" /></div>'
    );
  }

  function comboOptionsHtml(items) {
    return (items || [])
      .map(function (item) {
        return (
          '<option value="' +
          esc(String(item.seqCode)) +
          '">' +
          esc(item.name) +
          "</option>"
        );
      })
      .join("");
  }

  function buildMarkup() {
    return (
      '<div class="admin-modal" id="progAddModal" hidden aria-hidden="true">' +
      '<div class="admin-modal__backdrop" data-prog-add-close></div>' +
      '<div class="admin-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="progAddModalTitle">' +
      '<header class="admin-modal__head">' +
      '<h2 id="progAddModalTitle">상영작 등록</h2>' +
      '<button type="button" class="admin-modal__close" data-prog-add-close aria-label="닫기">&times;</button>' +
      "</header>" +
      '<div class="admin-modal__body">' +
      '<div class="admin-msg" id="progAddMsg" hidden></div>' +
      '<form class="admin-form admin-form--modal" id="progAddForm" novalidate>' +
      '<div class="admin-form-grid">' +
      fieldInput("pbProgId", "ID", null, { disabled: true, placeholder: "자동 부여" }) +
      fieldSelect("pbDivScreen", "상영분류", "divScreen", true) +
      fieldInput("pbName", "영화명", "name", { full: true, required: true }) +
      fieldInput("pbName2", "영문제목", "name2", { full: true, required: true }) +
      fieldSelect("pbDivProg", "구분", "divProg", true) +
      fieldSelect("pbGrade", "관람등급", "grade", true) +
      fieldSelect("pbCountry", "국가", "country", true) +
      fieldInput("pbRunningTime", "상영시간(분)", "runningTime", { type: "number", min: 0, step: 1 }) +
      fieldInput("pbProducer", "제작", "producer") +
      fieldInput("pbDistributor", "배급", "distributor") +
      fieldSelect("pbSpecVideo", "비디오", "specVideo", true) +
      fieldSelect("pbSpecAudio", "오디오", "specAudio", true) +
      fieldSelect("pbSpecFormat", "포맷", "specFormat", true) +
      fieldInput("pbVolumn", "Volumn", "volumn") +
      fieldInput("pbDateOpen", "개봉일", "dateOpen", { type: "date", required: true }) +
      '<div class="field admin-form-grid__cell admin-form-grid__cell--half admin-form-grid__cell--date-close">' +
      '<label for="pbDateClose">종영일</label>' +
      '<div class="admin-inline-check">' +
      '<input type="checkbox" id="pbDateCloseEnabled" aria-label="종영일 사용" />' +
      '<input type="date" id="pbDateClose" name="dateClose" disabled />' +
      "</div></div>" +
      fieldSelect("pbDivState", "상영상태", "divState", true) +
      '<div class="field admin-form-grid__cell admin-form-grid__cell--full admin-form-grid__cell--url">' +
      '<label for="pbProgUrl">URL</label>' +
      '<div class="admin-input-with-btn">' +
      '<input type="url" id="pbProgUrl" name="progUrl" placeholder="https://" autocomplete="off" />' +
      '<button type="button" class="admin-btn" id="pbProgUrlOpen">열기</button>' +
      "</div></div>" +
      "</div>" +
      '<div class="admin-form-actions admin-form-actions--modal">' +
      '<button type="button" class="admin-btn" data-prog-add-close>취소</button>' +
      '<button type="submit" class="admin-btn admin-btn--primary" id="progAddSubmit">저장</button>' +
      "</div></form></div></div></div>"
    );
  }

  var COMBO_MAP = [
    { key: "divScreen", id: "pbDivScreen" },
    { key: "divProg", id: "pbDivProg" },
    { key: "grade", id: "pbGrade" },
    { key: "country", id: "pbCountry" },
    { key: "specVideo", id: "pbSpecVideo" },
    { key: "specAudio", id: "pbSpecAudio" },
    { key: "specFormat", id: "pbSpecFormat" },
    { key: "divState", id: "pbDivState" }
  ];

  function showMsg(text, isError) {
    if (!msgEl) return;
    if (!text) {
      msgEl.hidden = true;
      msgEl.textContent = "";
      msgEl.className = "admin-msg";
      return;
    }
    msgEl.hidden = false;
    msgEl.textContent = text;
    msgEl.className = "admin-msg" + (isError ? " admin-msg--error" : "");
  }

  function fillCombos(options) {
    COMBO_MAP.forEach(function (f) {
      var sel = document.getElementById(f.id);
      if (!sel || !options) return;
      sel.innerHTML = comboOptionsHtml(options[f.key]);
    });
  }

  function resetForm() {
    if (!formEl) return;
    formEl.reset();
    var dateOpen = document.getElementById("pbDateOpen");
    if (dateOpen) dateOpen.value = todayIso();
    var closeEnabled = document.getElementById("pbDateCloseEnabled");
    var dateClose = document.getElementById("pbDateClose");
    if (closeEnabled) closeEnabled.checked = false;
    if (dateClose) {
      dateClose.value = "";
      dateClose.disabled = true;
    }
    showMsg("");
  }

  function readForm(confirmDuplicate) {
    var getVal = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : "";
    };
    var getNum = function (id) {
      return Number(getVal(id));
    };
    var closeEnabled = document.getElementById("pbDateCloseEnabled");
    var dateClose = null;
    if (closeEnabled && closeEnabled.checked) {
      dateClose = getVal("pbDateClose") || null;
    }
    var runningRaw = getVal("pbRunningTime");
    return {
      name: getVal("pbName"),
      name2: getVal("pbName2"),
      divScreen: getNum("pbDivScreen"),
      divProg: getNum("pbDivProg"),
      grade: getNum("pbGrade"),
      country: getNum("pbCountry"),
      runningTime: runningRaw ? Number(runningRaw) : null,
      producer: getVal("pbProducer") || null,
      distributor: getVal("pbDistributor") || null,
      specVideo: getNum("pbSpecVideo"),
      specAudio: getNum("pbSpecAudio"),
      specFormat: getNum("pbSpecFormat"),
      volumn: getVal("pbVolumn") || null,
      dateOpen: getVal("pbDateOpen"),
      dateClose: dateClose,
      divState: getNum("pbDivState"),
      progUrl: getVal("pbProgUrl") || null,
      confirmDuplicate: !!confirmDuplicate
    };
  }

  function validateClient(body) {
    if (!body.name) return "영화명을 입력해 주세요.";
    if (!body.name2) return "영문제목을 입력해 주세요.";
    if (!body.dateOpen) return "개봉일을 입력해 주세요.";
    return "";
  }

  function closeModal() {
    if (!overlayEl) return;
    isOpen = false;
    overlayEl.hidden = true;
    overlayEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-modal-open");
  }

  function openModal() {
    if (!overlayEl) return;
    isOpen = true;
    overlayEl.hidden = false;
    overlayEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("admin-modal-open");
    resetForm();
    var nameInput = document.getElementById("pbName");
    if (nameInput) nameInput.focus();
  }

  function ensureOptions() {
    if (optionsCache) return Promise.resolve(optionsCache);
    return TiAdminApi.getProgramFormOptions().then(function (opts) {
      optionsCache = opts;
      fillCombos(opts);
      return opts;
    });
  }

  function saveWithConfirm(body) {
    isSaving = true;
    var submitBtn = document.getElementById("progAddSubmit");
    if (submitBtn) submitBtn.disabled = true;
    showMsg("저장 중…", false);

    return TiAdminApi.createProgBase(body)
      .then(function (result) {
        closeModal();
        if (typeof onSavedCb === "function") onSavedCb(result);
      })
      .catch(function (err) {
        if (err.message && err.message.indexOf("동일한 제목") >= 0 && !body.confirmDuplicate) {
          var ok = global.confirm(
            "동일한 제목의 영화가 등록되어 있습니다. 계속 등록하시겠습니까?"
          );
          if (ok) {
            body.confirmDuplicate = true;
            return saveWithConfirm(body);
          }
          showMsg("등록이 취소되었습니다.", true);
          return;
        }
        showMsg(err.message || "저장 실패", true);
      })
      .finally(function () {
        isSaving = false;
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function onSubmit(e) {
    e.preventDefault();
    if (isSaving) return;
    var body = readForm(false);
    var clientErr = validateClient(body);
    if (clientErr) {
      showMsg(clientErr, true);
      return;
    }
    showMsg("");
    saveWithConfirm(body);
  }

  function bindEvents() {
    overlayEl.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute("data-prog-add-close") != null) {
        closeModal();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!isOpen) return;
      if (e.key === "Escape") closeModal();
    });

    formEl.addEventListener("submit", onSubmit);

    var closeEnabled = document.getElementById("pbDateCloseEnabled");
    var dateClose = document.getElementById("pbDateClose");
    if (closeEnabled && dateClose) {
      closeEnabled.addEventListener("change", function () {
        dateClose.disabled = !closeEnabled.checked;
        if (!closeEnabled.checked) dateClose.value = "";
      });
    }

    var urlOpen = document.getElementById("pbProgUrlOpen");
    if (urlOpen) {
      urlOpen.addEventListener("click", function () {
        var url = document.getElementById("pbProgUrl");
        var val = url && url.value.trim();
        if (val) global.open(val, "_blank", "noopener,noreferrer");
      });
    }
  }

  function mount() {
    if (overlayEl) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = buildMarkup();
    overlayEl = wrap.firstElementChild;
    document.body.appendChild(overlayEl);
    formEl = document.getElementById("progAddForm");
    msgEl = document.getElementById("progAddMsg");
    bindEvents();
  }

  global.TiAdminProgramAddModal = {
    open: function (onSaved) {
      onSavedCb = onSaved || null;
      mount();
      ensureOptions()
        .then(openModal)
        .catch(function (err) {
          global.alert(err.message || "폼 옵션을 불러오지 못했습니다.");
        });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

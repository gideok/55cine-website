/**
 * 상영작 통합 등록/수정 모달 — prog_base + web_program
 */
(function (global) {
  var PROGRAM_POSTER_PLACEHOLDER = "images/schedule-poster-placeholder.svg";

  var overlayEl = null;
  var formEl = null;
  var msgEl = null;
  var titleEl = null;
  var optionsCache = null;
  var onSavedCb = null;
  var isOpen = false;
  var isSaving = false;
  var mode = "add";
  var detailRef = null;
  var slugAutoSync = true;
  var slugSyncSilent = false;

  var posterState = {
    img1Path: null,
    imgThumbPath: null,
    previewUrl: null,
    removed: false,
    uploading: false,
    pendingFile: null,
    kmdbPosterUrl: null
  };

  var kmdbPickerEl = null;
  var kmdbPickerListEl = null;
  var kmdbPickerItems = [];
  var guideEl = null;
  var guideMsgEl = null;
  var guideListEl = null;
  var guideFocusId = null;

  var REQUIRED_SELECTS = [
    { id: "pbDivScreen", label: "상영분류" },
    { id: "pbDivProg", label: "구분" },
    { id: "pbGrade", label: "관람등급" },
    { id: "pbCountry", label: "국가" },
    { id: "pbSpecVideo", label: "비디오" },
    { id: "pbSpecAudio", label: "오디오" },
    { id: "pbSpecFormat", label: "포맷" },
    { id: "pbDivState", label: "상영상태" }
  ];

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

  function resolveAssetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || /^blob:/i.test(path) || /^data:/i.test(path)) {
      return path;
    }
    var rel = String(path).replace(/^\//, "");
    if (global.TiSiteRoot && typeof global.TiSiteRoot.relativePrefix === "function") {
      return global.TiSiteRoot.relativePrefix() + rel;
    }
    if (global.TiSiteRoot && typeof global.TiSiteRoot.resolve === "function") {
      return global.TiSiteRoot.resolve(rel);
    }
    return "../" + rel;
  }

  function parseYoutubeVideoId(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    try {
      var url = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
      if (url.hostname === "youtu.be") {
        return url.pathname.replace(/^\//, "").split("/")[0].split("?")[0] || "";
      }
      if (/youtube\.com$/i.test(url.hostname) || /\.youtube\.com$/i.test(url.hostname)) {
        var fromQuery = url.searchParams.get("v");
        if (fromQuery) return fromQuery;
        var m = url.pathname.match(/\/(?:embed|shorts|v|live)\/([^/?]+)/i);
        if (m && m[1]) return m[1];
      }
    } catch (_e) {
      /* ignore */
    }
    return s;
  }

  function normalizeTrailerUrl(raw) {
    var id = parseYoutubeVideoId(raw);
    return id || null;
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

  function sectionTitle(text) {
    return '<h3 class="admin-form-section-title">' + esc(text) + "</h3>";
  }

  function buildMarkup() {
    return (
      '<div class="admin-modal admin-modal--program" id="progFormModal" hidden aria-hidden="true">' +
      '<div class="admin-modal__backdrop" data-prog-form-close></div>' +
      '<div class="admin-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="progFormModalTitle">' +
      '<header class="admin-modal__head">' +
      '<h2 id="progFormModalTitle">상영작 등록</h2>' +
      '<button type="button" class="admin-modal__close" data-prog-form-close aria-label="닫기">&times;</button>' +
      "</header>" +
      '<form class="admin-form admin-form--modal" id="progForm" novalidate>' +
      '<div class="admin-modal__scroll">' +
      '<div class="admin-meta-badges" id="progFormBadges" hidden></div>' +
      '<div class="admin-msg" id="progFormMsg" hidden></div>' +
      sectionTitle("기본 정보 (prog_base)") +
      '<div class="admin-form-grid">' +
      fieldInput("pbProgId", "ID", null, { disabled: true, placeholder: "자동 부여" }) +
      fieldSelect("pbDivScreen", "상영분류", "divScreen", true) +
      '<div class="field admin-form-grid__cell admin-form-grid__cell--full">' +
      '<label for="pbName">영화명 <span class="admin-req">*</span></label>' +
      '<div class="admin-input-with-btn">' +
      '<input type="text" id="pbName" name="name" required autocomplete="off" />' +
      '<button type="button" class="admin-btn" id="pbKmdbSearch">KMDB</button>' +
      "</div>" +
      '<p class="field-hint" id="pbKmdbHint">제목 입력 후 KMDB 버튼으로 영화 정보를 불러올 수 있습니다.</p></div>' +
      fieldInput("pbName2", "영문제목", "name2", { full: true }) +
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
      fieldInput("pbTotSc", "총상영회차", null, { disabled: true }) +
      fieldSelect("pbDivState", "상영상태", "divState", true) +
      '<div class="field admin-form-grid__cell admin-form-grid__cell--full admin-form-grid__cell--url">' +
      '<label for="pbProgUrl">URL</label>' +
      '<div class="admin-input-with-btn">' +
      '<input type="url" id="pbProgUrl" name="progUrl" placeholder="https://" autocomplete="off" />' +
      '<button type="button" class="admin-btn" id="pbProgUrlOpen">열기</button>' +
      "</div></div></div>" +
      sectionTitle("웹 노출 (web_program)") +
      '<div class="admin-form-grid">' +
      '<div class="field admin-form-grid__cell admin-form-grid__cell--full">' +
      '<label for="wpSlug" id="wpSlugLabel">slug <span class="admin-req" id="wpSlugReq" hidden>*</span></label>' +
      '<input type="text" id="wpSlug" name="slug" autocomplete="off" />' +
      "</div>" +
      fieldInput("wpDetailUrl", "detail_url", "detailUrl", { full: true }) +
      '<div class="field admin-form-grid__cell admin-form-grid__cell--full">' +
      "<label>포스터 이미지</label>" +
      '<input type="file" id="posterUpload" class="admin-sr-only-file" accept="image/*">' +
      '<label for="posterUpload" class="admin-btn admin-btn--upload admin-file-label" id="posterPickLabel">이미지 선택</label>' +
      '<p class="field-hint" id="posterHint">저장 후 seq가 생기면 wp_{seq}_1 로 업로드되고 40×40 썸네일이 자동 생성됩니다.</p>' +
      '<div class="admin-cover-preview" id="posterPreview">' +
      '<img id="posterPreviewImg" alt="포스터 미리보기">' +
      '<div class="admin-cover-preview__spinner" id="posterPreviewSpinner">' +
      '<span class="admin-spinner" aria-hidden="true"></span>' +
      '<span class="admin-cover-preview__spinner-label">업로드 중…</span>' +
      "</div>" +
      '<button type="button" class="admin-cover-delete" id="posterDeleteBtn" hidden>삭제</button>' +
      "</div></div>" +
      fieldInput("wpDirector", "감독", "director") +
      fieldInput("wpCastNames", "출연", "castNames") +
      fieldInput("wpInfo", "info", "info", { full: true }) +
      '<div class="field admin-form-grid__cell admin-form-grid__cell--full admin-form-grid__cell--trailer">' +
      '<label for="wpTrailerUrl">예고편 URL</label>' +
      '<input type="text" id="wpTrailerUrl" name="trailerUrl" autocomplete="off" />' +
      '<p class="field-hint">YouTube URL 입력 시 영상 ID만 저장됩니다.</p>' +
      "</div>" +
      '<div class="admin-youtube-preview admin-form-grid__cell admin-form-grid__cell--full" id="trailerPreview" hidden>' +
      '<iframe id="trailerPreviewFrame" title="예고편 미리보기" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>' +
      "</div>" +
      '<div class="field admin-form-grid__cell admin-form-grid__cell--full admin-form-grid__cell--synopsis">' +
      "<label for=\"wpSynopsis\">시놉시스</label>" +
      '<textarea id="wpSynopsis" name="synopsis" rows="6"></textarea>' +
      "</div></div>" +
      "</div>" +
      '<footer class="admin-modal__footer">' +
      '<div class="admin-form-actions admin-form-actions--modal">' +
      '<button type="button" class="admin-btn" data-prog-form-close>취소</button>' +
      '<button type="submit" class="admin-btn admin-btn--primary" id="progFormSubmit">저장</button>' +
      "</div></footer></form></div></div>" +
      '<div class="admin-modal admin-modal--kmdb-picker" id="kmdbPickerModal" hidden aria-hidden="true">' +
      '<div class="admin-modal__backdrop" data-kmdb-picker-close></div>' +
      '<div class="admin-modal__dialog admin-modal__dialog--narrow" role="dialog" aria-modal="true" aria-labelledby="kmdbPickerTitle">' +
      '<header class="admin-modal__head">' +
      '<h2 id="kmdbPickerTitle">KMDB 검색 결과</h2>' +
      '<button type="button" class="admin-modal__close" data-kmdb-picker-close aria-label="닫기">&times;</button>' +
      "</header>" +
      '<div class="admin-modal__scroll">' +
      '<p class="field-hint" id="kmdbPickerHint"></p>' +
      '<ul class="admin-kmdb-list" id="kmdbPickerList"></ul>' +
      "</div>" +
      '<footer class="admin-modal__footer">' +
      '<button type="button" class="admin-btn" data-kmdb-picker-close>취소</button>' +
      "</footer></div></div>" +
      '<div class="admin-modal admin-modal--guide" id="progFormGuideModal" hidden aria-hidden="true">' +
      '<div class="admin-modal__backdrop" data-prog-guide-close></div>' +
      '<div class="admin-modal__dialog admin-modal__dialog--narrow" role="alertdialog" aria-modal="true" aria-labelledby="progFormGuideTitle">' +
      '<header class="admin-modal__head">' +
      '<h2 id="progFormGuideTitle">입력 확인</h2>' +
      '<button type="button" class="admin-modal__close" data-prog-guide-close aria-label="닫기">&times;</button>' +
      "</header>" +
      '<div class="admin-modal__body">' +
      '<p class="admin-guide-msg" id="progFormGuideMsg"></p>' +
      '<ul class="admin-guide-list" id="progFormGuideList" hidden></ul>' +
      "</div>" +
      '<footer class="admin-modal__footer">' +
      '<div class="admin-form-actions admin-form-actions--modal">' +
      '<button type="button" class="admin-btn admin-btn--primary" data-prog-guide-close>확인</button>' +
      "</div></footer></div></div>"
    );
  }

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

  function closeGuide() {
    if (!guideEl) return;
    guideEl.hidden = true;
    guideEl.setAttribute("aria-hidden", "true");
    var focusId = guideFocusId;
    guideFocusId = null;
    if (focusId) {
      var target = document.getElementById(focusId);
      if (target) {
        target.focus();
        if (typeof target.select === "function" && target.tagName === "INPUT") {
          target.select();
        }
      }
    }
  }

  function showGuide(messages, focusId) {
    if (!guideEl || !guideMsgEl || !guideListEl) return;
    var items = (messages || []).filter(Boolean);
    if (!items.length) return;

    guideFocusId = focusId || null;
    if (items.length === 1) {
      guideMsgEl.textContent = items[0];
      guideMsgEl.hidden = false;
      guideListEl.innerHTML = "";
      guideListEl.hidden = true;
    } else {
      guideMsgEl.textContent = "아래 항목을 확인해 주세요.";
      guideMsgEl.hidden = false;
      guideListEl.innerHTML = items
        .map(function (msg) {
          return "<li>" + esc(msg) + "</li>";
        })
        .join("");
      guideListEl.hidden = false;
    }

    guideEl.hidden = false;
    guideEl.setAttribute("aria-hidden", "false");
    var confirmBtn = guideEl.querySelector("[data-prog-guide-close].admin-btn--primary");
    if (confirmBtn) confirmBtn.focus();
  }

  function isSelectMissing(id) {
    var el = document.getElementById(id);
    if (!el) return true;
    return el.value === "" || el.value == null;
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

  function fillCombos(options) {
    COMBO_MAP.forEach(function (f) {
      var sel = document.getElementById(f.id);
      if (!sel || !options) return;
      sel.innerHTML = comboOptionsHtml(options[f.key]);
    });
  }

  function setSelectValue(id, val) {
    var sel = document.getElementById(id);
    if (!sel || val == null || val === "") return;
    sel.value = String(val);
    if (sel.value !== String(val) && sel.options.length) {
      sel.selectedIndex = 0;
    }
  }

  function resetPosterState() {
    posterState = {
      img1Path: null,
      imgThumbPath: null,
      previewUrl: null,
      removed: false,
      uploading: false,
      pendingFile: null,
      kmdbPosterUrl: null
    };
  }

  function currentProgramSeq() {
    return detailRef && detailRef.seq ? detailRef.seq : null;
  }

  function updatePosterHint() {
    var hint = document.getElementById("posterHint");
    var seq = currentProgramSeq();
    if (!hint) return;
    hint.textContent = seq
      ? "저장 시 wp_" +
        seq +
        "_1 로 업로드되고, 40×40 썸네일(thumb_wp_)이 자동 생성됩니다. 시간표는 썸네일, 목록·상세는 원본을 사용합니다."
      : "웹 등록 저장 후 포스터를 업로드할 수 있습니다. 신규 등록 시 이미지를 선택해 두면 저장 직후 자동 업로드됩니다.";
  }

  function updatePosterPreview() {
    var wrap = document.getElementById("posterPreview");
    var img = document.getElementById("posterPreviewImg");
    var spinner = document.getElementById("posterPreviewSpinner");
    var deleteBtn = document.getElementById("posterDeleteBtn");
    if (!wrap || !img) return;

    var hasReal = false;
    var src = resolveAssetUrl(PROGRAM_POSTER_PLACEHOLDER);

    if (!posterState.removed) {
      if (posterState.previewUrl) {
        src = posterState.previewUrl;
        hasReal = true;
      } else if (posterState.img1Path) {
        src = resolveAssetUrl(posterState.img1Path);
        hasReal = true;
      } else if (posterState.kmdbPosterUrl) {
        src = posterState.kmdbPosterUrl;
        hasReal = true;
      } else if (posterState.pendingFile) {
        src = posterState.previewUrl || "";
        hasReal = !!src;
      }
    }

    img.src = src || resolveAssetUrl(PROGRAM_POSTER_PLACEHOLDER);
    img.classList.toggle("is-placeholder", !hasReal);
    if (spinner) spinner.classList.toggle("is-active", !!posterState.uploading);
    if (deleteBtn) deleteBtn.hidden = !hasReal || posterState.uploading;
    img.style.visibility = posterState.uploading ? "hidden" : "visible";
    wrap.hidden = false;
  }

  function setPosterUploading(loading) {
    posterState.uploading = !!loading;
    var pickLabel = document.getElementById("posterPickLabel");
    if (pickLabel) pickLabel.classList.toggle("is-disabled", loading);
    updatePosterPreview();
  }

  function updateTrailerPreview() {
    var input = document.getElementById("wpTrailerUrl");
    var wrap = document.getElementById("trailerPreview");
    var iframe = document.getElementById("trailerPreviewFrame");
    if (!input || !wrap || !iframe) return;
    var videoId = parseYoutubeVideoId(input.value);
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      wrap.hidden = true;
      iframe.removeAttribute("src");
      return;
    }
    wrap.hidden = false;
    iframe.src = "https://www.youtube.com/embed/" + encodeURIComponent(videoId);
  }

  function readProgBaseForm(confirmDuplicate) {
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
      volumn: getVal("pbVolumn"),
      dateOpen: getVal("pbDateOpen"),
      dateClose: dateClose,
      divState: getNum("pbDivState"),
      progUrl: getVal("pbProgUrl") || "",
      confirmDuplicate: !!confirmDuplicate
    };
  }

  function readWebForm() {
    var getVal = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : "";
    };
    var img1 = posterState.removed ? null : posterState.img1Path;
    var imgThumb = posterState.removed ? null : posterState.imgThumbPath;
    return {
      slug: getVal("wpSlug") || null,
      detailUrl: getVal("wpDetailUrl") || null,
      imgThumb: imgThumb,
      img1: img1,
      director: getVal("wpDirector") || null,
      castNames: getVal("wpCastNames") || null,
      info: getVal("wpInfo") || null,
      synopsis: getVal("wpSynopsis") || null,
      trailerUrl: normalizeTrailerUrl(getVal("wpTrailerUrl"))
    };
  }

  function validateClient() {
    var errors = [];
    var focusId = null;

    function addError(message, fieldId) {
      errors.push(message);
      if (!focusId && fieldId) focusId = fieldId;
    }

    var nameEl = document.getElementById("pbName");
    if (!nameEl || !nameEl.value.trim()) {
      addError("영화명을 입력해 주세요.", "pbName");
    }
    REQUIRED_SELECTS.forEach(function (field) {
      if (isSelectMissing(field.id)) {
        addError(field.label + "을(를) 선택해 주세요.", field.id);
      }
    });
    var dateOpenEl = document.getElementById("pbDateOpen");
    if (!dateOpenEl || !dateOpenEl.value.trim()) {
      addError("개봉일을 입력해 주세요.", "pbDateOpen");
    }
    if (mode === "add") {
      var slugEl = document.getElementById("wpSlug");
      if (!slugEl || !slugEl.value.trim()) {
        addError("slug를 입력해 주세요.", "wpSlug");
      }
    }
    return { errors: errors, focusId: focusId };
  }

  function buildSlugDuplicateMessage(slug, conflict) {
    var trimmed = String(slug || "").trim();
    var title = (conflict && conflict.titleKo) || "다른 상영작";
    var seq = conflict && conflict.seq != null ? conflict.seq : "—";
    return (
      'slug "' +
      trimmed +
      '"는 이미 등록된 상영작("' +
      title +
      '", seq ' +
      seq +
      ')과 중복됩니다.\nslug를 수정한 뒤 다시 저장해 주세요.'
    );
  }

  function checkSlugDuplicate(slug) {
    var trimmed = String(slug || "").trim();
    if (!trimmed) return Promise.resolve(null);
    var excludeSeq = detailRef && detailRef.seq ? detailRef.seq : null;
    return TiAdminApi.checkProgramDuplicateSlug(trimmed, excludeSeq).then(function (res) {
      if (!res || !res.duplicate) return null;
      return buildSlugDuplicateMessage(trimmed, res.conflict);
    });
  }

  function isSlugDuplicateError(message) {
    return !!message && (message.indexOf("slug") >= 0 || message.indexOf("중복") >= 0);
  }

  function updateKmdbUi() {
    var show = mode === "add";
    var kmdbBtn = document.getElementById("pbKmdbSearch");
    var kmdbHint = document.getElementById("pbKmdbHint");
    if (kmdbBtn) kmdbBtn.hidden = !show;
    if (kmdbHint) kmdbHint.hidden = !show;
    if (!show) closeKmdbPicker();
  }

  function updateSlugRequiredUi() {
    var isAdd = mode === "add";
    var req = document.getElementById("wpSlugReq");
    var input = document.getElementById("wpSlug");
    if (req) req.hidden = !isAdd;
    if (input) {
      if (isAdd) input.setAttribute("required", "");
      else input.removeAttribute("required");
    }
  }

  function slugFromTitleEn(titleEn) {
    return String(titleEn || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function syncSlugFromTitleEn() {
    if (!slugAutoSync) return;
    var name2El = document.getElementById("pbName2");
    var slugEl = document.getElementById("wpSlug");
    if (!name2El || !slugEl) return;
    slugSyncSilent = true;
    slugEl.value = slugFromTitleEn(name2El.value);
    slugSyncSilent = false;
  }

  function resetSlugAutoSyncState() {
    if (mode === "add") {
      slugAutoSync = true;
      return;
    }
    var name2El = document.getElementById("pbName2");
    var slugEl = document.getElementById("wpSlug");
    if (!slugEl) {
      slugAutoSync = true;
      return;
    }
    var slug = slugEl.value.trim();
    var expected = slugFromTitleEn(name2El ? name2El.value : "");
    slugAutoSync = !slug || slug === expected;
  }

  function updateBadges(detail) {
    var badges = document.getElementById("progFormBadges");
    if (!badges) return;
    if (!detail || mode === "add") {
      badges.hidden = true;
      badges.innerHTML = "";
      return;
    }
    badges.hidden = false;
    badges.innerHTML =
      (detail.seq
        ? '<span class="admin-badge admin-badge--seq">seq ' + esc(String(detail.seq)) + "</span>"
        : '<span class="admin-badge admin-badge--warn">웹 미등록</span>') +
      '<span class="admin-badge admin-badge--prog">prog_id ' +
      esc(String(detail.progId)) +
      "</span>";
  }

  function populateForm(detail) {
    detailRef = detail || null;
    var totScEl = document.getElementById("pbTotSc");
    var totScWrap = totScEl && totScEl.closest(".field");

    if (mode === "add") {
      formEl.reset();
      document.getElementById("pbProgId").value = "";
      document.getElementById("pbDateOpen").value = todayIso();
      document.getElementById("pbDateCloseEnabled").checked = false;
      document.getElementById("pbDateClose").value = "";
      document.getElementById("pbDateClose").disabled = true;
      if (totScWrap) totScWrap.hidden = true;
      resetPosterState();
      updateBadges(null);
    } else if (detail) {
      document.getElementById("pbProgId").value = String(detail.progId);
      document.getElementById("pbName").value = detail.titleKo || "";
      document.getElementById("pbName2").value = detail.titleEn || "";
      setSelectValue("pbDivScreen", detail.divScreen);
      setSelectValue("pbDivProg", detail.divProg);
      setSelectValue("pbGrade", detail.grade);
      setSelectValue("pbCountry", detail.country);
      document.getElementById("pbRunningTime").value =
        detail.runningTime != null ? String(detail.runningTime) : "";
      document.getElementById("pbProducer").value = detail.producer || "";
      document.getElementById("pbDistributor").value = detail.distributor || "";
      setSelectValue("pbSpecVideo", detail.specVideo);
      setSelectValue("pbSpecAudio", detail.specAudio);
      setSelectValue("pbSpecFormat", detail.specFormat);
      document.getElementById("pbVolumn").value = detail.volumn || "";
      document.getElementById("pbDateOpen").value = detail.dateOpen || todayIso();
      var closeEnabled = document.getElementById("pbDateCloseEnabled");
      var dateClose = document.getElementById("pbDateClose");
      if (detail.dateClose) {
        closeEnabled.checked = true;
        dateClose.disabled = false;
        dateClose.value = detail.dateClose;
      } else {
        closeEnabled.checked = false;
        dateClose.disabled = true;
        dateClose.value = "";
      }
      if (totScWrap) totScWrap.hidden = false;
      if (totScEl) totScEl.value = detail.totSc != null ? String(detail.totSc) : "";
      setSelectValue("pbDivState", detail.divState);
      document.getElementById("pbProgUrl").value = detail.progUrl || "";
      document.getElementById("wpSlug").value = detail.slug || "";
      document.getElementById("wpDetailUrl").value = detail.detailUrl || "";
      document.getElementById("wpDirector").value = detail.director || "";
      document.getElementById("wpCastNames").value = detail.castNames || "";
      document.getElementById("wpInfo").value = detail.info || "";
      document.getElementById("wpTrailerUrl").value = detail.trailerUrl || "";
      document.getElementById("wpSynopsis").value = detail.synopsis || "";
      posterState = {
        img1Path: detail.img1 || null,
        imgThumbPath: detail.imgThumb || null,
        previewUrl: null,
        removed: false,
        uploading: false,
        pendingFile: null,
        kmdbPosterUrl: null
      };
      updateBadges(detail);
    }

    updateKmdbUi();
    updateSlugRequiredUi();
    resetSlugAutoSyncState();
    updatePosterHint();
    updatePosterPreview();
    updateTrailerPreview();
  }

  function closeModal() {
    if (!overlayEl) return;
    closeKmdbPicker();
    closeGuide();
    isOpen = false;
    overlayEl.hidden = true;
    overlayEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-modal-open");
    detailRef = null;
    slugAutoSync = true;
    slugSyncSilent = false;
  }

  function openModalShell() {
    isOpen = true;
    overlayEl.hidden = false;
    overlayEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("admin-modal-open");
    showMsg("");
    if (titleEl) {
      titleEl.textContent = mode === "add" ? "상영작 등록" : "상영작 수정";
    }
    updateKmdbUi();
    updateSlugRequiredUi();
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

  function uploadPendingPoster(seq) {
    if (!posterState.pendingFile || !seq) return Promise.resolve(null);
    setPosterUploading(true);
    return TiAdminApi.uploadProgramPoster(posterState.pendingFile, seq)
      .then(function (res) {
        if (!res || !res.path) throw new Error("포스터 업로드 실패");
        posterState.img1Path = res.path;
        posterState.imgThumbPath = res.thumbPath || null;
        posterState.previewUrl = resolveAssetUrl(res.path);
        posterState.pendingFile = null;
        posterState.removed = false;
        return {
          img1: res.path,
          imgThumb: res.thumbPath || null
        };
      })
      .finally(function () {
        setPosterUploading(false);
      });
  }

  function saveWebProgram(progId, webBody) {
    if (detailRef && detailRef.hasWebProgram && detailRef.seq) {
      return TiAdminApi.updateProgram(detailRef.seq, webBody);
    }
    return TiAdminApi.upsertProgramByProgId(progId, webBody);
  }

  function saveAll(baseBody, webBody) {
    var chain;
    if (mode === "add") {
      chain = TiAdminApi.createProgBase(baseBody).then(function (created) {
        return saveWebProgram(created.progId, webBody).then(function (saved) {
          return { progId: created.progId, saved: saved };
        });
      });
    } else {
      var progId = detailRef && detailRef.progId;
      if (!progId) return Promise.reject(new Error("prog_id가 없습니다."));
      chain = TiAdminApi.updateProgBase(progId, baseBody).then(function () {
        return saveWebProgram(progId, webBody).then(function (saved) {
          return { progId: progId, saved: saved };
        });
      });
    }

    return chain.then(function (result) {
      var saved = result.saved;
      detailRef = saved;
      var afterPoster = Promise.resolve(saved);
      if (saved && saved.seq && posterState.kmdbPosterUrl && !posterState.img1Path && !posterState.pendingFile && !posterState.removed) {
        afterPoster = TiAdminApi.fetchProgramPosterFromUrl(saved.seq, posterState.kmdbPosterUrl)
          .then(function (res) {
            if (!res || !res.path) return saved;
            posterState.img1Path = res.path;
            posterState.imgThumbPath = res.thumbPath || null;
            posterState.kmdbPosterUrl = null;
            posterState.previewUrl = resolveAssetUrl(res.path);
            return TiAdminApi.updateProgram(saved.seq, {
              img1: res.path,
              imgThumb: res.thumbPath || null
            });
          })
          .catch(function () {
            return saved;
          });
      } else if (posterState.pendingFile && saved && saved.seq) {
        afterPoster = uploadPendingPoster(saved.seq).then(function (paths) {
          if (!paths) return saved;
          return TiAdminApi.updateProgram(saved.seq, paths);
        });
      }
      return afterPoster;
    });
  }

  function saveWithConfirm(baseBody, webBody) {
    isSaving = true;
    var submitBtn = document.getElementById("progFormSubmit");
    if (submitBtn) submitBtn.disabled = true;
    showMsg("저장 중…", false);

    return saveAll(baseBody, webBody)
      .then(function (saved) {
        closeModal();
        if (typeof onSavedCb === "function") onSavedCb(saved);
      })
      .catch(function (err) {
        if (
          mode === "add" &&
          err.message &&
          err.message.indexOf("동일한 제목") >= 0 &&
          !baseBody.confirmDuplicate
        ) {
          var ok = global.confirm(
            "동일한 제목의 영화가 등록되어 있습니다. 계속 등록하시겠습니까?"
          );
          if (ok) {
            baseBody.confirmDuplicate = true;
            return saveWithConfirm(baseBody, webBody);
          }
          showMsg("등록이 취소되었습니다.", true);
          return;
        }
        showMsg(err.message || "저장 실패", true);
        if (isSlugDuplicateError(err.message)) {
          showMsg("");
          showGuide([err.message], "wpSlug");
        }
      })
      .finally(function () {
        isSaving = false;
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function onSubmit(e) {
    e.preventDefault();
    if (isSaving) return;
    var trailerInput = document.getElementById("wpTrailerUrl");
    if (trailerInput) {
      var normalized = normalizeTrailerUrl(trailerInput.value);
      if (normalized) trailerInput.value = normalized;
    }
    var validation = validateClient();
    if (validation.errors.length) {
      showGuide(validation.errors, validation.focusId);
      return;
    }

    var baseBody = readProgBaseForm(false);
    var webBody = readWebForm();
    showMsg("");

    checkSlugDuplicate(webBody.slug)
      .then(function (slugError) {
        if (slugError) {
          showGuide([slugError], "wpSlug");
          return;
        }
        saveWithConfirm(baseBody, webBody);
      })
      .catch(function (err) {
        showGuide([err.message || "slug 중복 확인 실패"], "wpSlug");
      });
  }

  function bindPosterUpload() {
    var fileInput = document.getElementById("posterUpload");
    var deleteBtn = document.getElementById("posterDeleteBtn");
    if (!fileInput) return;

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;

      var seq = currentProgramSeq();
      if (seq) {
        setPosterUploading(true);
        TiAdminApi.uploadProgramPoster(file, seq)
          .then(function (res) {
            if (!res || !res.path) throw new Error("서버 업로드 경로를 받지 못했습니다.");
            posterState.img1Path = res.path;
            posterState.imgThumbPath = res.thumbPath || null;
            posterState.previewUrl = resolveAssetUrl(res.path);
            posterState.pendingFile = null;
            posterState.removed = false;
            updatePosterPreview();
          })
          .catch(function (err) {
            showMsg(err.message || "포스터 업로드 실패", true);
          })
          .finally(function () {
            setPosterUploading(false);
          });
        return;
      }

      if (posterState.previewUrl && posterState.previewUrl.indexOf("blob:") === 0) {
        URL.revokeObjectURL(posterState.previewUrl);
      }
      posterState.pendingFile = file;
      posterState.previewUrl = URL.createObjectURL(file);
      posterState.removed = false;
      updatePosterPreview();
    });

    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        if (posterState.previewUrl && posterState.previewUrl.indexOf("blob:") === 0) {
          URL.revokeObjectURL(posterState.previewUrl);
        }
        posterState.img1Path = null;
        posterState.imgThumbPath = null;
        posterState.previewUrl = null;
        posterState.pendingFile = null;
        posterState.kmdbPosterUrl = null;
        posterState.removed = true;
        updatePosterPreview();
      });
    }
  }

  function setFieldValue(id, val) {
    var el = document.getElementById(id);
    if (!el || val == null || val === "") return;
    el.value = String(val);
  }

  function applyKmdbData(item) {
    if (!item) return;
    setFieldValue("pbName", item.name);
    setFieldValue("pbName2", item.name2);
    syncSlugFromTitleEn();
    if (item.runningTime != null) setFieldValue("pbRunningTime", item.runningTime);
    if (item.producer) setFieldValue("pbProducer", item.producer);
    if (item.dateOpen) setFieldValue("pbDateOpen", item.dateOpen);
    if (item.director) setFieldValue("wpDirector", item.director);
    if (item.castNames) setFieldValue("wpCastNames", item.castNames);
    if (item.synopsis) setFieldValue("wpSynopsis", item.synopsis);
    if (item.info) setFieldValue("wpInfo", item.info);
    if (item.progUrl) setFieldValue("pbProgUrl", item.progUrl);
    if (item.gradeSeq != null) setSelectValue("pbGrade", item.gradeSeq);
    if (item.countrySeq != null) setSelectValue("pbCountry", item.countrySeq);

    if (item.posterUrl) {
      posterState.kmdbPosterUrl = item.posterUrl;
      posterState.previewUrl = item.posterUrl;
      posterState.removed = false;
      posterState.pendingFile = null;
      var seq = currentProgramSeq();
      if (seq) {
        setPosterUploading(true);
        TiAdminApi.fetchProgramPosterFromUrl(seq, item.posterUrl)
          .then(function (res) {
            if (!res || !res.path) throw new Error("포스터 다운로드 실패");
            posterState.img1Path = res.path;
            posterState.imgThumbPath = res.thumbPath || null;
            posterState.kmdbPosterUrl = null;
            posterState.previewUrl = resolveAssetUrl(res.path);
          })
          .catch(function (err) {
            showMsg(err.message || "KMDB 포스터를 가져오지 못했습니다.", true);
          })
          .finally(function () {
            setPosterUploading(false);
            updatePosterPreview();
          });
      } else {
        updatePosterPreview();
      }
    }

    updateTrailerPreview();
    showMsg("KMDB 정보를 반영했습니다.", false);
  }

  function closeKmdbPicker() {
    if (!kmdbPickerEl) return;
    kmdbPickerEl.hidden = true;
    kmdbPickerEl.setAttribute("aria-hidden", "true");
    kmdbPickerItems = [];
    if (kmdbPickerListEl) kmdbPickerListEl.innerHTML = "";
  }

  function renderKmdbPicker(items, query) {
    if (!kmdbPickerEl || !kmdbPickerListEl) return;
    kmdbPickerItems = items || [];
    var hint = document.getElementById("kmdbPickerHint");
    if (hint) {
      hint.textContent =
        '"' + query + '" 검색 결과 ' + kmdbPickerItems.length + "건 — 적용할 영화를 선택하세요.";
    }
    kmdbPickerListEl.innerHTML = kmdbPickerItems
      .map(function (item, idx) {
        var meta = [
          item.prodYear ? item.prodYear + "년" : "",
          item.directorLabel || "",
          item.genre || "",
          item.rating || "",
          item.nation || ""
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          '<li class="admin-kmdb-item">' +
          '<button type="button" class="admin-kmdb-item__btn" data-kmdb-pick="' +
          idx +
          '">' +
          '<span class="admin-kmdb-item__title">' +
          esc(item.title) +
          (item.titleEn ? ' <span class="admin-kmdb-item__en">(' + esc(item.titleEn) + ")</span>" : "") +
          "</span>" +
          (meta ? '<span class="admin-kmdb-item__meta">' + esc(meta) + "</span>" : "") +
          "</button></li>"
        );
      })
      .join("");

    kmdbPickerListEl.querySelectorAll("[data-kmdb-pick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = Number(btn.getAttribute("data-kmdb-pick"));
        var picked = kmdbPickerItems[idx];
        if (!picked) return;
        closeKmdbPicker();
        applyKmdbData(picked);
      });
    });

    kmdbPickerEl.hidden = false;
    kmdbPickerEl.setAttribute("aria-hidden", "false");
  }

  function onKmdbSearch() {
    if (isSaving) return;
    var title = document.getElementById("pbName");
    var query = title ? title.value.trim() : "";
    if (!query) {
      showMsg("KMDB 검색할 영화명을 입력해 주세요.", true);
      if (title) title.focus();
      return;
    }
    showMsg("KMDB 검색 중…", false);
    var btn = document.getElementById("pbKmdbSearch");
    if (btn) btn.disabled = true;
    TiAdminApi.searchKmdb(query)
      .then(function (res) {
        var items = (res && res.items) || [];
        if (!items.length) {
          showMsg('KMDB에서 "' + query + '" 검색 결과가 없습니다.', true);
          return;
        }
        showMsg("");
        if (items.length === 1) {
          applyKmdbData(items[0]);
          return;
        }
        renderKmdbPicker(items, query);
      })
      .catch(function (err) {
        showMsg(err.message || "KMDB 검색 실패", true);
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function bindEvents() {
    overlayEl.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute("data-prog-form-close") != null) {
        closeModal();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (guideEl && !guideEl.hidden) {
          closeGuide();
          return;
        }
        if (kmdbPickerEl && !kmdbPickerEl.hidden) {
          closeKmdbPicker();
          return;
        }
        closeModal();
      }
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

    var trailerInput = document.getElementById("wpTrailerUrl");
    if (trailerInput) {
      trailerInput.addEventListener("input", updateTrailerPreview);
      trailerInput.addEventListener("blur", function () {
        var normalized = normalizeTrailerUrl(trailerInput.value);
        if (normalized) trailerInput.value = normalized;
        updateTrailerPreview();
      });
    }

    bindPosterUpload();

    var name2Input = document.getElementById("pbName2");
    if (name2Input) {
      name2Input.addEventListener("input", syncSlugFromTitleEn);
    }

    var slugInput = document.getElementById("wpSlug");
    if (slugInput) {
      slugInput.addEventListener("input", function () {
        if (!slugSyncSilent) slugAutoSync = false;
      });
    }

    var kmdbBtn = document.getElementById("pbKmdbSearch");
    if (kmdbBtn) kmdbBtn.addEventListener("click", onKmdbSearch);

    if (kmdbPickerEl) {
      kmdbPickerEl.addEventListener("click", function (e) {
        if (e.target && e.target.getAttribute("data-kmdb-picker-close") != null) {
          closeKmdbPicker();
        }
      });
    }

    if (guideEl) {
      guideEl.addEventListener("click", function (e) {
        if (e.target && e.target.getAttribute("data-prog-guide-close") != null) {
          closeGuide();
        }
      });
    }
  }

  function mount() {
    if (overlayEl) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = buildMarkup();
    overlayEl = wrap.querySelector("#progFormModal");
    kmdbPickerEl = wrap.querySelector("#kmdbPickerModal");
    kmdbPickerListEl = wrap.querySelector("#kmdbPickerList");
    guideEl = wrap.querySelector("#progFormGuideModal");
    guideMsgEl = wrap.querySelector("#progFormGuideMsg");
    guideListEl = wrap.querySelector("#progFormGuideList");
    if (overlayEl) document.body.appendChild(overlayEl);
    if (kmdbPickerEl) document.body.appendChild(kmdbPickerEl);
    if (guideEl) document.body.appendChild(guideEl);
    formEl = document.getElementById("progForm");
    msgEl = document.getElementById("progFormMsg");
    titleEl = document.getElementById("progFormModalTitle");
    bindEvents();
  }

  function openAdd(onSaved) {
    mode = "add";
    onSavedCb = onSaved || null;
    mount();
    ensureOptions()
      .then(function () {
        populateForm(null);
        openModalShell();
      })
      .catch(function (err) {
        global.alert(err.message || "폼 옵션을 불러오지 못했습니다.");
      });
  }

  function openEdit(opts, onSaved) {
    opts = opts || {};
    mode = "edit";
    onSavedCb = onSaved || null;
    mount();
    formEl.reset();
    resetPosterState();
    showMsg("불러오는 중…", false);
    openModalShell();

    var loadPromise;
    if (opts.progId) {
      loadPromise = TiAdminApi.getProgramByProgId(opts.progId);
    } else if (opts.seq) {
      loadPromise = TiAdminApi.getProgram(opts.seq);
    } else {
      closeModal();
      global.alert("수정할 상영작 ID가 없습니다.");
      return;
    }

    ensureOptions()
      .then(function () {
        return loadPromise;
      })
      .then(function (detail) {
        if (!detail) {
          showMsg("상영작을 찾을 수 없습니다.", true);
          return;
        }
        populateForm(detail);
        showMsg("");
      })
      .catch(function (err) {
        showMsg(err.message || "상영작을 불러오지 못했습니다.", true);
      });
  }

  global.TiAdminProgramFormModal = {
    openAdd: openAdd,
    openEdit: openEdit
  };

  global.TiAdminProgramAddModal = {
    open: openAdd
  };
})(typeof window !== "undefined" ? window : globalThis);

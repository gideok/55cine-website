(function () {
  TiAdminAuth.guard(function () {

  var SPECIAL_LIST_FIELDS = ["kind", "q", "page", "pageSize"];
  var SPECIAL_FILM_PLACEHOLDER = "images/schedule-poster-placeholder.svg";
  var SPECIAL_TEMP_PREFIX = "images/special/_tmp/";
  var EMPTY_FILM_TITLE = "EmptyFilms";

  function specialListUrl() {
    return TiAdminList.listUrl("special.html", "special", null, SPECIAL_LIST_FIELDS);
  }

  var params = new URLSearchParams(window.location.search);
  var seqParam = params.get("seq");
  var seq = seqParam ? Number(seqParam) : 0;
  var isNew = !seq || Number.isNaN(seq);

  TiAdminLayout.mount("special", isNew ? "기획전·행사 추가" : "기획전·행사 수정");
  var el = TiAdminLayout.contentEl();
  var films = [];
  var mainCoverState = {
    tempPath: null,
    previewUrl: null,
    existingPath: null,
    removed: false,
    uploading: false
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveAssetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || /^blob:/i.test(path) || /^data:/i.test(path)) {
      return path;
    }
    var rel = String(path).replace(/^\//, "");
    if (window.TiSiteRoot && typeof window.TiSiteRoot.relativePrefix === "function") {
      return window.TiSiteRoot.relativePrefix() + rel;
    }
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(rel);
    }
    return "../" + rel;
  }

  function normalizeAssetPath(path) {
    if (!path) return "";
    var s = String(path).trim();
    if (/^https?:\/\//i.test(s)) {
      try {
        s = new URL(s).pathname;
      } catch (e) {
        return s;
      }
    }
    return s.replace(/^\//, "");
  }

  function isSpecialTempPath(path) {
    return normalizeAssetPath(path).indexOf(SPECIAL_TEMP_PREFIX) === 0;
  }

  function assertTempUploadResponse(res) {
    if (!res || !res.path) {
      throw new Error("서버 임시 업로드 경로를 받지 못했습니다.");
    }
    if (!isSpecialTempPath(res.path)) {
      throw new Error("잘못된 임시 업로드 경로: " + res.path);
    }
    return res;
  }

  function kindLabel(k) {
    return k === "event" ? "행사" : "기획전";
  }

  function buildMainCoverPreviewHtml() {
    return (
      '<div class="admin-cover-preview admin-cover-preview--main" id="mainCoverPreview">' +
      '<div class="admin-cover-preview__empty" id="mainCoverPreviewEmpty">no image</div>' +
      '<img id="mainCoverPreviewImg" alt="메인 이미지 미리보기" hidden>' +
      '<div class="admin-cover-preview__spinner" id="mainCoverPreviewSpinner">' +
      '<span class="admin-spinner" aria-hidden="true"></span>' +
      '<span class="admin-cover-preview__spinner-label">업로드 중…</span>' +
      "</div>" +
      '<button type="button" class="admin-cover-delete" id="mainCoverDeleteBtn" hidden>삭제</button>' +
      "</div>"
    );
  }

  function createEmptyFilm() {
    return {
      title: "",
      isEmptySpacer: false,
      image: "",
      imageTempPath: null,
      imagePreviewUrl: null,
      imageRemoved: false,
      imageUploading: false,
      titleEn: "",
      info: "",
      director: "",
      cast: "",
      description: "",
      sectionName: "",
      screenings: []
    };
  }

  function normalizeFilm(film) {
    film = film || {};
    var isEmptySpacer = !!(film.isEmptySpacer || film.title === EMPTY_FILM_TITLE);
    return {
      title: isEmptySpacer ? EMPTY_FILM_TITLE : film.title || "",
      isEmptySpacer: isEmptySpacer,
      image: film.image || "",
      imageTempPath: null,
      imagePreviewUrl: null,
      imageRemoved: false,
      imageUploading: false,
      titleEn: film.titleEn || "",
      info: film.info || "",
      director: film.director || "",
      cast: film.cast || "",
      description: film.description || "",
      sectionName: film.sectionName || "",
      screenings: Array.isArray(film.screenings) ? film.screenings.slice() : []
    };
  }

  function buildImagePreviewHtml(opts) {
    opts = opts || {};
    var id = opts.id;
    var label = opts.label || "이미지 미리보기";
    var filmClass = opts.film ? " admin-cover-preview--film" : "";
    return (
      '<div class="admin-cover-preview' +
      filmClass +
      '" id="' +
      id +
      '">' +
      '<img id="' +
      id +
      'Img" alt="' +
      esc(label) +
      '">' +
      '<div class="admin-cover-preview__spinner" id="' +
      id +
      'Spinner">' +
      '<span class="admin-spinner" aria-hidden="true"></span>' +
      '<span class="admin-cover-preview__spinner-label">업로드 중…</span>' +
      "</div>" +
      '<button type="button" class="admin-cover-delete" id="' +
      id +
      'Delete" hidden>삭제</button>' +
      "</div>"
    );
  }

  function getFilmImageState(film) {
    var hasReal = false;
    var src = resolveAssetUrl(SPECIAL_FILM_PLACEHOLDER);
    if (!film.imageRemoved) {
      if (film.imagePreviewUrl) {
        src = film.imagePreviewUrl;
        hasReal = true;
      } else if (film.image) {
        src = resolveAssetUrl(film.image);
        hasReal = true;
      }
    }
    return { hasReal: hasReal, src: src };
  }

  function updateFilmImagePreview(idx) {
    var film = films[idx];
    if (!film) return;
    var preview = document.getElementById("filmPreview-" + idx);
    var img = document.getElementById("filmPreview-" + idx + "Img");
    var spinner = document.getElementById("filmPreview-" + idx + "Spinner");
    var deleteBtn = document.getElementById("filmPreview-" + idx + "Delete");
    var pickLabel = document.getElementById("filmPickLabel-" + idx);
    if (!preview || !img) return;

    var state = getFilmImageState(film);
    img.src = state.src;
    img.classList.toggle("is-placeholder", !state.hasReal);
    img.style.visibility = film.imageUploading ? "hidden" : "visible";
    if (spinner) spinner.classList.toggle("is-active", !!film.imageUploading);
    if (deleteBtn) deleteBtn.hidden = !state.hasReal || film.imageUploading;
    if (pickLabel) pickLabel.classList.toggle("is-disabled", !!film.imageUploading);
    preview.hidden = false;
  }

  function setFilmImageUploading(idx, loading) {
    if (!films[idx]) return;
    films[idx].imageUploading = !!loading;
    updateFilmImagePreview(idx);
  }

  function updateMainCoverPreview() {
    var wrap = document.getElementById("mainCoverPreview");
    var img = document.getElementById("mainCoverPreviewImg");
    var empty = document.getElementById("mainCoverPreviewEmpty");
    var spinner = document.getElementById("mainCoverPreviewSpinner");
    var deleteBtn = document.getElementById("mainCoverDeleteBtn");
    var pickLabel = document.getElementById("mainCoverPickLabel");
    if (!wrap || !img) return;

    var hasReal =
      !mainCoverState.removed &&
      !!(mainCoverState.previewUrl || mainCoverState.existingPath);

    if (empty) empty.hidden = !!hasReal || !!mainCoverState.uploading;
    img.hidden = !hasReal;
    if (hasReal) {
      img.src =
        mainCoverState.previewUrl || resolveAssetUrl(mainCoverState.existingPath);
    }
    img.style.visibility = mainCoverState.uploading ? "hidden" : "visible";
    if (spinner) spinner.classList.toggle("is-active", !!mainCoverState.uploading);
    if (deleteBtn) deleteBtn.hidden = !hasReal || mainCoverState.uploading;
    if (pickLabel) pickLabel.classList.toggle("is-disabled", !!mainCoverState.uploading);
    wrap.hidden = false;
  }

  function addFilmItem() {
    syncFilmsFromDom();
    films.push(createEmptyFilm());
    renderFilms();
  }

  function getFormKind() {
    var kindEl = document.getElementById("kind");
    return kindEl ? kindEl.value : "exhibition";
  }

  function isExhibitionKind(kind) {
    return (kind != null ? kind : getFormKind()) === "exhibition";
  }

  function buildFormActionsInnerHtml(kind) {
    return (
      (isExhibitionKind(kind)
        ? '<button type="button" class="admin-btn" id="addFilm">+ 작품</button>'
        : "") +
      '<button type="submit" class="admin-btn admin-btn--primary" id="spSaveBtn">저장</button>' +
      '<a class="admin-btn" href="' +
      esc(specialListUrl()) +
      '">목록</a>'
    );
  }

  function buildFormActionsHtml(kind) {
    return (
      '<div class="admin-form-actions" id="spFormActions">' +
      buildFormActionsInnerHtml(kind) +
      "</div>"
    );
  }

  function refreshFormActions(kind) {
    var container = document.getElementById("spFormActions");
    if (!container) return;
    container.innerHTML = buildFormActionsInnerHtml(kind);
    bindFormActions();
  }

  function bindFormActions() {
    var addBtn = document.getElementById("addFilm");
    if (addBtn) addBtn.onclick = addFilmItem;
  }

  function bindFloatingDock() {
    var dock = document.getElementById("spFloatingDock");
    if (!dock) return;
    function onScroll() {
      dock.classList.toggle("is-visible", window.scrollY > 48);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function mountFloatingDock(kind) {
    var old = document.getElementById("spFloatingDock");
    if (old) old.remove();

    var dock = document.createElement("div");
    dock.id = "spFloatingDock";
    dock.className = "admin-floating-dock";
    dock.innerHTML =
      (isExhibitionKind(kind)
        ? '<button type="button" class="admin-floating-dock__btn" id="spFloatAddFilm">+ 작품</button>'
        : "") +
      '<button type="submit" form="spForm" class="admin-floating-dock__btn admin-floating-dock__btn--primary">저장</button>' +
      '<a class="admin-floating-dock__btn" href="' +
      esc(specialListUrl()) +
      '">목록</a>';
    document.body.appendChild(dock);

    var addBtn = document.getElementById("spFloatAddFilm");
    if (addBtn) addBtn.onclick = addFilmItem;
    bindFloatingDock();
  }

  function setMainCoverUploading(loading) {
    mainCoverState.uploading = !!loading;
    updateMainCoverPreview();
  }

  function buildFilmHeadHtml(film, idx) {
    var isSpacer = !!film.isEmptySpacer;
    return (
      '<h3 class="admin-film-list__head">' +
      '<button type="button" class="admin-film-list__drag" draggable="true" data-drag="' +
      idx +
      '" aria-label="작품 #' +
      (idx + 1) +
      ' 순서 변경" title="드래그하여 순서 변경">⋮⋮</button>' +
      '<span class="admin-film-list__label">작품 #' +
      (idx + 1) +
      "</span>" +
      '<label class="admin-film-spacer-check">' +
      '<input type="checkbox" id="filmSpacer-' +
      idx +
      '" data-spacer="' +
      idx +
      '"' +
      (isSpacer ? " checked" : "") +
      "> 빈칸</label>" +
      '<button type="button" class="admin-btn admin-btn--danger" data-rm="' +
      idx +
      '">삭제</button>' +
      "</h3>"
    );
  }

  function setFilmSpacerMode(idx, isSpacer) {
    if (!films[idx]) return;
    films[idx].isEmptySpacer = !!isSpacer;

    var body = document.getElementById("filmBody-" + idx);
    var titleInput = document.getElementById("title-" + idx);
    var card = document.querySelector('.admin-film-list[data-idx="' + idx + '"]');

    if (isSpacer) {
      films[idx].title = EMPTY_FILM_TITLE;
      if (titleInput) {
        titleInput.value = EMPTY_FILM_TITLE;
        titleInput.readOnly = true;
      }
      if (body) body.hidden = true;
      if (card) card.classList.add("admin-film-list--spacer");
    } else {
      if (titleInput) {
        titleInput.readOnly = false;
        if (titleInput.value === EMPTY_FILM_TITLE) titleInput.value = "";
        films[idx].title = titleInput.value.trim();
      }
      if (body) body.hidden = false;
      if (card) card.classList.remove("admin-film-list--spacer");
    }
  }

  function bindFilmDragDrop() {
    var box = document.getElementById("filmList");
    if (!box) return;

    var dragFromIdx = null;

    box.querySelectorAll(".admin-film-list").forEach(function (card) {
      var idx = Number(card.getAttribute("data-idx"));
      var handle = card.querySelector(".admin-film-list__drag");
      if (!handle) return;

      handle.addEventListener("dragstart", function (e) {
        syncFilmsFromDom();
        dragFromIdx = idx;
        card.classList.add("is-dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(idx));
        }
      });

      handle.addEventListener("dragend", function () {
        card.classList.remove("is-dragging");
        dragFromIdx = null;
        box.querySelectorAll(".admin-film-list").forEach(function (c) {
          c.classList.remove("is-drag-over");
        });
      });

      card.addEventListener("dragover", function (e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        card.classList.add("is-drag-over");
      });

      card.addEventListener("dragleave", function (e) {
        if (!card.contains(e.relatedTarget)) {
          card.classList.remove("is-drag-over");
        }
      });

      card.addEventListener("drop", function (e) {
        e.preventDefault();
        card.classList.remove("is-drag-over");
        var from =
          dragFromIdx != null ? dragFromIdx : Number(e.dataTransfer && e.dataTransfer.getData("text/plain"));
        var to = Number(card.getAttribute("data-idx"));
        if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
        syncFilmsFromDom();
        var item = films.splice(from, 1)[0];
        films.splice(to, 0, item);
        renderFilms();
      });
    });
  }

  function renderFilms() {
    var box = document.getElementById("filmList");
    if (!box) return;
    box.innerHTML = films
      .map(function (film, idx) {
        var isSpacer = !!film.isEmptySpacer;
        return (
          '<div class="admin-film-list' +
          (isSpacer ? " admin-film-list--spacer" : "") +
          '" data-idx="' +
          idx +
          '">' +
          buildFilmHeadHtml(film, idx) +
          '<div class="admin-film-list__body" id="filmBody-' +
          idx +
          '"' +
          (isSpacer ? " hidden" : "") +
          ">" +
          field("title-" + idx, "제목", film.title, isSpacer) +
          '<div class="field"><label>작품 이미지</label>' +
          '<input type="file" id="filmUpload-' +
          idx +
          '" class="admin-sr-only-file" accept="image/*">' +
          '<label for="filmUpload-' +
          idx +
          '" class="admin-btn admin-btn--upload admin-file-label" id="filmPickLabel-' +
          idx +
          '">이미지 선택</label>' +
          '<p class="field-hint">저장 시 sp_{seq}_{itemSeq} 형식으로 업로드됩니다.</p>' +
          buildImagePreviewHtml({ id: "filmPreview-" + idx, label: "작품 이미지", film: true }) +
          "</div>" +
          field("titleEn-" + idx, "영문제", film.titleEn) +
          field("info-" + idx, "info", film.info) +
          field("director-" + idx, "감독", film.director) +
          field("cast-" + idx, "출연", film.cast) +
          '<div class="field"><label>설명</label><textarea data-desc="' +
          idx +
          '">' +
          esc(film.description) +
          "</textarea></div>" +
          field("sectionName-" + idx, "섹션명", film.sectionName) +
          "</div>" +
          (isSpacer
            ? '<p class="admin-film-spacer-note">상세 페이지 2열 그리드용 빈 칸(EmptyFilms)으로 표시됩니다.</p>'
            : "") +
          "</div>"
        );
      })
      .join("");

    box.querySelectorAll("[data-rm]").forEach(function (btn) {
      btn.onclick = function () {
        syncFilmsFromDom();
        films.splice(Number(btn.getAttribute("data-rm")), 1);
        renderFilms();
      };
    });

    box.querySelectorAll("[data-spacer]").forEach(function (input) {
      input.onchange = function () {
        setFilmSpacerMode(Number(input.getAttribute("data-spacer")), input.checked);
      };
    });

    films.forEach(function (film, idx) {
      if (film.isEmptySpacer) setFilmSpacerMode(idx, true);

      updateFilmImagePreview(idx);

      var fileInput = document.getElementById("filmUpload-" + idx);
      if (fileInput) {
        fileInput.onchange = function () {
          var file = fileInput.files && fileInput.files[0];
          fileInput.value = "";
          if (!file || !films[idx]) return;
          setFilmImageUploading(idx, true);
          TiAdminApi.uploadSpecialTemp(file)
            .then(assertTempUploadResponse)
            .then(function (res) {
              films[idx].imageTempPath = res.path;
              films[idx].imagePreviewUrl = resolveAssetUrl(res.path);
              films[idx].imageRemoved = false;
              updateFilmImagePreview(idx);
            })
            .catch(function (err) {
              alert(err.message || "작품 이미지 업로드 실패");
            })
            .finally(function () {
              setFilmImageUploading(idx, false);
            });
        };
      }

      var deleteBtn = document.getElementById("filmPreview-" + idx + "Delete");
      if (deleteBtn) {
        deleteBtn.onclick = function () {
          if (!films[idx]) return;
          films[idx].imageTempPath = null;
          films[idx].imagePreviewUrl = null;
          films[idx].imageRemoved = true;
          updateFilmImagePreview(idx);
        };
      }
    });

    bindFilmDragDrop();
  }

  function field(name, label, val, readOnly) {
    return (
      '<div class="field"><label>' +
      label +
      '</label><input type="text" id="' +
      name +
      '" value="' +
      esc(val) +
      '"' +
      (readOnly ? " readonly" : "") +
      "></div>"
    );
  }

  function isFilmSpacerChecked(idx) {
    var input = document.getElementById("filmSpacer-" + idx);
    if (!input) return !!(films[idx] && films[idx].isEmptySpacer);
    return input.checked;
  }

  function collectFilms() {
    syncFilmsFromDom();
    return films.map(function (film, idx) {
      var isSpacer = !!film.isEmptySpacer;
      var descEl = document.querySelector("[data-desc='" + idx + "']");
      return {
        title: isSpacer ? EMPTY_FILM_TITLE : val("title-" + idx),
        isEmptySpacer: isSpacer,
        image: isSpacer ? "" : film.image || "",
        imageTempPath: isSpacer ? null : film.imageTempPath,
        removeImage: isSpacer ? true : film.imageRemoved && !film.imageTempPath,
        titleEn: isSpacer ? "" : val("titleEn-" + idx),
        info: isSpacer ? "" : val("info-" + idx),
        director: isSpacer ? "" : val("director-" + idx),
        cast: isSpacer ? "" : val("cast-" + idx),
        description: isSpacer ? "" : descEl ? descEl.value : "",
        sectionName: isSpacer ? "" : val("sectionName-" + idx),
        screenings: isSpacer ? [] : film.screenings || []
      };
    });
  }

  function val(id) {
    var node = document.getElementById(id);
    return node ? node.value.trim() : "";
  }

  /** re-render 전 DOM 입력값을 films 배열에 반영 (작품 추가·삭제·순서 변경 시 유실 방지) */
  function syncFilmsFromDom() {
    films.forEach(function (film, idx) {
      film.isEmptySpacer = isFilmSpacerChecked(idx);
      if (film.isEmptySpacer) {
        film.title = EMPTY_FILM_TITLE;
      } else {
        film.title = val("title-" + idx);
        film.titleEn = val("titleEn-" + idx);
        film.info = val("info-" + idx);
        film.director = val("director-" + idx);
        film.cast = val("cast-" + idx);
        film.sectionName = val("sectionName-" + idx);
        var descEl = document.querySelector("[data-desc='" + idx + "']");
        film.description = descEl ? descEl.value : "";
      }
    });
  }

  function bindMainCoverUpload() {
    var fileInput = document.getElementById("mainCoverUpload");
    var deleteBtn = document.getElementById("mainCoverDeleteBtn");
    if (!fileInput) return;

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;

      setMainCoverUploading(true);
      TiAdminApi.uploadSpecialTemp(file)
        .then(assertTempUploadResponse)
        .then(function (res) {
          mainCoverState.tempPath = res.path;
          mainCoverState.previewUrl = resolveAssetUrl(res.path);
          mainCoverState.removed = false;
          updateMainCoverPreview();
        })
        .catch(function (err) {
          alert(err.message || "메인 이미지 업로드 실패");
        })
        .finally(function () {
          setMainCoverUploading(false);
        });
    });

    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        mainCoverState.tempPath = null;
        mainCoverState.previewUrl = null;
        mainCoverState.removed = true;
        updateMainCoverPreview();
      });
    }
  }

  function resetMainCoverFromSaved(imgMain) {
    mainCoverState.tempPath = null;
    mainCoverState.previewUrl = null;
    mainCoverState.existingPath = imgMain || null;
    mainCoverState.removed = false;
    updateMainCoverPreview();
  }

  function renderForm(detail) {
    var kind = detail ? detail.kind : "exhibition";
    films = detail && detail.films ? detail.films.map(normalizeFilm) : [];

    mainCoverState = {
      tempPath: null,
      previewUrl: null,
      existingPath: detail && detail.imgMain ? detail.imgMain : null,
      removed: false,
      uploading: false
    };

    el.innerHTML =
      '<form class="admin-form" id="spForm">' +
      '<input type="hidden" id="specialSeq" value="' +
      (detail ? detail.seq : "") +
      '">' +
      (isNew
        ? ""
        : '<div class="admin-meta-badges">' +
          '<span class="admin-badge admin-badge--seq">seq ' +
          esc(String(detail.seq)) +
          "</span>" +
          '<span class="admin-badge admin-badge--kind-' +
          esc(detail.kind) +
          '">' +
          esc(kindLabel(detail.kind)) +
          "</span></div>") +
      '<div class="field"><label>구분</label><select id="kind"' +
      (isNew ? "" : " disabled") +
      '><option value="exhibition">기획전</option><option value="event">행사</option></select></div>' +
      '<div class="field"><label>제목</label><input type="text" id="title" required value="' +
      esc(detail && detail.title) +
      '"></div>' +
      field("dateLabel", "일정 라벨", detail && detail.dateLabel) +
      '<div class="field"><label>소개 (body)</label><textarea id="body">' +
      esc(detail && detail.body) +
      "</textarea></div>" +
      '<div class="field"><label>메인 이미지</label>' +
      '<input type="file" id="mainCoverUpload" class="admin-sr-only-file" accept="image/*">' +
      '<label for="mainCoverUpload" class="admin-btn admin-btn--upload admin-file-label" id="mainCoverPickLabel">이미지 선택</label>' +
      '<p class="field-hint">저장 시 sp_{seq}_main 으로 업로드됩니다.</p>' +
      buildMainCoverPreviewHtml() +
      "</div>" +
      '<p class="field-hint">예매 링크는 디트릭스 오오극장 페이지로 자동 연결됩니다.</p>' +
      '<div id="filmsSection">' +
      '<p class="field-hint admin-film-list-hint">작품 카드 왼쪽 ⋮⋮ 핸들을 드래그하여 순서를 변경할 수 있습니다.</p>' +
      '<div id="filmList"></div></div>' +
      buildFormActionsHtml(kind) +
      "</form>";

    document.getElementById("kind").value = kind;
    toggleFilmsSection();

    document.getElementById("kind").onchange = function () {
      toggleFilmsSection();
      refreshFormActions();
    };
    bindFormActions();

    if (!isNew) mountFloatingDock(kind);

    if (isExhibitionKind(kind)) renderFilms();

    bindMainCoverUpload();
    updateMainCoverPreview();

    document.getElementById("spForm").onsubmit = function (e) {
      e.preventDefault();
      var submitBtn =
        e.submitter ||
        document.getElementById("spSaveBtn") ||
        document.querySelector("#spForm button[type=submit]");
      if (submitBtn) submitBtn.disabled = true;
      var floatSaveBtn = document.querySelector("#spFloatingDock button[form=spForm]");
      if (floatSaveBtn) floatSaveBtn.disabled = true;

      var body = {
        title: val("title"),
        dateLabel: val("dateLabel") || null,
        body: document.getElementById("body").value,
        mainImageTempPath: mainCoverState.tempPath,
        removeMainImage: mainCoverState.removed && !mainCoverState.tempPath
      };

      if (
        !mainCoverState.removed &&
        !mainCoverState.tempPath &&
        !mainCoverState.existingPath &&
        !isNew
      ) {
        delete body.removeMainImage;
        delete body.mainImageTempPath;
      }

      if (isExhibitionKind()) {
        body.films = collectFilms();
      }

      var p = isNew
        ? TiAdminApi.createSpecial({
            kind: document.getElementById("kind").value,
            title: body.title,
            dateLabel: body.dateLabel,
            body: body.body,
            mainImageTempPath: body.mainImageTempPath,
            removeMainImage: body.removeMainImage,
            films: body.films
          })
        : TiAdminApi.updateSpecial(seq, body);

      p.then(function (saved) {
        alert("저장되었습니다.");
        if (!isNew && window.TiAdminDetailEdit && TiAdminDetailEdit.redirectAfterSave()) {
          return;
        }
        if (isNew) {
          window.location.href =
            "special-edit.html?seq=" + encodeURIComponent(String(saved.seq));
          return;
        }

        document.getElementById("specialSeq").value = saved.seq;
        films = (saved.films || []).map(normalizeFilm);
        resetMainCoverFromSaved(saved.imgMain);
        renderFilms();
      })
        .catch(function (err) {
          alert(err.message || "저장에 실패했습니다.");
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
          if (floatSaveBtn) floatSaveBtn.disabled = false;
        });
    };
  }

  function toggleFilmsSection() {
    var sec = document.getElementById("filmsSection");
    if (sec) sec.style.display = isExhibitionKind() ? "block" : "none";
  }

  if (isNew) {
    renderForm(null);
  } else {
    el.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getSpecial(seq)
      .then(renderForm)
      .catch(function (err) {
        el.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }
  });
})();

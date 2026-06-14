(function () {
  if (!window.TiAdminAuth.require()) return;

  var PROGRAM_POSTER_PLACEHOLDER = "images/schedule-poster-placeholder.svg";

  var PROGRAM_LIST_FIELDS = ["q", "page", "pageSize", "desktopOnly"];

  function programsListUrl() {
    return TiAdminList.listUrl("programs.html", "programs", null, PROGRAM_LIST_FIELDS);
  }

  var params = new URLSearchParams(window.location.search);
  var seq = Number(params.get("seq"));
  var progId = Number(params.get("progId"));
  var useProgId = false;

  if (seq > 0 && !Number.isNaN(seq)) {
    useProgId = false;
  } else if (progId > 0 && !Number.isNaN(progId)) {
    useProgId = true;
  } else {
    window.location.href = programsListUrl();
    return;
  }

  TiAdminLayout.mount("programs", useProgId ? "상영작 추가정보 입력" : "상영작 수정");
  var el = TiAdminLayout.contentEl();
  var detailRef = null;

  var posterState = {
    img1Path: null,
    imgThumbPath: null,
    previewUrl: null,
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
      /* ignore invalid URL */
    }
    return s;
  }

  function normalizeTrailerUrl(raw) {
    var id = parseYoutubeVideoId(raw);
    return id || null;
  }

  function updateTrailerPreview() {
    var input = document.querySelector('input[name="trailerUrl"]');
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

  function bindTrailerField() {
    var input = document.querySelector('input[name="trailerUrl"]');
    if (!input) return;

    input.addEventListener("input", updateTrailerPreview);
    input.addEventListener("blur", function () {
      var normalized = normalizeTrailerUrl(input.value);
      if (normalized) input.value = normalized;
      updateTrailerPreview();
    });

    updateTrailerPreview();
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
      }
    }

    img.src = src;
    img.classList.toggle("is-placeholder", !hasReal);

    if (spinner) {
      spinner.classList.toggle("is-active", !!posterState.uploading);
    }
    if (deleteBtn) {
      deleteBtn.hidden = !hasReal || posterState.uploading;
    }

    img.style.visibility = posterState.uploading ? "hidden" : "visible";
    wrap.hidden = false;
  }

  function setPosterUploading(loading) {
    posterState.uploading = !!loading;
    var pickLabel = document.getElementById("posterPickLabel");
    if (pickLabel) pickLabel.classList.toggle("is-disabled", loading);
    updatePosterPreview();
  }

  function currentProgramSeq() {
    return detailRef && detailRef.seq ? detailRef.seq : seq;
  }

  function bindPosterUpload() {
    var fileInput = document.getElementById("posterUpload");
    var deleteBtn = document.getElementById("posterDeleteBtn");
    if (!fileInput) return;

    fileInput.addEventListener("change", function () {
      var uploadSeq = currentProgramSeq();
      if (!uploadSeq) {
        alert("웹 등록 저장 후 포스터를 업로드할 수 있습니다.");
        return;
      }
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;

      setPosterUploading(true);
      TiAdminApi.uploadProgramPoster(file, uploadSeq)
        .then(function (res) {
          if (!res || !res.path) {
            throw new Error("서버 업로드 경로를 받지 못했습니다.");
          }
          posterState.img1Path = res.path;
          posterState.imgThumbPath = res.thumbPath || null;
          posterState.previewUrl = resolveAssetUrl(res.path);
          posterState.removed = false;
          updatePosterPreview();
        })
        .catch(function (err) {
          alert(err.message || "포스터 이미지 업로드 실패");
        })
        .finally(function () {
          setPosterUploading(false);
        });
    });

    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        posterState.img1Path = null;
        posterState.imgThumbPath = null;
        posterState.previewUrl = null;
        posterState.removed = true;
        updatePosterPreview();
      });
    }
  }

  function renderForm(detail) {
    detailRef = detail;
    if (detail.seq) seq = detail.seq;
    var isNewWeb = !detail.hasWebProgram;
    posterState = {
      img1Path: detail.img1 || null,
      imgThumbPath: detail.imgThumb || null,
      previewUrl: null,
      removed: false,
      uploading: false
    };

    el.innerHTML =
      '<p class="admin-back"><a href="' + esc(programsListUrl()) + '">← 상영작 목록</a></p>' +
      '<form class="admin-form" id="progForm">' +
      '<div class="admin-meta-badges">' +
      (detail.seq
        ? '<span class="admin-badge admin-badge--seq">seq ' + esc(String(detail.seq)) + "</span>"
        : '<span class="admin-badge admin-badge--warn">웹 미등록</span>') +
      '<span class="admin-badge admin-badge--prog">prog_id ' +
      esc(String(detail.progId)) +
      "</span></div>" +
      (isNewWeb
        ? '<p class="admin-msg admin-msg--info">데스크톱(<code>prog_base</code>)에만 등록된 상영작입니다. slug·상세 정보를 입력하고 저장하면 웹 목록에 노출할 수 있습니다.</p>'
        : "") +
      '<p><strong>' +
      esc(detail.titleKo) +
      "</strong>" +
      (detail.titleEn ? " / " + esc(detail.titleEn) : "") +
      "</p>" +
      '<p class="admin-meta">상영기간: ' +
      esc(detail.dateOpen) +
      " ~ " +
      esc(detail.dateClose) +
      "</p>" +
      field("slug", "slug", detail.slug) +
      field("detailUrl", "detail_url", detail.detailUrl) +
      '<div class="field"><label>포스터 이미지</label>' +
      '<input type="file" id="posterUpload" class="admin-sr-only-file" accept="image/*">' +
      '<label for="posterUpload" class="admin-btn admin-btn--upload admin-file-label" id="posterPickLabel">이미지 선택</label>' +
      '<p class="field-hint">' +
      (detail.seq
        ? "저장 시 wp_" +
          esc(String(detail.seq)) +
          "_1 로 업로드되고, 40×40 썸네일(thumb_wp_)이 자동 생성됩니다."
        : "웹 등록 저장 후 포스터를 업로드할 수 있습니다.") +
      " 시간표는 썸네일, 목록·상세는 원본을 사용합니다.</p>" +
      '<div class="admin-cover-preview" id="posterPreview">' +
      '<img id="posterPreviewImg" alt="포스터 미리보기">' +
      '<div class="admin-cover-preview__spinner" id="posterPreviewSpinner">' +
      '<span class="admin-spinner" aria-hidden="true"></span>' +
      '<span class="admin-cover-preview__spinner-label">업로드 중…</span>' +
      "</div>" +
      '<button type="button" class="admin-cover-delete" id="posterDeleteBtn" hidden>삭제</button>' +
      "</div></div>" +
      field("director", "감독", detail.director) +
      field("castNames", "출연", detail.castNames) +
      field("info", "info", detail.info) +
      field("trailerUrl", "예고편 URL", detail.trailerUrl) +
      '<p class="field-hint">YouTube URL 입력 시 영상 ID만 저장됩니다. (예: g1tdSFKcDwQ)</p>' +
      '<div class="admin-youtube-preview" id="trailerPreview" hidden>' +
      '<iframe id="trailerPreviewFrame" title="예고편 미리보기" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>' +
      "</div>" +
      '<div class="field"><label>시놉시스</label><textarea name="synopsis">' +
      esc(detail.synopsis) +
      "</textarea></div>" +
      '<div class="admin-form-actions">' +
      '<button type="submit" class="admin-btn admin-btn--primary">저장</button>' +
      '<a class="admin-btn" href="' + esc(programsListUrl()) + '">취소</a>' +
      "</div></form>";

    bindPosterUpload();
    updatePosterPreview();
    bindTrailerField();

    document.getElementById("progForm").onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      var img1 = posterState.removed ? null : posterState.img1Path;
      var imgThumb = posterState.removed ? null : posterState.imgThumbPath;

      var payload = {
        slug: f.slug.value,
        detailUrl: f.detailUrl.value || null,
        imgThumb: imgThumb,
        img1: img1,
        director: f.director.value || null,
        castNames: f.castNames.value || null,
        info: f.info.value || null,
        synopsis: f.synopsis.value || null,
        trailerUrl: normalizeTrailerUrl(f.trailerUrl.value)
      };

      var savePromise =
        !detail.hasWebProgram && detail.progId
          ? TiAdminApi.upsertProgramByProgId(detail.progId, payload)
          : TiAdminApi.updateProgram(detail.seq || seq, payload);

      savePromise
        .then(function (saved) {
          alert("저장되었습니다.");
          if (saved && saved.seq && !detail.hasWebProgram) {
            window.location.href =
              "program-edit.html?seq=" + encodeURIComponent(String(saved.seq));
            return;
          }
          window.location.href = programsListUrl();
        })
        .catch(function (err) {
          alert(err.message);
        });
    };
  }

  el.innerHTML = "<p>불러오는 중…</p>";
  var loadPromise = useProgId
    ? TiAdminApi.getProgramByProgId(progId)
    : TiAdminApi.getProgram(seq);

  loadPromise
    .then(renderForm)
    .catch(function (err) {
      el.innerHTML =
        '<div class="admin-msg admin-msg--error">' +
        esc(err.message) +
        '</div><p><a href="' + esc(programsListUrl()) + '">← 상영작 목록</a></p>';
    });
})();

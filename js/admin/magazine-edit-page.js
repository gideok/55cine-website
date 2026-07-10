(function () {
  TiAdminAuth.guard(function () {
  var MAGAZINE_LIST_FIELDS = ["section", "isPast", "q", "page", "pageSize"];

  function magazineListUrl() {
    return TiAdminList.listUrl("magazine.html", "magazine", null, MAGAZINE_LIST_FIELDS);
  }

  var MAGAZINE_COVER_PLACEHOLDER = "images/magazine/magazine-cover-placeholder.svg";
  var MAGAZINE_TEMP_PREFIX = "images/magazine/_tmp/";
  var BODY_IMG_DRAG_TYPE = "application/x-mz-body-img";

  var params = new URLSearchParams(window.location.search);

  var seqParam = params.get("seq");

  var seq = seqParam ? Number(seqParam) : 0;

  var isNew = !seq || Number.isNaN(seq);

  var editor = null;

  var coverState = {

    tempPath: null,

    previewUrl: null,

    existingPath: null,

    removed: false,

    uploading: false

  };

  var bodyImagePool = [];

  TiAdminLayout.mount("magazine", isNew ? "매거진 기사 추가" : "매거진 기사 수정");

  var el = TiAdminLayout.contentEl();

  function esc(s) {

    return String(s || "")

      .replace(/&/g, "&amp;")

      .replace(/</g, "&lt;")

      .replace(/>/g, "&gt;")

      .replace(/"/g, "&quot;");

  }

  function normalizeAssetRelPath(path) {
    if (window.TiMagazineAsset && typeof window.TiMagazineAsset.normalizeRelPath === "function") {
      return window.TiMagazineAsset.normalizeRelPath(path);
    }
    var s = String(path || "").trim();
    if (/^https?:\/\//i.test(s)) {
      try {
        s = new URL(s).pathname;
      } catch (e) {
        return s;
      }
    }
    while (/^\.\.\//.test(s)) s = s.slice(3);
    return s.replace(/^\//, "");
  }

  function resolveAssetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || /^blob:/i.test(path) || /^data:/i.test(path)) {
      return path;
    }

    var rel = normalizeAssetRelPath(path);
    if (!rel) return "";

    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(rel);
    }

    if (window.TiSiteRoot && typeof window.TiSiteRoot.relativePrefix === "function") {
      return window.TiSiteRoot.relativePrefix() + rel;
    }

    return "../" + rel;
  }

  function prepareBodyHtmlForEditor(html) {
    var box = document.createElement("div");
    box.innerHTML = html || "";
    Array.prototype.forEach.call(box.querySelectorAll("img"), function (img) {
      var src = img.getAttribute("src");
      if (src) img.setAttribute("src", resolveAssetUrl(src));
    });
    return box.innerHTML;
  }

  function isMagazineTempPath(path) {
    return normalizeAssetPath(path).indexOf(MAGAZINE_TEMP_PREFIX) === 0;
  }

  function assertTempUploadResponse(res) {
    if (!res || !res.path) {
      throw new Error("서버 임시 업로드 경로를 받지 못했습니다.");
    }
    if (!isMagazineTempPath(res.path)) {
      throw new Error("잘못된 임시 업로드 경로: " + res.path);
    }
    return res;
  }

  function normalizeAssetPath(path) {

    if (!path) return "";

    var s = String(path).trim();

    if (/^https?:\/\//i.test(s)) {

      try {

        var u = new URL(s);

        s = u.pathname;

      } catch (e) {

        return s;

      }

    }

    while (/^\.\.\//.test(s)) s = s.slice(3);

    return s.replace(/^\//, "");

  }

  function pathFromImgSrc(src) {

    if (!src) return "";

    return normalizeAssetPath(src);

  }

  function newBodyImageId() {

    return "bi_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  }

  function todayPublishedLabel() {

    var d = new Date();

    return (

      d.getFullYear() +

      "/" +

      String(d.getMonth() + 1).padStart(2, "0") +

      "/" +

      String(d.getDate()).padStart(2, "0")

    );

  }

  function sectionLabel(section, isPast) {
    if (isPast) return "지난기사";
    if (section === "serial") return "연재";
    if (section === "gv-moment") return "GV모먼트";
    return "프리뷰";
  }

  function parseTitleFields(title) {

    var movieTitle = "";

    var subtitle = "";

    var m = String(title || "").match(/<([^>]+)>/);

    if (m) movieTitle = m[1].trim();

    var dash = String(title || "").indexOf(" - ");

    if (dash >= 0) subtitle = String(title).slice(dash + 3).trim();

    return { movieTitle: movieTitle, subtitle: subtitle };

  }

  function field(id, label, val, opts) {

    opts = opts || {};

    return (

      '<div class="field"><label>' +

      label +

      '</label><input type="text" id="' +

      id +

      '" value="' +

      esc(val) +

      '"' +

      (opts.maxlength ? ' maxlength="' + opts.maxlength + '"' : "") +

      "></div>"

    );

  }

  function val(id) {

    var n = document.getElementById(id);

    return n ? n.value.trim() : "";

  }

  function findPoolItem(id) {

    for (var i = 0; i < bodyImagePool.length; i++) {

      if (bodyImagePool[i].id === id) return bodyImagePool[i];

    }

    return null;

  }

  function buildBodyImgHtml(item) {
    var tempAttr = item.tempPath
      ? ' data-ti-temp="' + esc(item.tempPath) + '"'
      : "";
    return (
      "<p><img src=\"" +
      esc(item.previewUrl) +
      "\" alt=\"\" data-ti-asset-key=\"" +
      esc(item.assetPath) +
      "\"" +
      tempAttr +
      "></p>"
    );
  }

  function closestEl(node, selector) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    while (el) {
      if (el.matches && el.matches(selector)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function detectImgAlign(img) {

    if (!img) return "left";

    var ml = "";

    var mr = "";

    var style = img.getAttribute("style") || "";

    style.split(";").forEach(function (part) {

      var sep = part.indexOf(":");

      if (sep === -1) return;

      var prop = part.slice(0, sep).trim().toLowerCase();

      var val = part.slice(sep + 1).trim().toLowerCase();

      if (prop === "margin-left") ml = val;

      if (prop === "margin-right") mr = val;

    });

    if (!ml) ml = String(img.style.marginLeft || "").toLowerCase();

    if (!mr) mr = String(img.style.marginRight || "").toLowerCase();

    if (ml === "auto" && mr === "auto") return "center";

    if (ml === "auto" && (mr === "0" || mr === "0px")) return "right";

    return "left";

  }

  function applyImgAlign(img, align) {

    if (!img) return;

    align = align || "left";

    img.style.display = "block";

    if (!img.style.maxWidth) img.style.maxWidth = "100%";

    if (align === "center") {

      img.style.marginLeft = "auto";

      img.style.marginRight = "auto";

    } else if (align === "right") {

      img.style.marginLeft = "auto";

      img.style.marginRight = "0";

    } else {

      img.style.marginLeft = "0";

      img.style.marginRight = "auto";

    }

    syncFigureAlignState(img);

  }

  function syncFigureAlignState(img) {

    var figure = closestEl(img, "figure[data-ti-editor-figure]");

    if (!figure) return;

    var align = detectImgAlign(img);

    figure.dataset.tiImgAlign = align;

    Array.prototype.forEach.call(

      figure.querySelectorAll(".admin-editor-figure__align-btn"),

      function (btn) {

        var active = btn.getAttribute("data-align") === align;

        btn.classList.toggle("is-active", active);

        btn.setAttribute("aria-pressed", active ? "true" : "false");

      }

    );

  }

  function createAlignToolbar() {

    var group = document.createElement("div");

    group.className = "admin-editor-figure__align";

    group.setAttribute("role", "group");

    group.setAttribute("aria-label", "이미지 정렬");

    [

      { id: "left", label: "좌" },

      { id: "center", label: "중" },

      { id: "right", label: "우" }

    ].forEach(function (item) {

      var btn = document.createElement("button");

      btn.type = "button";

      btn.className = "admin-editor-figure__align-btn";

      btn.setAttribute("data-align", item.id);

      btn.title = item.id === "left" ? "왼쪽" : item.id === "center" ? "가운데" : "오른쪽";

      btn.textContent = item.label;

      group.appendChild(btn);

    });

    return group;

  }

  function bindFigureAlign(figure) {

    if (!figure || figure.dataset.tiAlignBound === "1") return;

    var toolbar = figure.querySelector(".admin-editor-figure__align");

    if (!toolbar) return;

    figure.dataset.tiAlignBound = "1";

    toolbar.addEventListener("click", function (e) {

      var btn = closestEl(e.target, ".admin-editor-figure__align-btn");

      if (!btn || !toolbar.contains(btn)) return;

      e.preventDefault();

      e.stopPropagation();

      var img = figure.querySelector("img");

      if (!img) return;

      applyImgAlign(img, btn.getAttribute("data-align"));

    });

  }

  function wrapImgAsFigure(img) {

    if (!img || closestEl(img, "figure[data-ti-editor-figure]")) return;

    var assetPath =

      img.getAttribute("data-ti-temp") ||

      pathFromImgSrc(img.getAttribute("src"));

    if (!assetPath) return;

    if (!img.getAttribute("data-ti-asset-key")) {

      img.setAttribute("data-ti-asset-key", normalizeAssetPath(assetPath));

    }

    var figure = document.createElement("figure");

    figure.className = "admin-editor-figure";

    figure.setAttribute("contenteditable", "false");

    figure.setAttribute("data-ti-editor-figure", "1");

    var align = createAlignToolbar();

    var del = document.createElement("button");

    del.type = "button";

    del.className = "admin-editor-figure__del";

    del.textContent = "삭제";

    var resize = document.createElement("span");

    resize.className = "admin-editor-figure__resize";

    resize.setAttribute("aria-hidden", "true");

    resize.title = "드래그하여 크기 조절";

    var parent = img.parentNode;

    parent.insertBefore(figure, img);

    figure.appendChild(img);

    figure.appendChild(align);

    figure.appendChild(del);

    figure.appendChild(resize);

    applyImgAlign(img, detectImgAlign(img));

    bindFigureAlign(figure);

    bindFigureResize(figure);

  }

  function bindFigureResize(figure) {

    if (!figure || figure.dataset.tiResizeBound === "1") return;

    var handle = figure.querySelector(".admin-editor-figure__resize");

    var img = figure.querySelector("img");

    if (!handle || !img) return;

    figure.dataset.tiResizeBound = "1";

    handle.addEventListener("mousedown", function (e) {

      e.preventDefault();

      e.stopPropagation();

      var body = editor && editor.getBodyEl();

      var maxWidth = body ? body.clientWidth : 720;

      var startX = e.clientX;

      var startWidth = img.getBoundingClientRect().width;

      figure.classList.add("is-resizing");

      function onMove(ev) {

        var nextWidth = Math.round(

          Math.max(80, Math.min(startWidth + (ev.clientX - startX), maxWidth))

        );

        img.style.width = nextWidth + "px";

        img.style.maxWidth = "100%";

        img.style.height = "auto";

        img.removeAttribute("height");

      }

      function onUp() {

        figure.classList.remove("is-resizing");

        document.removeEventListener("mousemove", onMove);

        document.removeEventListener("mouseup", onUp);

      }

      document.addEventListener("mousemove", onMove);

      document.addEventListener("mouseup", onUp);

    });

  }

  function enhanceFigureControls(figure) {

    if (!figure) return;

    if (!figure.querySelector(".admin-editor-figure__align")) {

      figure.insertBefore(createAlignToolbar(), figure.firstChild);

    }

    if (!figure.querySelector(".admin-editor-figure__resize")) {

      var resize = document.createElement("span");

      resize.className = "admin-editor-figure__resize";

      resize.setAttribute("aria-hidden", "true");

      resize.title = "드래그하여 크기 조절";

      figure.appendChild(resize);

    }

    var img = figure.querySelector("img");

    if (img) applyImgAlign(img, detectImgAlign(img));

    bindFigureAlign(figure);

    bindFigureResize(figure);

  }

  function enhanceAllBodyImages() {

    if (!editor) return;

    var body = editor.getBodyEl();

    if (!body) return;

    var imgs = body.querySelectorAll("img");

    Array.prototype.forEach.call(imgs, wrapImgAsFigure);

    Array.prototype.forEach.call(body.querySelectorAll("figure[data-ti-editor-figure]"), enhanceFigureControls);

  }

  function removeFiguresByAsset(assetPath) {

    if (!editor) return;

    var key = normalizeAssetPath(assetPath);

    var body = editor.getBodyEl();

    if (!body) return;

    var figures = body.querySelectorAll("figure[data-ti-editor-figure]");

    Array.prototype.forEach.call(figures, function (fig) {

      var img = fig.querySelector("img");

      if (!img) return;

      var imgKey =

        img.getAttribute("data-ti-asset-key") ||

        img.getAttribute("data-ti-temp") ||

        pathFromImgSrc(img.getAttribute("src"));

      if (normalizeAssetPath(imgKey) === key) {

        fig.parentNode.removeChild(fig);

      }

    });

  }

  function initPoolFromHtml(html) {

    var box = document.createElement("div");

    box.innerHTML = html || "";

    var seen = {};

    bodyImagePool = [];

    var imgs = box.querySelectorAll("img");

    Array.prototype.forEach.call(imgs, function (img) {

      var tempPath = img.getAttribute("data-ti-temp");

      var src = img.getAttribute("src") || "";

      var assetPath = tempPath || pathFromImgSrc(src);

      if (!assetPath || seen[assetPath]) return;

      seen[assetPath] = true;

      bodyImagePool.push({

        id: newBodyImageId(),

        assetPath: normalizeAssetPath(assetPath),

        tempPath: tempPath || null,

        previewUrl: tempPath ? resolveAssetUrl(tempPath) : resolveAssetUrl(src) || src

      });

    });

  }

  function renderBodyImageGallery() {
    var list = document.getElementById("bodyImageList");
    var empty = document.getElementById("bodyImageGalleryEmpty");
    if (!list) return;

    var hasItems = bodyImagePool.length > 0;
    if (empty) empty.hidden = hasItems;
    list.hidden = !hasItems;

    if (!hasItems) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML = bodyImagePool

      .map(function (item) {

        return (

          '<div class="admin-body-image-thumb" draggable="true" data-body-img-id="' +

          esc(item.id) +

          '">' +

          '<img src="' +

          esc(item.previewUrl) +

          '" alt="">' +

          '<button type="button" class="admin-body-image-thumb__del" data-body-img-rm="' +

          esc(item.id) +

          '" aria-label="이미지 삭제">×</button>' +

          "</div>"

        );

      })

      .join("");

    Array.prototype.forEach.call(

      list.querySelectorAll(".admin-body-image-thumb"),

      function (thumb) {

        var id = thumb.getAttribute("data-body-img-id");

        thumb.addEventListener("dragstart", function (e) {

          e.dataTransfer.setData(BODY_IMG_DRAG_TYPE, id);

          e.dataTransfer.effectAllowed = "copy";

        });

      }

    );

    Array.prototype.forEach.call(

      list.querySelectorAll("[data-body-img-rm]"),

      function (btn) {

        btn.addEventListener("click", function (e) {

          e.stopPropagation();

          var id = btn.getAttribute("data-body-img-rm");

          removeBodyImageFromPool(id);

        });

      }

    );

  }

  function addBodyImageToPool(tempPath, previewUrl, insertAtCursor) {

    var item = {

      id: newBodyImageId(),

      assetPath: normalizeAssetPath(tempPath),

      tempPath: tempPath,

      previewUrl: previewUrl

    };

    bodyImagePool.push(item);

    renderBodyImageGallery();

    if (insertAtCursor && editor) {
      try {
        editor.restoreSelection();
        editor.insertHtmlAtCursor(buildBodyImgHtml(item));
        enhanceAllBodyImages();
      } catch (insertErr) {
        console.error("본문 이미지 삽입 실패:", insertErr);
      }
    }

    return item;

  }

  function removeBodyImageFromPool(id) {

    var item = findPoolItem(id);

    if (!item) return;

    removeFiguresByAsset(item.assetPath);

    bodyImagePool = bodyImagePool.filter(function (p) {

      return p.id !== id;

    });

    renderBodyImageGallery();

  }

  function updateCoverPreview() {

    var wrap = document.getElementById("coverPreview");

    var img = document.getElementById("coverPreviewImg");

    var spinner = document.getElementById("coverPreviewSpinner");

    var deleteBtn = document.getElementById("coverDeleteBtn");

    if (!wrap || !img) return;

    var hasReal = false;

    var src = resolveAssetUrl(MAGAZINE_COVER_PLACEHOLDER);

    if (!coverState.removed) {

      if (coverState.previewUrl) {

        src = coverState.previewUrl;

        hasReal = true;

      } else if (coverState.existingPath) {

        src = resolveAssetUrl(coverState.existingPath);

        hasReal = true;

      }

    }

    img.src = src;

    img.classList.toggle("is-placeholder", !hasReal);

    if (spinner) {
      spinner.classList.toggle("is-active", !!coverState.uploading);
    }

    if (deleteBtn) {

      deleteBtn.hidden = !hasReal || coverState.uploading;

    }

    img.style.visibility = coverState.uploading ? "hidden" : "visible";

    wrap.hidden = false;

  }

  function setCoverUploading(loading) {
    coverState.uploading = !!loading;
    var pickLabel = document.getElementById("coverPickLabel");
    if (pickLabel) pickLabel.classList.toggle("is-disabled", loading);
    updateCoverPreview();
  }

  function bindTitleAutofill() {

    var titleEl = document.getElementById("title");

    var movieEl = document.getElementById("movieTitle");

    var subtitleEl = document.getElementById("subtitle");

    if (!titleEl || !movieEl || !subtitleEl) return;

    titleEl.addEventListener("input", function () {

      var parsed = parseTitleFields(titleEl.value);

      movieEl.value = parsed.movieTitle;

      subtitleEl.value = parsed.subtitle;

    });

  }

  function bindCoverUpload() {
    var fileInput = document.getElementById("coverUpload");
    var deleteBtn = document.getElementById("coverDeleteBtn");
    if (!fileInput) return;

    fileInput.addEventListener("change", function () {

      var file = fileInput.files && fileInput.files[0];

      fileInput.value = "";

      if (!file) return;

      setCoverUploading(true);

      TiAdminApi.uploadMagazineTemp(file)
        .then(assertTempUploadResponse)
        .then(function (res) {
          coverState.tempPath = res.path;
          coverState.previewUrl = resolveAssetUrl(res.path);
          coverState.removed = false;
          updateCoverPreview();
        })

        .catch(function (err) {

          alert(err.message || "커버 이미지 업로드 실패");

        })

        .finally(function () {

          setCoverUploading(false);

        });

    });

    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        coverState.tempPath = null;
        coverState.previewUrl = null;
        coverState.removed = true;
        updateCoverPreview();
      });
    }
  }

  var bodyUploadStatusTimer = null;

  function setBodyUploadStatus(message, state) {
    var status = document.getElementById("bodyUploadStatus");
    var pickLabel = document.getElementById("bodyPickLabel");
    if (!status) return;

    if (bodyUploadStatusTimer) {
      clearTimeout(bodyUploadStatusTimer);
      bodyUploadStatusTimer = null;
    }

    status.classList.remove("is-active", "is-error", "is-success");
    status.innerHTML = "";

    if (pickLabel) pickLabel.classList.toggle("is-disabled", state === "loading");

    if (!message) {
      status.classList.remove("is-active");
      return;
    }

    if (state === "loading") {
      status.classList.add("is-active");
      status.innerHTML =
        '<span class="admin-spinner" aria-hidden="true"></span><span>' +
        esc(message) +
        "</span>";
      return;
    }

    status.classList.add("is-active", state === "error" ? "is-error" : "is-success");
    status.textContent = message;

    if (state !== "loading") {
      bodyUploadStatusTimer = setTimeout(function () {
        setBodyUploadStatus("", null);
      }, 4000);
    }
  }

  function uploadBodyFiles(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;

    var total = list.length;
    var done = 0;
    var failed = 0;

    setBodyUploadStatus("업로드 중… (0/" + total + ")", "loading");

    function next() {
      if (!list.length) {
        if (failed > 0 && failed === done) {
          setBodyUploadStatus("업로드 실패 (" + failed + "장)", "error");
        } else if (failed > 0) {
          setBodyUploadStatus(
            "업로드 완료 " + (done - failed) + "장, 실패 " + failed + "장",
            "error"
          );
        } else if (done > 0) {
          setBodyUploadStatus("업로드 완료 (" + done + "장)", "success");
        } else {
          setBodyUploadStatus("", null);
        }
        return;
      }

      var file = list.shift();

      TiAdminApi.uploadMagazineTemp(file)
        .then(assertTempUploadResponse)
        .then(function (res) {
          var preview = resolveAssetUrl(res.path);
          addBodyImageToPool(res.path, preview, true);
          done += 1;
          setBodyUploadStatus("업로드 중… (" + done + "/" + total + ")", "loading");
          next();
        })
        .catch(function (err) {
          failed += 1;
          done += 1;
          console.error("본문 이미지 업로드 실패:", err);
          setBodyUploadStatus("업로드 중… (" + done + "/" + total + ")", "loading");
          next();
        });
    }

    next();
  }

  function bindBodyImageUpload() {
    var fileInput = document.getElementById("bodyUpload");
    if (!fileInput) return;

    fileInput.addEventListener("click", function () {
      if (editor) editor.saveSelection();
    });

    fileInput.addEventListener("change", function () {
      var files = fileInput.files;
      if (!files || !files.length) {
        fileInput.value = "";
        return;
      }
      var picked = Array.prototype.slice.call(files);
      fileInput.value = "";
      uploadBodyFiles(picked);
    });
  }

  function bindEditorBodyImages() {

    var body = editor.getBodyEl();

    if (!body) return;

    body.addEventListener("click", function (e) {

      var btn = closestEl(e.target, ".admin-editor-figure__del");

      if (!btn || !body.contains(btn)) return;

      e.preventDefault();

      var figure = closestEl(btn, "figure[data-ti-editor-figure]");

      if (figure) figure.parentNode.removeChild(figure);

    });

    body.addEventListener("dragover", function (e) {

      if (!e.dataTransfer.types) return;

      var types = Array.prototype.slice.call(e.dataTransfer.types);

      if (types.indexOf(BODY_IMG_DRAG_TYPE) === -1) return;

      e.preventDefault();

      e.dataTransfer.dropEffect = "copy";

    });

    body.addEventListener("drop", function (e) {

      var id = e.dataTransfer.getData(BODY_IMG_DRAG_TYPE);

      if (!id) return;

      e.preventDefault();

      var item = findPoolItem(id);

      if (!item) return;

      editor.insertHtmlAtPoint(e.clientX, e.clientY, buildBodyImgHtml(item));

      enhanceAllBodyImages();

    });

  }

  function renderForm(detail) {

    var parsed = parseTitleFields(detail && detail.title);

    var publishedDefault =

      detail && detail.publishedLabel

        ? detail.publishedLabel

        : isNew

          ? todayPublishedLabel()

          : "";

    coverState = {

      tempPath: null,

      previewUrl: null,

      existingPath: detail && detail.imgCover ? detail.imgCover : null,

      removed: false,

      uploading: false

    };

    el.innerHTML =

      '<form class="admin-form" id="mzForm">' +

      (isNew

        ? '<div class="field"><label>섹션</label><select id="section"><option value="preview">프리뷰</option><option value="serial">연재</option><option value="gv-moment">GV모먼트</option></select></div>'

        : '<div class="admin-meta-badges">' +
          '<span class="admin-badge admin-badge--seq">seq ' +
          esc(String(detail.seq)) +
          "</span>" +
          '<span class="admin-badge admin-badge--section' +
          (detail.isPast ? " admin-badge--past" : "") +
          '">' +
          esc(sectionLabel(detail.section, detail.isPast)) +
          "</span></div>") +

      '<div class="field"><label>제목</label><input type="text" id="title" required value="' +

      esc(detail && detail.title) +

      '"></div>' +

      field(

        "movieTitle",

        "영화 제목",

        (detail && detail.movieTitle) || parsed.movieTitle,

        { maxlength: 300 }

      ) +

      field(

        "subtitle",

        "부제",

        (detail && detail.subtitle) || parsed.subtitle,

        { maxlength: 300 }

      ) +

      field("publishedLabel", "게시일 라벨", publishedDefault, { maxlength: 120 }) +

      '<div class="field"><label>커버 이미지</label>' +

      '<input type="file" id="coverUpload" class="admin-sr-only-file" accept="image/*">' +

      '<label for="coverUpload" class="admin-btn admin-btn--upload admin-file-label" id="coverPickLabel">이미지 선택</label>' +

      '<p class="field-hint">저장 시 wm_{seq}_cover 로 업로드되고, 456×346 썸네일이 자동 생성됩니다.</p>' +

      '<div class="admin-cover-preview" id="coverPreview">' +

      '<img id="coverPreviewImg" alt="커버 미리보기">' +

      '<div class="admin-cover-preview__spinner" id="coverPreviewSpinner">' +

      '<span class="admin-spinner" aria-hidden="true"></span>' +

      '<span class="admin-cover-preview__spinner-label">업로드 중…</span>' +

      "</div>" +

      '<button type="button" class="admin-cover-delete" id="coverDeleteBtn" hidden>삭제</button>' +

      "</div></div>" +

      '<div class="field"><label>본문 HTML</label><div id="editorMount"></div></div>' +

      '<div class="field"><label>본문 이미지</label>' +

      '<input type="file" id="bodyUpload" class="admin-sr-only-file" accept="image/*" multiple>' +

      '<label for="bodyUpload" class="admin-btn admin-btn--upload admin-file-label" id="bodyPickLabel">본문 이미지 업로드</label>' +

      '<div class="admin-upload-status" id="bodyUploadStatus" aria-live="polite"></div>' +

      '<p class="field-hint">커서 위치에 삽입됩니다. 여러 장 선택 가능. 하단 썸네일을 드래그해 본문 원하는 위치에 놓을 수 있습니다.</p>' +

      '<div class="admin-body-image-gallery" id="bodyImageGallery">' +

      '<p class="admin-body-image-gallery__label">업로드된 본문 이미지 — 드래그하여 본문에 삽입</p>' +

      '<div class="admin-body-image-gallery__list" id="bodyImageList" hidden></div>' +

      '<p class="admin-body-image-gallery__empty" id="bodyImageGalleryEmpty">아직 업로드된 본문 이미지가 없습니다.</p>' +

      "</div></div>" +

      field("sourceUrl", "원본 URL (티스토리)", detail && detail.sourceUrl, { maxlength: 500 }) +

      '<div class="admin-form-actions">' +

      '<button type="submit" class="admin-btn admin-btn--primary">저장</button>' +

      '<a class="admin-btn" href="' + esc(magazineListUrl()) + '">목록</a>' +

      "</div></form>";

    var rawBodyHtml = (detail && detail.bodyHtml) || "";

    initPoolFromHtml(rawBodyHtml);

    var initialHtml = prepareBodyHtmlForEditor(rawBodyHtml);

    editor = TiHtmlEditor.create(

      document.getElementById("editorMount"),

      initialHtml,

      {
        showLists: false,
        showImageUrl: false,
        showFontSize: true,
        showDivider: true,
        showColor: true,
        keepColor: true,
        linkInline: true,
        showQuote: true,
        showTextBox: true,
        allowParagraphs: true,
        showHeadings: true,
        showBlockAlign: true,
        preserveImageSize: true
      }

    );

    enhanceAllBodyImages();

    bindEditorBodyImages();

    bindTitleAutofill();

    bindCoverUpload();

    bindBodyImageUpload();

    updateCoverPreview();

    renderBodyImageGallery();

    document.getElementById("mzForm").onsubmit = function (e) {

      e.preventDefault();

      var submitBtn = e.submitter || document.querySelector("#mzForm button[type=submit]");

      if (submitBtn) submitBtn.disabled = true;

      var body = {

        title: val("title"),

        movieTitle: val("movieTitle") || null,

        subtitle: val("subtitle") || null,

        publishedLabel: val("publishedLabel") || null,

        bodyHtml: editor.getHtml(),

        sourceUrl: val("sourceUrl") || null,

        coverTempPath: coverState.tempPath,

        removeCover: coverState.removed && !coverState.tempPath

      };

      if (!coverState.removed && !coverState.tempPath && !coverState.existingPath && !isNew) {

        delete body.removeCover;

        delete body.coverTempPath;

      }

      var p = isNew

        ? TiAdminApi.createMagazine({

            section: document.getElementById("section").value,

            title: body.title,

            movieTitle: body.movieTitle,

            subtitle: body.subtitle,

            publishedLabel: body.publishedLabel,

            bodyHtml: body.bodyHtml,

            sourceUrl: body.sourceUrl,

            coverTempPath: body.coverTempPath,

            removeCover: body.removeCover

          })

        : TiAdminApi.updateMagazine(seq, body);

      p.then(function (saved) {

        alert("저장되었습니다. (seq " + saved.seq + ")");

        if (!isNew && window.TiAdminDetailEdit && TiAdminDetailEdit.redirectAfterSave()) {
          return;
        }

        if (isNew) {

          window.location.href =

            "magazine-edit.html?seq=" + encodeURIComponent(String(saved.seq));

          return;

        }

        coverState.existingPath = saved.imgCover || null;

        coverState.tempPath = null;

        coverState.previewUrl = null;

        coverState.removed = false;

        updateCoverPreview();

        if (saved.bodyHtml) {

          editor.setHtml(prepareBodyHtmlForEditor(saved.bodyHtml));

          initPoolFromHtml(saved.bodyHtml);

          enhanceAllBodyImages();

          renderBodyImageGallery();

        }

      })

        .catch(function (err) {

          alert(err.message || "저장에 실패했습니다.");

        })

        .finally(function () {

          if (submitBtn) submitBtn.disabled = false;

        });

    };

  }

  if (isNew) {

    renderForm(null);

  } else {

    el.innerHTML = "<p>불러오는 중…</p>";

    TiAdminApi.getMagazine(seq)

      .then(renderForm)

      .catch(function (err) {

        el.innerHTML =

          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";

      });

  }

  });
})();


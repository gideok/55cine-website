(function () {
  TiAdminAuth.guard(function () {

  var params = new URLSearchParams(window.location.search);
  var seq = Number(params.get("seq"));
  var isNew = !seq || Number.isNaN(seq);
  var editor = null;
  var detailRef = null;

  var imageState = {
    existingPath: null,
    tempPath: null,
    previewUrl: null,
    removed: false,
    uploading: false
  };

  TiAdminLayout.mount("notice", isNew ? "공지사항 추가" : "공지사항 수정");
  var el = TiAdminLayout.contentEl();

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveAssetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path) || /^blob:/i.test(path)) return path;
    var rel = String(path).replace(/^\//, "");
    if (window.TiSiteRoot && typeof window.TiSiteRoot.relativePrefix === "function") {
      return window.TiSiteRoot.relativePrefix() + rel;
    }
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(rel);
    }
    return "../" + rel;
  }

  function layoutCss(width) {
    var w = Number(width) || 100;
    var margin = 5 * (w / 100);
    var content = w - margin * 2;
    return { width: content + "%", margin: margin + "%" };
  }

  function updatePreviewWidth() {
    var wrap = document.getElementById("noticePreviewBox");
    if (!wrap) return;
    var checked = document.querySelector('input[name="contentWidth"]:checked');
    var w = checked ? Number(checked.value) : 100;
    var layout = layoutCss(w);
    wrap.style.width = layout.width;
    wrap.style.margin = layout.margin + " auto";
  }

  function updateImagePreview() {
    var img = document.getElementById("noticeMainImg");
    var delBtn = document.getElementById("noticeImgDelete");
    if (!img) return;
    var src = "";
    if (!imageState.removed) {
      if (imageState.previewUrl) src = imageState.previewUrl;
      else if (imageState.existingPath) src = resolveAssetUrl(imageState.existingPath);
    }
    img.src = src || "";
    img.hidden = !src;
    if (delBtn) delBtn.hidden = !src || imageState.uploading;
  }

  function toggleFormatSections() {
    var format =
      document.querySelector('input[name="formatType"]:checked')?.value || "text";
    var imageSec = document.getElementById("noticeImageSection");
    if (imageSec) imageSec.hidden = format !== "image-text";
    updatePreviewWidth();
  }

  function bindImageUpload() {
    var input = document.getElementById("noticeImageUpload");
    var delBtn = document.getElementById("noticeImgDelete");
    if (input) {
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        input.value = "";
        if (!file) return;
        imageState.uploading = true;
        updateImagePreview();
        TiAdminApi.uploadNoticeTemp(file)
          .then(function (res) {
            if (!res || !res.path) throw new Error("업로드 실패");
            imageState.tempPath = res.path;
            imageState.previewUrl = resolveAssetUrl(res.path);
            imageState.removed = false;
            updateImagePreview();
          })
          .catch(function (err) {
            alert(err.message || "이미지 업로드 실패");
          })
          .finally(function () {
            imageState.uploading = false;
            updateImagePreview();
          });
      });
    }
    if (delBtn) {
      delBtn.addEventListener("click", function () {
        imageState.tempPath = null;
        imageState.previewUrl = null;
        imageState.existingPath = null;
        imageState.removed = true;
        updateImagePreview();
      });
    }
  }

  function initEditor(html) {
    var mount = document.getElementById("noticeEditorMount");
    if (!mount || !window.TiHtmlEditor) return;
    mount.innerHTML = "";
    editor = TiHtmlEditor.create(mount, html || "", {
      showLists: false,
      showImageUrl: false,
      showDivider: true,
      showColor: true,
      keepColor: true,
      linkAsButton: true,
      allowParagraphs: true
    });
  }

  function renderForm(detail) {
    detailRef = detail;
    var format = detail ? detail.formatType : "text";
    var width = detail ? detail.contentWidth : 100;

    el.innerHTML =
      '<p class="admin-back"><a href="notice.html">← 공지 목록</a></p>' +
      '<form class="admin-form" id="noticeForm">' +
      (detail && detail.isActive
        ? '<p class="admin-msg admin-msg--info">현재 <strong>활성</strong> 공지입니다.</p>'
        : "") +
      '<div class="field"><label for="noticeTitle">관리 제목 <span class="admin-req">*</span></label>' +
      '<input type="text" id="noticeTitle" name="title" required maxlength="200" value="' +
      esc(detail ? detail.title : "") +
      '"></div>' +
      '<div class="field"><label>형식</label>' +
      '<div class="admin-radio-row">' +
      '<label><input type="radio" name="formatType" value="image-text"' +
      (format === "image-text" ? " checked" : "") +
      "> 이미지+텍스트</label>" +
      '<label><input type="radio" name="formatType" value="text"' +
      (format === "text" ? " checked" : "") +
      "> 텍스트</label></div></div>" +
      '<div class="field"><label>폭 옵션</label>' +
      '<div class="admin-radio-row">' +
      [100, 50, 30]
        .map(function (w) {
          return (
            '<label><input type="radio" name="contentWidth" value="' +
            w +
            '"' +
            (Number(width) === w ? " checked" : "") +
            "> " +
            w +
            "%</label>"
          );
        })
        .join("") +
      '<p class="field-hint">선택 폭 기준 상·하·좌·우 5% 여백(50%→2.5%, 30%→1.5%)이 적용됩니다.</p></div>' +
      '<div id="noticeImageSection"' +
      (format === "image-text" ? "" : " hidden") +
      '>' +
      '<div class="field"><label>대표 이미지</label>' +
      '<input type="file" id="noticeImageUpload" class="admin-sr-only-file" accept="image/*">' +
      '<label for="noticeImageUpload" class="admin-btn admin-btn--upload admin-file-label">이미지 선택</label>' +
      '<div class="admin-cover-preview admin-cover-preview--notice">' +
      '<img id="noticeMainImg" alt="공지 이미지 미리보기" hidden>' +
      '<button type="button" class="admin-cover-delete" id="noticeImgDelete" hidden>삭제</button>' +
      "</div></div></div>" +
      '<div class="field"><label>본문</label>' +
      '<div id="noticeEditorMount"></div></div>' +
      '<div class="field"><label>미리보기 (폭·여백)</label>' +
      '<div class="admin-notice-preview-frame">' +
      '<div class="admin-notice-preview-box" id="noticePreviewBox">' +
      '<div class="admin-notice-preview-inner" id="noticePreviewInner"></div>' +
      "</div></div></div>" +
      '<div class="admin-form-actions">' +
      '<button type="submit" class="admin-btn admin-btn--primary">저장</button>' +
      (detail && !detail.isActive
        ? '<button type="button" class="admin-btn" id="noticeActivateBtn">저장 후 활성화</button>'
        : "") +
      '<a class="admin-btn" href="notice.html">취소</a>' +
      "</div></form>";

    imageState = {
      existingPath: detail && detail.imgMain ? detail.imgMain : null,
      tempPath: null,
      previewUrl: null,
      removed: false,
      uploading: false
    };

    initEditor(detail ? detail.bodyHtml || "" : "");
    bindImageUpload();
    updateImagePreview();
    updatePreviewWidth();

    document.querySelectorAll('input[name="formatType"]').forEach(function (r) {
      r.addEventListener("change", toggleFormatSections);
    });
    document.querySelectorAll('input[name="contentWidth"]').forEach(function (r) {
      r.addEventListener("change", updatePreviewWidth);
    });

    var previewInner = document.getElementById("noticePreviewInner");
    if (previewInner && editor) {
      var syncPreview = function () {
        previewInner.innerHTML = editor.getHtml();
      };
      editor.getBodyEl().addEventListener("input", syncPreview);
      syncPreview();
    }

    var activateAfterSave = false;
    var activateBtn = document.getElementById("noticeActivateBtn");
    if (activateBtn) {
      activateBtn.addEventListener("click", function () {
        activateAfterSave = true;
        document.getElementById("noticeForm").requestSubmit();
      });
    }

    document.getElementById("noticeForm").onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      var formatType = f.formatType.value;
      var payload = {
        title: f.title.value.trim(),
        formatType: formatType,
        contentWidth: Number(f.contentWidth.value),
        bodyHtml: editor ? editor.getHtml() : "",
        mainImageTempPath: imageState.tempPath,
        removeMainImage: imageState.removed
      };

      if (!payload.title) {
        alert("관리 제목을 입력해 주세요.");
        return;
      }

      var savePromise = isNew
        ? TiAdminApi.createNotice(payload)
        : TiAdminApi.updateNotice(seq, payload);

      savePromise
        .then(function (saved) {
          if (activateAfterSave && saved && saved.seq) {
            return TiAdminApi.activateNotice(saved.seq).then(function () {
              return saved;
            });
          }
          return saved;
        })
        .then(function () {
          alert(activateAfterSave ? "저장 후 활성화되었습니다." : "저장되었습니다.");
          window.location.href = "notice.html";
        })
        .catch(function (err) {
          alert(err.message || "저장 실패");
          activateAfterSave = false;
        });
    };
  }

  if (isNew) {
    renderForm(null);
  } else {
    el.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getNotice(seq)
      .then(renderForm)
      .catch(function (err) {
        el.innerHTML =
          '<div class="admin-msg admin-msg--error">' +
          esc(err.message) +
          '</div><p><a href="notice.html">← 공지 목록</a></p>';
      });
  }
  });
})();

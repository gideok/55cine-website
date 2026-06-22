(function () {
  if (!window.TiAdminAuth.require()) return;

  var settingsRef = null;
  var docState = {
    existingPath: null,
    tempPath: null,
    removed: false,
    uploading: false
  };

  TiAdminLayout.mount("settings", "사이트 설정");
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
    if (/^https?:\/\//i.test(path)) return path;
    var rel = String(path).replace(/^\//, "");
    if (window.TiSiteRoot && typeof window.TiSiteRoot.relativePrefix === "function") {
      return window.TiSiteRoot.relativePrefix() + rel;
    }
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(rel);
    }
    return "../" + rel;
  }

  function updateDocPreview() {
    var preview = document.getElementById("donationDocPreview");
    var removeBtn = document.getElementById("donationDocRemove");
    if (!preview) return;
    var path = "";
    if (!docState.removed) {
      path = docState.tempPath || docState.existingPath || "";
    }
    if (path) {
      preview.innerHTML =
        '<a href="' +
        esc(resolveAssetUrl(path)) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(path) +
        "</a>";
      preview.hidden = false;
    } else {
      preview.innerHTML = '<span class="field-hint">등록된 파일 없음</span>';
      preview.hidden = false;
    }
    if (removeBtn) removeBtn.hidden = !path || docState.uploading;
  }

  function renderForm(data) {
    settingsRef = data;
    docState.existingPath = data.donationDocPath || null;
    docState.tempPath = null;
    docState.removed = false;
    docState.uploading = false;

    el.innerHTML =
      '<form class="admin-form" id="siteSettingsForm">' +
      '<section class="admin-settings-section">' +
      "<h2>멤버십</h2>" +
      '<div class="field"><label for="membershipCmsLabel">CMS 링크 라벨</label>' +
      '<input type="text" id="membershipCmsLabel" name="membershipCmsLabel" maxlength="100" value="' +
      esc(data.membershipCmsLabel || "CMS 링크") +
      '" /></div>' +
      '<div class="field"><label for="membershipCmsUrl">CMS 링크 URL</label>' +
      '<input type="url" id="membershipCmsUrl" name="membershipCmsUrl" maxlength="500" value="' +
      esc(data.membershipCmsUrl || "") +
      '" placeholder="https://..." />' +
      '<p class="field-hint">멤버십 가입 섹션에 표시되는 외부 결제·가입 링크입니다.</p></div>' +
      '<div class="field"><label for="donationDocLabel">기부금 명세서 라벨</label>' +
      '<input type="text" id="donationDocLabel" name="donationDocLabel" maxlength="200" value="' +
      esc(data.donationDocLabel || "") +
      '" placeholder="2025년 기부금 모금액 및 활용실적명세서" /></div>' +
      '<div class="field"><label>기부금 명세서 PDF</label>' +
      '<div id="donationDocPreview"></div>' +
      '<div class="admin-form-actions" style="margin-top:0.75rem">' +
      '<label class="admin-file-label admin-btn admin-btn--upload">' +
      "PDF 업로드" +
      '<input type="file" id="donationDocUpload" accept="application/pdf,.pdf" hidden />' +
      "</label>" +
      '<button type="button" class="admin-btn admin-btn--ghost" id="donationDocRemove" hidden>파일 제거</button>' +
      "</div>" +
      '<p class="field-hint">PDF만 업로드할 수 있습니다. 저장 시 documents/ 폴더에 반영됩니다.</p></div>' +
      "</section>" +
      '<section class="admin-settings-section">' +
      "<h2>좌석후원</h2>" +
      '<div class="field"><label for="seatSponsorLabel">후원하기 버튼 라벨</label>' +
      '<input type="text" id="seatSponsorLabel" name="seatSponsorLabel" maxlength="100" value="' +
      esc(data.seatSponsorLabel || "후원하기") +
      '" /></div>' +
      '<div class="field"><label for="seatSponsorUrl">후원하기 링크 URL</label>' +
      '<input type="url" id="seatSponsorUrl" name="seatSponsorUrl" maxlength="500" value="' +
      esc(data.seatSponsorUrl || "") +
      '" placeholder="https://..." />' +
      '<p class="field-hint">좌석후원 페이지 하단 버튼에 연결됩니다.</p></div>' +
      "</section>" +
      '<section class="admin-settings-section">' +
      "<h2>대관</h2>" +
      '<div class="field"><label for="rentalFormLabel">신청서 버튼 라벨</label>' +
      '<input type="text" id="rentalFormLabel" name="rentalFormLabel" maxlength="100" value="' +
      esc(data.rentalFormLabel || "대관 신청서") +
      '" /></div>' +
      '<div class="field"><label for="rentalFormUrl">대관 신청서 링크 URL</label>' +
      '<input type="url" id="rentalFormUrl" name="rentalFormUrl" maxlength="500" value="' +
      esc(data.rentalFormUrl || "") +
      '" placeholder="https://..." />' +
      '<p class="field-hint">대관 페이지 상단 신청서 버튼에 연결됩니다.</p></div>' +
      "</section>" +
      '<div class="admin-form-actions">' +
      '<button type="submit" class="admin-btn admin-btn--primary" id="siteSettingsSave">저장</button>' +
      (data.updatedAt
        ? '<span class="field-hint">마지막 저장: ' + esc(data.updatedAt) + "</span>"
        : "") +
      "</div>" +
      "</form>";

    updateDocPreview();
    bindForm();
  }

  function bindForm() {
    var form = document.getElementById("siteSettingsForm");
    var uploadInput = document.getElementById("donationDocUpload");
    var removeBtn = document.getElementById("donationDocRemove");

    if (uploadInput) {
      uploadInput.addEventListener("change", function () {
        var file = uploadInput.files && uploadInput.files[0];
        uploadInput.value = "";
        if (!file) return;
        if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
          alert("PDF 파일만 업로드할 수 있습니다.");
          return;
        }
        docState.uploading = true;
        updateDocPreview();
        TiAdminApi.uploadSiteDocumentTemp(file)
          .then(function (res) {
            if (!res || !res.path) throw new Error("업로드 실패");
            docState.tempPath = res.path;
            docState.removed = false;
          })
          .catch(function (err) {
            alert(err.message || "PDF 업로드 실패");
          })
          .finally(function () {
            docState.uploading = false;
            updateDocPreview();
          });
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        docState.tempPath = null;
        docState.removed = true;
        updateDocPreview();
      });
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var saveBtn = document.getElementById("siteSettingsSave");
        if (saveBtn) saveBtn.disabled = true;

        var body = {
          membershipCmsLabel: form.membershipCmsLabel.value.trim(),
          membershipCmsUrl: form.membershipCmsUrl.value.trim() || null,
          donationDocLabel: form.donationDocLabel.value.trim() || null,
          seatSponsorLabel: form.seatSponsorLabel.value.trim(),
          seatSponsorUrl: form.seatSponsorUrl.value.trim() || null,
          rentalFormLabel: form.rentalFormLabel.value.trim(),
          rentalFormUrl: form.rentalFormUrl.value.trim() || null
        };

        if (docState.tempPath) body.donationDocTempPath = docState.tempPath;
        if (docState.removed) body.removeDonationDoc = true;

        TiAdminApi.updateSiteSettings(body)
          .then(function (saved) {
            renderForm(saved);
            alert("저장되었습니다.");
          })
          .catch(function (err) {
            alert(err.message || "저장 실패");
          })
          .finally(function () {
            if (saveBtn) saveBtn.disabled = false;
          });
      });
    }
  }

  TiAdminApi.getSiteSettings()
    .then(renderForm)
    .catch(function (err) {
      el.innerHTML =
        '<p class="admin-msg admin-msg--error">' +
        esc(err.message || "설정을 불러오지 못했습니다.") +
        "</p>";
    });
})();

(function () {
  if (!window.TiAdminAuth.require()) return;

  var params = new URLSearchParams(window.location.search);
  var publicId = params.get("id");
  var isNew = !publicId;
  var editor = null;
  var imageIndex = 1;

  TiAdminLayout.mount("magazine", isNew ? "매거진 기사 추가" : "매거진 기사 수정");
  var el = TiAdminLayout.contentEl();

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function field(id, label, val) {
    return (
      '<div class="field"><label>' +
      label +
      '</label><input type="text" id="' +
      id +
      '" value="' +
      esc(val) +
      '"></div>'
    );
  }

  function val(id) {
    var n = document.getElementById(id);
    return n ? n.value.trim() : "";
  }

  function renderForm(detail) {
    el.innerHTML =
      '<form class="admin-form" id="mzForm">' +
      '<input type="hidden" id="magazineSeq" value="' +
      (detail ? detail.seq : "") +
      '">' +
      (isNew
        ? '<div class="field"><label>public_id</label><input type="text" id="publicId" required placeholder="pv001 / sr001 / gm001"></div>' +
          '<div class="field"><label>섹션</label><select id="section"><option value="preview">프리뷰</option><option value="serial">연재</option><option value="gv-moment">GV모먼트</option></select></div>'
        : "<p><strong>ID:</strong> " +
          esc(detail.publicId) +
          " · " +
          (detail.isPast ? "지난기사" : detail.section) +
          "</p>") +
      '<div class="field"><label>제목</label><input type="text" id="title" required value="' +
      esc(detail && detail.title) +
      '"></div>' +
      field("movieTitle", "영화 제목", detail && detail.movieTitle) +
      field("subtitle", "부제", detail && detail.subtitle) +
      field("publishedLabel", "게시일 라벨", detail && detail.publishedLabel) +
      field("excerpt", "요약", detail && detail.excerpt) +
      field("imgThumb", "썸네일 경로", detail && detail.imgThumb) +
      field("imgCover", "커버 이미지 경로", detail && detail.imgCover) +
      '<div class="field"><label>본문 이미지 업로드</label><input type="file" id="bodyUpload" accept="image/*"></div>' +
      '<div class="field"><label>본문 HTML</label><div id="editorMount"></div></div>' +
      field("sourceUrl", "원본 URL", detail && detail.sourceUrl) +
      field("articleUrl", "기사 URL", detail && detail.articleUrl) +
      field("listOrder", "정렬 순서", detail ? detail.listOrder : 0) +
      '<div class="admin-form-actions">' +
      '<button type="submit" class="admin-btn admin-btn--primary">저장</button>' +
      '<a class="admin-btn" href="magazine.html">목록</a>' +
      "</div></form>";

    if (detail && detail.section && isNew === false) {
      /* section shown in header only */
    }

    editor = TiHtmlEditor.create(
      document.getElementById("editorMount"),
      (detail && detail.bodyHtml) || ""
    );

    document.getElementById("bodyUpload").onchange = function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var seq = Number(document.getElementById("magazineSeq").value);
      if (!seq) {
        alert("먼저 저장한 뒤 이미지를 업로드하세요.");
        return;
      }
      TiAdminApi.uploadFile(file, {
        category: "magazine-body",
        magazineSeq: seq,
        imageIndex: imageIndex
      })
        .then(function (res) {
          imageIndex++;
          var img = '<img src="' + res.path + '" alt="">';
          var bodyEl = editor.getBodyEl();
          bodyEl.focus();
          document.execCommand("insertHTML", false, img);
        })
        .catch(function (err) {
          alert(err.message);
        });
    };

    document.getElementById("mzForm").onsubmit = function (e) {
      e.preventDefault();
      var body = {
        title: val("title"),
        movieTitle: val("movieTitle") || null,
        subtitle: val("subtitle") || null,
        publishedLabel: val("publishedLabel") || null,
        excerpt: val("excerpt") || null,
        bodyHtml: editor.getHtml(),
        imgThumb: val("imgThumb") || null,
        imgCover: val("imgCover") || null,
        sourceUrl: val("sourceUrl") || null,
        articleUrl: val("articleUrl") || null,
        listOrder: Number(val("listOrder")) || 0
      };

      var p = isNew
        ? TiAdminApi.createMagazine({
            publicId: val("publicId"),
            section: document.getElementById("section").value,
            title: body.title,
            movieTitle: body.movieTitle,
            subtitle: body.subtitle,
            publishedLabel: body.publishedLabel,
            excerpt: body.excerpt,
            bodyHtml: body.bodyHtml,
            imgThumb: body.imgThumb,
            imgCover: body.imgCover,
            sourceUrl: body.sourceUrl,
            articleUrl: body.articleUrl,
            listOrder: body.listOrder
          })
        : TiAdminApi.updateMagazine(publicId, body);

      p.then(function (saved) {
        alert("저장되었습니다.");
        if (isNew) {
          window.location.href =
            "magazine-edit.html?id=" + encodeURIComponent(saved.publicId);
        } else {
          document.getElementById("magazineSeq").value = saved.seq;
        }
      }).catch(function (err) {
        alert(err.message);
      });
    };
  }

  if (isNew) {
    renderForm(null);
  } else {
    el.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getMagazine(publicId)
      .then(renderForm)
      .catch(function (err) {
        el.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }
})();

(function () {
  if (!window.TiAdminAuth.require()) return;

  var params = new URLSearchParams(window.location.search);
  var publicId = params.get("id");
  var isNew = !publicId;

  TiAdminLayout.mount("special", isNew ? "기획전·행사 추가" : "기획전·행사 수정");
  var el = TiAdminLayout.contentEl();
  var films = [];

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderFilms() {
    var box = document.getElementById("filmList");
    if (!box) return;
    box.innerHTML = films
      .map(function (film, idx) {
        return (
          '<div class="admin-film-list" data-idx="' +
          idx +
          '">' +
          "<h3>작품 #" +
          (idx + 1) +
          ' <button type="button" class="admin-btn admin-btn--danger" data-rm="' +
          idx +
          '">삭제</button></h3>' +
          field("title-" + idx, "제목", film.title) +
          field("image-" + idx, "이미지 경로", film.image) +
          '<div class="field"><label>이미지 업로드</label><input type="file" data-up="' +
          idx +
          '" accept="image/*"></div>' +
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
          "</div>"
        );
      })
      .join("");

    box.querySelectorAll("[data-rm]").forEach(function (btn) {
      btn.onclick = function () {
        films.splice(Number(btn.getAttribute("data-rm")), 1);
        renderFilms();
      };
    });
    box.querySelectorAll("[data-up]").forEach(function (input) {
      input.onchange = function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var idx = Number(input.getAttribute("data-up"));
        var seq = Number(document.getElementById("specialSeq").value);
        if (!seq) {
          alert("먼저 저장한 뒤 이미지를 업로드하세요.");
          return;
        }
        TiAdminApi.uploadFile(file, {
          category: "special-item",
          specialSeq: seq,
          itemSeq: idx + 1
        })
          .then(function (res) {
            films[idx].image = res.path;
            renderFilms();
          })
          .catch(function (err) {
            alert(err.message);
          });
      };
    });
  }

  function field(name, label, val) {
    return (
      '<div class="field"><label>' +
      label +
      '</label><input type="text" id="' +
      name +
      '" value="' +
      esc(val) +
      '"></div>'
    );
  }

  function collectFilms() {
    return films.map(function (_f, idx) {
      var descEl = document.querySelector("[data-desc='" + idx + "']");
      return {
        title: val("title-" + idx),
        image: val("image-" + idx),
        titleEn: val("titleEn-" + idx),
        info: val("info-" + idx),
        director: val("director-" + idx),
        cast: val("cast-" + idx),
        description: descEl ? descEl.value : "",
        sectionName: val("sectionName-" + idx),
        screenings: films[idx].screenings || []
      };
    });
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function renderForm(detail) {
    var kind = detail ? detail.kind : "exhibition";
    films = detail && detail.films ? detail.films.slice() : [];

    el.innerHTML =
      '<form class="admin-form" id="spForm">' +
      '<input type="hidden" id="specialSeq" value="' +
      (detail ? detail.seq : "") +
      '">' +
      (isNew
        ? '<div class="field"><label>public_id</label><input type="text" id="publicId" required placeholder="e000001 / ev000001"></div>'
        : "<p><strong>ID:</strong> " + esc(detail.publicId) + "</p>") +
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
      field("imgMain", "메인 이미지 경로", detail && detail.imgMain) +
      '<div class="field"><label>메인 이미지 업로드</label><input type="file" id="mainUpload" accept="image/*"></div>' +
      field("bookingUrl", "예매 URL", detail && detail.bookingUrl) +
      field("listOrder", "정렬 순서", detail ? detail.listOrder : 0) +
      '<div id="filmsSection"><div id="filmList"></div>' +
      '<button type="button" class="admin-btn" id="addFilm">+ 작품 추가</button></div>' +
      '<div class="admin-form-actions">' +
      '<button type="submit" class="admin-btn admin-btn--primary">저장</button>' +
      '<a class="admin-btn" href="special.html">목록</a>' +
      "</div></form>";

    document.getElementById("kind").value = kind;
    toggleFilmsSection();

    document.getElementById("kind").onchange = toggleFilmsSection;
    document.getElementById("addFilm").onclick = function () {
      films.push({
        title: "",
        image: "",
        titleEn: "",
        info: "",
        director: "",
        cast: "",
        description: "",
        sectionName: "",
        screenings: []
      });
      renderFilms();
    };

    if (kind === "exhibition") renderFilms();

    document.getElementById("mainUpload").onchange = function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var seq = Number(document.getElementById("specialSeq").value);
      if (!seq) {
        alert("먼저 저장한 뒤 이미지를 업로드하세요.");
        return;
      }
      TiAdminApi.uploadFile(file, { category: "special-main", specialSeq: seq })
        .then(function (res) {
          document.getElementById("imgMain").value = res.path;
        })
        .catch(function (err) {
          alert(err.message);
        });
    };

    document.getElementById("spForm").onsubmit = function (e) {
      e.preventDefault();
      var body = {
        title: val("title"),
        dateLabel: val("dateLabel") || null,
        body: document.getElementById("body").value,
        imgMain: val("imgMain") || null,
        bookingUrl: val("bookingUrl") || null,
        listOrder: Number(val("listOrder")) || 0
      };
      if (document.getElementById("kind").value === "exhibition") {
        body.films = collectFilms();
      }

      var p = isNew
        ? TiAdminApi.createSpecial({
            publicId: val("publicId"),
            kind: document.getElementById("kind").value,
            films: body.films,
            title: body.title,
            dateLabel: body.dateLabel,
            body: body.body,
            imgMain: body.imgMain,
            bookingUrl: body.bookingUrl,
            listOrder: body.listOrder
          })
        : TiAdminApi.updateSpecial(publicId, body);

      p.then(function (saved) {
        alert("저장되었습니다.");
        if (isNew) {
          window.location.href =
            "special-edit.html?id=" + encodeURIComponent(saved.publicId);
        } else {
          document.getElementById("specialSeq").value = saved.seq;
          films = saved.films || [];
          renderFilms();
        }
      }).catch(function (err) {
        alert(err.message);
      });
    };
  }

  function toggleFilmsSection() {
    var sec = document.getElementById("filmsSection");
    if (!sec) return;
    sec.style.display =
      document.getElementById("kind").value === "exhibition" ? "block" : "none";
  }

  if (isNew) {
    renderForm(null);
  } else {
    el.innerHTML = "<p>불러오는 중…</p>";
    TiAdminApi.getSpecial(publicId)
      .then(renderForm)
      .catch(function (err) {
        el.innerHTML =
          '<div class="admin-msg admin-msg--error">' + esc(err.message) + "</div>";
      });
  }
})();

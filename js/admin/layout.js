(function (global) {
  var NAV = [
    { href: "index.html", label: "대시보드", key: "dashboard" },
    { href: "programs.html", label: "상영작 관리", key: "programs" },
    { href: "special.html", label: "기획전·행사 관리", key: "special" },
    { href: "magazine.html", label: "매거진 관리", key: "magazine" }
  ];

  function renderSidebar(currentKey) {
    var nav = NAV.map(function (item) {
      var cls = item.key === currentKey ? ' class="is-current"' : "";
      return '<a href="' + item.href + '"' + cls + ">" + item.label + "</a>";
    }).join("");
    return (
      '<aside class="admin-sidebar">' +
      '<div class="admin-sidebar__brand">55CINE 관리자</div>' +
      "<nav>" +
      nav +
      "</nav>" +
      '<p class="admin-stub-note" style="padding:0.75rem 1.25rem">추후수정 및 로그인 연동</p>' +
      "</aside>"
    );
  }

  function mountLayout(currentKey, title) {
    var root = document.getElementById("adminRoot");
    if (!root) return;
    root.innerHTML =
      renderSidebar(currentKey) +
      '<main class="admin-main">' +
      (title ? '<h1 class="admin-page-title">' + title + "</h1>" : "") +
      '<div id="adminContent"></div>' +
      "</main>";
  }

  global.TiAdminLayout = {
    mount: mountLayout,
    contentEl: function () {
      return document.getElementById("adminContent");
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

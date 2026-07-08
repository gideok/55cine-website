(function (global) {
  var NAV = [
    { href: "dashboard.html", label: "대시보드", key: "dashboard" },
    { href: "programs.html", label: "상영작 관리", key: "programs" },
    { href: "special.html", label: "기획전·행사 관리", key: "special" },
    { href: "magazine.html", label: "매거진 관리", key: "magazine" },
    { href: "notice.html", label: "공지사항 관리", key: "notice" },
    { href: "screening-schedule.html", label: "상영시간표", key: "screening-schedule" },
    { href: "work-schedule.html", label: "근무스케줄", key: "work-schedule" },
    { href: "settings.html", label: "사이트 설정", key: "settings" }
  ];

  var MOBILE_MQ = "(max-width: 820px)";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isMobileViewport() {
    return global.matchMedia(MOBILE_MQ).matches;
  }

  function renderMobileHeaderHtml() {
    return (
      '<header class="admin-mobile-bar" id="adminMobileBar">' +
      '<button type="button" class="admin-mobile-bar__menu" id="adminMenuToggle" aria-expanded="false" aria-controls="adminSidebar" aria-label="메뉴 열기">' +
      '<span class="admin-mobile-bar__menu-icon" aria-hidden="true"><span></span><span></span><span></span></span>' +
      "</button>" +
      '<div class="admin-mobile-bar__brand">55CINE 관리자</div>' +
      "</header>"
    );
  }

  function renderSidebarHtml(currentKey) {
    var nav = NAV.map(function (item) {
      var cls = item.key === currentKey ? ' class="is-current"' : "";
      return '<a href="' + item.href + '"' + cls + ">" + esc(item.label) + "</a>";
    }).join("");
    return (
      '<aside class="admin-sidebar" id="adminSidebar" aria-label="관리자 메뉴">' +
      '<div class="admin-sidebar__brand">55CINE 관리자</div>' +
      '<nav class="admin-sidebar__nav">' +
      nav +
      '<button type="button" class="admin-sidebar__logout" id="adminLogoutBtn">로그아웃</button>' +
      "</nav>" +
      "</aside>"
    );
  }

  function ensureMobileChrome(root) {
    document.body.classList.add("admin-body--shell");

    if (!document.getElementById("adminMobileBar")) {
      var wrap = document.createElement("div");
      wrap.innerHTML =
        renderMobileHeaderHtml() +
        '<div class="admin-sidebar-backdrop" id="adminSidebarBackdrop" hidden></div>';
      root.parentNode.insertBefore(wrap.lastElementChild, root);
      root.parentNode.insertBefore(wrap.firstElementChild, root);
    }
  }

  function setNavOpen(open) {
    var toggle = document.getElementById("adminMenuToggle");
    var backdrop = document.getElementById("adminSidebarBackdrop");
    document.body.classList.toggle("admin-nav-open", open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    }
    if (backdrop) backdrop.hidden = !open;
  }

  function closeNav() {
    setNavOpen(false);
  }

  function syncSidebarPlacement() {
    var root = document.getElementById("adminRoot");
    var sidebar = document.getElementById("adminSidebar");
    if (!root || !sidebar) return;

    if (isMobileViewport()) {
      if (sidebar.parentNode !== document.body) {
        document.body.insertBefore(sidebar, root);
      }
      return;
    }

    closeNav();
    if (sidebar.parentNode !== root) {
      root.insertBefore(sidebar, root.firstChild);
    }
  }

  function initMobileNavOnce() {
    if (document.documentElement.dataset.adminNavBound === "1") return;
    document.documentElement.dataset.adminNavBound = "1";

    document.addEventListener("click", function (e) {
      if (e.target.closest("#adminMenuToggle")) {
        if (!isMobileViewport()) return;
        setNavOpen(!document.body.classList.contains("admin-nav-open"));
        return;
      }
      if (e.target.closest("#adminSidebarBackdrop")) {
        closeNav();
        return;
      }
      if (e.target.closest(".admin-sidebar__nav a")) {
        closeNav();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });

    var mq = global.matchMedia(MOBILE_MQ);
    function onViewportChange() {
      syncSidebarPlacement();
      if (!mq.matches) closeNav();
    }
    if (mq.addEventListener) mq.addEventListener("change", onViewportChange);
    else if (mq.addListener) mq.addListener(onViewportChange);
  }

  function bindLogout() {
    var logoutBtn = document.getElementById("adminLogoutBtn");
    if (!logoutBtn || logoutBtn.dataset.bound === "1") return;
    if (!global.TiAdminAuth || typeof global.TiAdminAuth.logout !== "function") {
      return;
    }
    logoutBtn.dataset.bound = "1";
    logoutBtn.addEventListener("click", function () {
      logoutBtn.disabled = true;
      global.TiAdminAuth.logout().finally(function () {
        global.location.href = global.TiAdminAuth.loginUrl();
      });
    });
  }

  function mountLayout(currentKey, title) {
    var root = document.getElementById("adminRoot");
    if (!root) return;

    ensureMobileChrome(root);
    initMobileNavOnce();

    root.innerHTML =
      renderSidebarHtml(currentKey) +
      '<main class="admin-main">' +
      (title ? '<h1 class="admin-page-title">' + esc(title) + "</h1>" : "") +
      '<div id="adminContent"></div>' +
      "</main>";

    syncSidebarPlacement();
    bindLogout();
  }

  global.TiAdminLayout = {
    mount: mountLayout,
    contentEl: function () {
      return document.getElementById("adminContent");
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

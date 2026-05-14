(function () {
  var bound = false;

  function requestRelayout() {
    window.dispatchEvent(new CustomEvent("ti-shell:relayout"));
  }

  function bindMobileMenu() {
    if (bound) return;
    var shell = document.getElementById("tiShell");
    var btn = document.getElementById("tiHamburger");
    if (!shell || !btn) return;

    bound = true;
    var mq = window.matchMedia("(max-width: 820px)");

    function clearCollapsedOnDesktop() {
      if (!mq.matches) {
        shell.classList.remove("ti-menu-collapsed-mobile");
        btn.setAttribute("aria-expanded", "true");
        btn.setAttribute("aria-label", "메뉴·시간표 접기");
      }
    }

    function applyMobileDefaultCollapsed() {
      if (!mq.matches) return;
      shell.classList.add("ti-menu-collapsed-mobile");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "메뉴·시간표 펼치기");
      window.requestAnimationFrame(requestRelayout);
      window.setTimeout(requestRelayout, 480);
    }

    function onViewportModeChange() {
      if (mq.matches) {
        applyMobileDefaultCollapsed();
      } else {
        clearCollapsedOnDesktop();
      }
    }

    btn.addEventListener("click", function () {
      if (!mq.matches) return;
      var nowCollapsed = shell.classList.toggle("ti-menu-collapsed-mobile");
      btn.setAttribute("aria-expanded", nowCollapsed ? "false" : "true");
      btn.setAttribute(
        "aria-label",
        nowCollapsed ? "메뉴·시간표 펼치기" : "메뉴·시간표 접기"
      );
      window.requestAnimationFrame(requestRelayout);
      window.setTimeout(requestRelayout, 480);
    });

    window.addEventListener(
      "resize",
      function () {
        if (!mq.matches) clearCollapsedOnDesktop();
      },
      { passive: true }
    );

    if (mq.addEventListener) {
      mq.addEventListener("change", onViewportModeChange);
    } else if (mq.addListener) {
      mq.addListener(onViewportModeChange);
    }

    onViewportModeChange();
  }

  window.addEventListener("ti-left-gnb:loaded", bindMobileMenu);

  function tryBindSoon() {
    bindMobileMenu();
    if (bound) return;
    queueMicrotask(bindMobileMenu);
    window.requestAnimationFrame(function () {
      bindMobileMenu();
      window.requestAnimationFrame(bindMobileMenu);
    });
  }

  tryBindSoon();
  window.addEventListener("load", tryBindSoon, { once: true });

  window.addEventListener("pageshow", function (ev) {
    if (!ev.persisted) return;
    var shell = document.getElementById("tiShell");
    var btn = document.getElementById("tiHamburger");
    if (!shell || !btn) return;
    var mq = window.matchMedia("(max-width: 820px)");
    if (!mq.matches) return;
    shell.classList.add("ti-menu-collapsed-mobile");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "메뉴·시간표 펼치기");
    window.dispatchEvent(new CustomEvent("ti-shell:relayout"));
  });
})();

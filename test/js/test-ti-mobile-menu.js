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

    btn.setAttribute("aria-label", "메뉴·시간표 접기");

    window.addEventListener(
      "resize",
      function () {
        clearCollapsedOnDesktop();
      },
      { passive: true }
    );

    if (mq.addEventListener) {
      mq.addEventListener("change", clearCollapsedOnDesktop);
    } else if (mq.addListener) {
      mq.addListener(clearCollapsedOnDesktop);
    }
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
})();

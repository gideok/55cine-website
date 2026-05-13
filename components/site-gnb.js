/**
 * 공통 GNB: 모바일 패널 토글, 드롭다운 열기/닫기 (헤더는 site-chrome 주입 이후에 동작)
 */
(function () {
  function initSiteGnb() {
    var gnbToggle = document.getElementById("gnbToggle");
    var gnbPanel = document.getElementById("gnb-panel");
    if (gnbToggle && gnbPanel) {
      gnbToggle.addEventListener("click", function () {
        var open = gnbPanel.classList.toggle("is-open");
        gnbToggle.setAttribute("aria-expanded", open ? "true" : "false");
        gnbToggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
        if (!open) {
          gnbPanel.querySelectorAll(".gnb-item.is-open").forEach(function (li) {
            li.classList.remove("is-open");
          });
        }
      });
      gnbPanel.querySelectorAll(".gnb-depth2 a").forEach(function (a) {
        a.addEventListener("click", function () {
          if (window.matchMedia("(max-width: 900px)").matches) {
            gnbPanel.classList.remove("is-open");
            gnbToggle.setAttribute("aria-expanded", "false");
            gnbToggle.setAttribute("aria-label", "메뉴 열기");
            gnbPanel.querySelectorAll(".gnb-item.is-open").forEach(function (li) {
              li.classList.remove("is-open");
            });
          }
        });
      });
    }

    document.querySelectorAll(".gnb-item > .gnb-depth1").forEach(function (depth1) {
      depth1.addEventListener("click", function (e) {
        if (!window.matchMedia("(max-width: 900px)").matches) return;
        var panel = document.getElementById("gnb-panel");
        if (!panel || !panel.classList.contains("is-open")) return;
        var item = depth1.closest(".gnb-item");
        if (!item || !item.querySelector(".gnb-dropdown")) return;
        e.preventDefault();
        var wasOpen = item.classList.contains("is-open");
        document.querySelectorAll(".gnb-item.is-open").forEach(function (li) {
          li.classList.remove("is-open");
        });
        if (!wasOpen) item.classList.add("is-open");
      });
    });
  }

  var needsChrome = document.getElementById("site-header-mount") || document.getElementById("site-footer-mount");
  if (needsChrome) {
    document.addEventListener("sitechrome:ready", initSiteGnb, { once: true });
    document.addEventListener("sitechrome:error", initSiteGnb, { once: true });
  } else {
    initSiteGnb();
  }
})();

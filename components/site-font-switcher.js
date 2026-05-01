/**
 * 폰트 테스트: #siteFontSelect 변경 시 전역 폰트 적용 + localStorage
 * change 는 document 에 위임해 헤더 주입 시점과 무관하게 동작합니다.
 */
(function () {
  var STORAGE_KEY = "55cine-site-font";
  var stacks = {
    noto: '"Noto Sans KR", system-ui, sans-serif',
    asta: '"Asta Sans", system-ui, sans-serif',
    dohyeon: '"Do Hyeon", system-ui, sans-serif',
    pretendard: "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    spoqa: '"Spoqa Han Sans", system-ui, sans-serif'
  };

  function applyFont(key) {
    var stack = stacks[key] || stacks.noto;
    document.documentElement.style.setProperty("--site-font-family", stack);
    if (document.body) {
      document.body.style.setProperty("font-family", stack);
    }
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch (e) {}
  }

  function syncSelect() {
    var sel = document.getElementById("siteFontSelect");
    if (!sel) return;
    var saved = "noto";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "noto";
    } catch (e2) {}
    if (!stacks[saved]) saved = "noto";
    sel.value = saved;
    applyFont(saved);
  }

  try {
    var initial = localStorage.getItem(STORAGE_KEY);
    if (initial && stacks[initial]) {
      applyFont(initial);
    }
  } catch (e0) {}

  document.addEventListener(
    "change",
    function (ev) {
      var t = ev.target;
      if (!t || t.id !== "siteFontSelect") return;
      applyFont(t.value);
    },
    false
  );

  document.addEventListener("sitechrome:ready", syncSelect);
  document.addEventListener("DOMContentLoaded", function () {
    syncSelect();
  });
  window.addEventListener("load", function () {
    syncSelect();
  });
})();

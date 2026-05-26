/**
 * partials/ti-site-footer.html 을 불러와 [data-ti-site-footer] 요소(복수: PC 슬롯·모바일 슬롯)에 동일 내용을 삽입합니다.
 * 이미지 경로는 __TI_ASSET_BASE__ 플레이스홀더로 치환되며,
 * 우선순위: data-ti-asset-base 속성 > window.TI_ASSET_BASE > "../"
 */
(function () {
  var mounts = document.querySelectorAll("[data-ti-site-footer]");
  if (!mounts.length) return;

  function normBase(b) {
    if (!b || typeof b !== "string") return "../";
    var s = b.trim();
    if (!s) return "../";
    return s.charAt(s.length - 1) === "/" ? s : s + "/";
  }

  function resolvePartialUrl() {
    var cs = document.currentScript;
    if (!cs || !cs.src) return null;
    try {
      return new URL("../partials/ti-site-footer.html", cs.src).href;
    } catch (e) {
      return null;
    }
  }

  var partialUrl = resolvePartialUrl();
  if (!partialUrl) return;

  fetch(partialUrl)
    .then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      return res.text();
    })
    .then(function (template) {
      for (var i = 0; i < mounts.length; i++) {
        var el = mounts[i];
        var attr = el.getAttribute("data-ti-asset-base");
        var raw =
          attr != null && attr !== ""
            ? attr
            : typeof window.TI_ASSET_BASE === "string"
              ? window.TI_ASSET_BASE
              : "../";
        var base = normBase(raw);
        el.innerHTML = template.replace(/__TI_ASSET_BASE__/g, base);
      }
    })
    .catch(function () {
      /* fetch 실패 시 빈 영역 유지 (file:// 등) */
    });
})();

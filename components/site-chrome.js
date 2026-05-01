/**
 * 공통 헤더·푸터 주입 (components/header.html, components/footer.html)
 * 로컬에서 file:// 로 열면 fetch가 막힐 수 있으므로 간단한 HTTP 서버로 열어 주세요.
 */
(function () {
  var scripts = document.getElementsByTagName("script");
  var i;
  var baseUrl = "";
  for (i = scripts.length - 1; i >= 0; i--) {
    if (scripts[i].src && scripts[i].src.indexOf("site-chrome.js") !== -1) {
      baseUrl = new URL(".", scripts[i].src).href;
      break;
    }
  }

  function load(name) {
    return fetch(new URL(name, baseUrl)).then(function (r) {
      if (!r.ok) throw new Error(name + ": " + r.status);
      return r.text();
    });
  }

  var hm = document.getElementById("site-header-mount");
  var fm = document.getElementById("site-footer-mount");
  if (!hm && !fm) {
    document.dispatchEvent(new CustomEvent("sitechrome:ready"));
    return;
  }

  Promise.all([hm ? load("header.html") : Promise.resolve(null), fm ? load("footer.html") : Promise.resolve(null)])
    .then(function (parts) {
      if (hm && parts[0]) hm.outerHTML = parts[0];
      if (fm && parts[1]) fm.outerHTML = parts[1];
      document.dispatchEvent(new CustomEvent("sitechrome:ready"));
    })
    .catch(function (err) {
      console.error("[site-chrome]", err);
      document.dispatchEvent(new CustomEvent("sitechrome:error", { detail: err }));
    });
})();

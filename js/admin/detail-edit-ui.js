/**
 * 공개 상세 페이지 — 관리자 수정 버튼
 */
(function (global) {
  function safeReturnUrl(url) {
    if (!url) return null;
    try {
      var parsed = new URL(url, global.location.href);
      if (parsed.origin !== global.location.origin) return null;
      return parsed.pathname + parsed.search + parsed.hash;
    } catch (_e) {
      if (String(url).charAt(0) === "/" && String(url).indexOf("//") !== 0) {
        return String(url);
      }
      return null;
    }
  }

  function currentPageUrl() {
    return global.location.pathname + global.location.search + global.location.hash;
  }

  function resolveAdminPath(path) {
    if (global.TiSiteRoot && typeof global.TiSiteRoot.resolve === "function") {
      return global.TiSiteRoot.resolve(path);
    }
    return path;
  }

  function buildEditHref(adminEditPath, seq) {
    var href =
      resolveAdminPath(adminEditPath) +
      "?seq=" +
      encodeURIComponent(String(seq)) +
      "&returnUrl=" +
      encodeURIComponent(currentPageUrl());
    return href;
  }

  function mountEditButton(headEl, editHref) {
    if (!headEl || !editHref) return;
    var auth = global.TiAdminAuth;
    if (!auth || typeof auth.whenReady !== "function") return;

    auth
      .whenReady()
      .catch(function () {
        return false;
      })
      .then(function (loggedIn) {
        if (!loggedIn) return;
        if (headEl.querySelector(".ti-admin-detail-edit")) return;

        var link = document.createElement("a");
        link.className = "ti-admin-detail-edit";
        link.href = editHref;
        link.textContent = "수정";
        headEl.appendChild(link);
      });
  }

  function redirectAfterSave() {
    var params = new URLSearchParams(global.location.search);
    var safe = safeReturnUrl(params.get("returnUrl"));
    if (!safe) return false;
    var sep = safe.indexOf("?") >= 0 ? "&" : "?";
    global.location.href = safe + sep + "_ts=" + Date.now();
    return true;
  }

  global.TiAdminDetailEdit = {
    mount: mountEditButton,
    buildHref: buildEditHref,
    safeReturnUrl: safeReturnUrl,
    redirectAfterSave: redirectAfterSave
  };
})(typeof window !== "undefined" ? window : globalThis);

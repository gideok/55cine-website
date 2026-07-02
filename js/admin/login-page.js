(function () {
  var form = document.getElementById("adminLoginForm");
  var errorEl = document.getElementById("adminLoginError");
  var submitBtn = document.getElementById("adminLoginSubmit");

  function showError(message) {
    if (!errorEl) return;
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function safeReturnUrl(url) {
    if (!url) return null;
    try {
      var parsed = new URL(url, window.location.href);
      if (parsed.origin !== window.location.origin) return null;
      return parsed.pathname + parsed.search + parsed.hash;
    } catch (_e) {
      if (String(url).charAt(0) === "/" && String(url).indexOf("//") !== 0) {
        return String(url);
      }
      return null;
    }
  }

  function redirectAfterLogin() {
    var params = new URLSearchParams(window.location.search);
    var safe = safeReturnUrl(params.get("next"));
    if (safe) {
      window.location.href = safe;
      return;
    }
    window.location.href = "dashboard.html";
  }

  function showMessageFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var msg = params.get("msg");
    if (msg) showError(msg);
  }

  showMessageFromQuery();

  TiAdminAuth.whenReady().then(function (loggedIn) {
    if (loggedIn) redirectAfterLogin();
  });

  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    showError("");
    if (submitBtn) submitBtn.disabled = true;

    var username = String(document.getElementById("adminLoginId").value || "").trim();
    var password = String(document.getElementById("adminLoginPassword").value || "").trim();

    TiAdminAuth.login(username, password)
      .then(function () {
        redirectAfterLogin();
      })
      .catch(function (err) {
        showError((err && err.message) || "로그인에 실패했습니다.");
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });
})();

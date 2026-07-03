/**
 * 관리자 세션 — API 쿠키 + localStorage 토큰(로컬 교차 포트 개발용)
 * 로그아웃 전까지 유지(브라우저·PC 재시작 후에도 localStorage·쿠키로 복원)
 * 일반 페이지: 세션 확인만(수정 버튼용), 리다이렉트·메시지 없음
 * /admin 페이지: 로그인 필수 (login.html 제외)
 */
(function (global) {
  var TOKEN_KEY = "ti_admin_session_token";
  var AUTH_MESSAGE = "관리자 인증이 필요합니다.";
  var loggedIn = false;
  var refreshSessionPromise = null;

  function apiBase() {
    var base =
      (global.TiResolveApiBase && global.TiResolveApiBase()) ||
      global.TI_API_BASE ||
      "/api/v1";
    if (global.TiNormalizeApiBase) {
      base = global.TiNormalizeApiBase(base);
    }
    return String(base).replace(/\/$/, "");
  }

  function readToken() {
    try {
      return global.localStorage.getItem(TOKEN_KEY);
    } catch (_e) {
      return null;
    }
  }

  function storeToken(token) {
    try {
      if (token) global.localStorage.setItem(TOKEN_KEY, String(token));
      else global.localStorage.removeItem(TOKEN_KEY);
    } catch (_e) {
      /* ignore */
    }
  }

  function sessionHeaders() {
    var headers = { Accept: "application/json" };
    var token = readToken();
    if (token) headers["X-Admin-Session"] = token;
    return headers;
  }

  function setLoggedIn(value) {
    loggedIn = !!value;
  }

  function refreshSession() {
    if (refreshSessionPromise) return refreshSessionPromise;

    refreshSessionPromise = fetch(apiBase() + "/admin/session", {
      method: "GET",
      credentials: "include",
      headers: sessionHeaders()
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        var ok = !!(data && data.authenticated);
        setLoggedIn(ok);
        if (!ok) storeToken(null);
        return ok;
      })
      .catch(function () {
        setLoggedIn(false);
        return false;
      })
      .finally(function () {
        refreshSessionPromise = null;
      });

    return refreshSessionPromise;
  }

  function isAdminPath() {
    var path = global.location && global.location.pathname ? global.location.pathname : "";
    return /\/admin(\/|$)/.test(path);
  }

  function isLoginPage() {
    var path = global.location && global.location.pathname ? global.location.pathname : "";
    return /\/admin\/login(?:\.html)?$/i.test(path);
  }

  function homeUrl() {
    if (global.TiSiteRoot && typeof global.TiSiteRoot.resolve === "function") {
      return global.TiSiteRoot.resolve("index.html");
    }
    if (isAdminPath()) return "../index.html";
    return "/index.html";
  }

  function loginUrl() {
    if (global.TiSiteRoot && typeof global.TiSiteRoot.resolve === "function") {
      return global.TiSiteRoot.resolve("admin/login.html");
    }
    if (isAdminPath()) return "login.html";
    return "/admin/login.html";
  }

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

  function redirectToLogin(nextUrl, message) {
    if (!isAdminPath()) return;
    var next = safeReturnUrl(nextUrl);
    if (!next && global.location) {
      next = global.location.pathname + global.location.search + global.location.hash;
    }
    var href = loginUrl();
    var params = new URLSearchParams();
    if (next) params.set("next", next);
    params.set("msg", message || AUTH_MESSAGE);
    var qs = params.toString();
    global.location.href = qs ? href + "?" + qs : href;
  }

  function redirectUnauthenticated() {
    if (!isAdminPath() || isLoginPage()) return;
    redirectToLogin(null, AUTH_MESSAGE);
  }

  function isLoggedIn() {
    return loggedIn;
  }

  function whenReady() {
    return refreshSession();
  }

  function requireAdmin() {
    if (!isAdminPath() || isLoginPage()) return true;
    if (!loggedIn) {
      redirectUnauthenticated();
      return false;
    }
    return true;
  }

  function guard(fn) {
    if (!isAdminPath() || isLoginPage()) {
      if (typeof fn === "function") fn();
      return Promise.resolve(true);
    }
    return whenReady().then(function (ok) {
      if (!ok) {
        redirectUnauthenticated();
        return false;
      }
      if (typeof fn === "function") fn();
      return true;
    });
  }

  function login(username, password) {
    return fetch(apiBase() + "/admin/login", {
      method: "POST",
      credentials: "include",
      headers: Object.assign({ "Content-Type": "application/json" }, sessionHeaders()),
      body: JSON.stringify({ username: username, password: password })
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!res.ok) {
            var msg =
              (data && data.error && data.error.message) ||
              "로그인에 실패했습니다.";
            throw new Error(msg);
          }
          if (data && data.token) storeToken(data.token);
          return refreshSession();
        });
      });
  }

  function logout() {
    return fetch(apiBase() + "/admin/logout", {
      method: "POST",
      credentials: "include",
      headers: sessionHeaders()
    })
      .catch(function () {
        return null;
      })
      .finally(function () {
        storeToken(null);
        setLoggedIn(false);
      });
  }

  function showAuthMessageFromQuery() {
    if (!isAdminPath() || !global.location || !global.document || !global.document.body) return;
    var params = new URLSearchParams(global.location.search);
    var msg = params.get("msg");
    if (!msg) return;

    var bar = document.createElement("div");
    bar.className = "ti-admin-auth-notice";
    bar.setAttribute("role", "alert");
    bar.textContent = msg;
    document.body.appendChild(bar);

    try {
      var url = new URL(global.location.href);
      url.searchParams.delete("msg");
      global.history.replaceState({}, "", url.pathname + url.search + url.hash);
    } catch (_e) {
      /* ignore */
    }

    global.setTimeout(function () {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }, 6000);
  }

  function boot() {
    refreshSession().finally(function () {
      if (isAdminPath()) {
        showAuthMessageFromQuery();
      }
    });
  }

  boot();

  global.TiAdminAuth = {
    isLoggedIn: isLoggedIn,
    whenReady: whenReady,
    require: requireAdmin,
    guard: guard,
    login: login,
    logout: logout,
    homeUrl: homeUrl,
    loginUrl: loginUrl,
    redirectToLogin: redirectToLogin,
    redirectUnauthenticated: redirectUnauthenticated,
    sessionHeaders: sessionHeaders,
    readToken: readToken,
    refreshSession: refreshSession,
    isAdminPath: isAdminPath,
    isLoginPage: isLoginPage,
    AUTH_MESSAGE: AUTH_MESSAGE,
    TOKEN_KEY: TOKEN_KEY
  };
})(typeof window !== "undefined" ? window : globalThis);

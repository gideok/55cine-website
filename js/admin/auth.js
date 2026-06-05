/**
 * 관리자 인증 스텁 — 추후수정 및 로그인 연동
 * 로그인 페이지 연동 전까지 TI_ADMIN_LOGGED_IN 을 true 로 두고 localStorage 에도 반영합니다.
 */
(function (global) {
  var STORAGE_KEY = "ti_admin_logged_in";

  // 추후수정 및 로그인 연동 — 현재는 항상 로그인된 것으로 처리
  global.TI_ADMIN_LOGGED_IN = true;

  try {
    if (global.TI_ADMIN_LOGGED_IN) {
      global.localStorage.setItem(STORAGE_KEY, "true");
    }
  } catch (_e) {
    /* localStorage 미지원 환경 무시 */
  }

  function isAdminLoggedIn() {
    // 추후수정 및 로그인 연동
    if (global.TI_ADMIN_LOGGED_IN === true) return true;
    try {
      return global.localStorage.getItem(STORAGE_KEY) === "true";
    } catch (_e) {
      return false;
    }
  }

  function requireAdmin() {
    if (!isAdminLoggedIn()) {
      global.location.href = "login.html"; // 추후수정 및 로그인 연동
      return false;
    }
    return true;
  }

  global.TiAdminAuth = {
    isLoggedIn: isAdminLoggedIn,
    require: requireAdmin,
    STORAGE_KEY: STORAGE_KEY
  };
})(typeof window !== "undefined" ? window : globalThis);

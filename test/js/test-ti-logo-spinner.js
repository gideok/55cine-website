/**
 * 55CINE 로고 스피너 — images/logo-spinner-bg.png(고정) + ring(회전)
 * 배경은 logo.png 사본이며, 스피너 전용으로 별도 수정 가능
 */
(function (global) {
  "use strict";

  function assetBase() {
    return typeof global.TEST_TI_ASSET_BASE === "string" ? global.TEST_TI_ASSET_BASE : "";
  }

  function logoSrc() {
    return assetBase() + "images/logo-spinner-bg.png";
  }

  /**
   * @param {{ size?: number, label?: string, className?: string }} [options]
   * @returns {HTMLElement}
   */
  function create(options) {
    options = options || {};
    var width = options.size || 72;

    var wrap = document.createElement("span");
    wrap.className = "ti-logo-spinner" + (options.className ? " " + options.className : "");
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", options.label || "로딩 중");
    wrap.style.width = width + "px";

    var logo = document.createElement("img");
    logo.className = "ti-logo-spinner__logo";
    logo.src = logoSrc();
    logo.alt = "";
    logo.decoding = "async";
    logo.draggable = false;

    var ring = document.createElement("span");
    ring.className = "ti-logo-spinner__ring";
    ring.setAttribute("aria-hidden", "true");

    wrap.appendChild(logo);
    wrap.appendChild(ring);
    return wrap;
  }

  /**
   * @param {{ size?: number, label?: string, message?: string }} [options]
   * @returns {HTMLElement}
   */
  function createWithMessage(options) {
    options = options || {};
    var outer = document.createElement("div");
    outer.className = "ti-logo-spinner-wrap";
    outer.appendChild(create({ size: options.size, label: options.label }));
    if (options.message) {
      var text = document.createElement("p");
      text.className = "ti-logo-spinner-message";
      text.textContent = options.message;
      outer.appendChild(text);
    }
    return outer;
  }

  global.TiLogoSpinner = {
    create: create,
    createWithMessage: createWithMessage
  };
})(window);

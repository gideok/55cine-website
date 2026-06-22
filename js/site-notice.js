/**
 * 활성 공지 — index.html 우측 패널(PC) / 전체 화면 중앙(모바일)
 */
(function (global) {
  var DISMISS_KEY_PREFIX = "ti-site-notice-dismiss-";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveAssetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    var rel = String(path).replace(/^\//, "");
    if (global.TiSiteRoot && typeof global.TiSiteRoot.relativePrefix === "function") {
      return global.TiSiteRoot.relativePrefix() + rel;
    }
    if (global.TiSiteRoot && typeof global.TiSiteRoot.resolve === "function") {
      return global.TiSiteRoot.resolve(rel);
    }
    return rel;
  }

  function apiBase() {
    if (global.TiResolveApiBase) return global.TiResolveApiBase();
    if (global.TI_API_BASE) return global.TI_API_BASE;
    return "/api/v1";
  }

  function isIndexPage() {
    var meta = document.querySelector('meta[name="ti-nav-current"]');
    return meta && meta.getAttribute("content") === "index.html";
  }

  function isDismissed(seq) {
    try {
      return sessionStorage.getItem(DISMISS_KEY_PREFIX + seq) === "1";
    } catch (e) {
      return false;
    }
  }

  function markDismissed(seq) {
    try {
      sessionStorage.setItem(DISMISS_KEY_PREFIX + seq, "1");
    } catch (e) {
      /* ignore */
    }
  }

  function setAsideActive(aside, active) {
    if (!aside) return;
    if (active) aside.classList.add("has-site-notice");
    else aside.classList.remove("has-site-notice");
  }

  function clearNotice(mount, aside) {
    if (!mount) return;
    mount.hidden = true;
    mount.innerHTML = "";
    setAsideActive(aside, false);
  }

  function renderNotice(notice, mount, aside) {
    if (!notice || !mount) return;
    var layout = notice.layout || {};
    var contentPct = layout.contentPct != null ? layout.contentPct : notice.contentWidth * 0.9;
    var marginPct = layout.marginPct != null ? layout.marginPct : 5 * (notice.contentWidth / 100);

    var html =
      '<article class="site-notice" style="--notice-content-pct:' +
      contentPct +
      "%;--notice-margin-pct:" +
      marginPct +
      '%;" aria-label="공지사항">' +
      '<div class="site-notice__head">' +
      '<button type="button" class="site-notice__close" aria-label="공지 닫기">' +
      '<span class="site-notice__close-icon" aria-hidden="true">×</span></button>' +
      "</div>" +
      '<div class="site-notice__content">';

    if (notice.formatType === "image-text" && notice.imgMain) {
      html +=
        '<img class="site-notice__img" src="' +
        esc(resolveAssetUrl(notice.imgMain)) +
        '" alt="" decoding="async" />';
    }
    if (notice.bodyHtml) {
      html += '<div class="site-notice__body">' + notice.bodyHtml + "</div>";
    }
    html += "</div></article>";

    mount.innerHTML = html;
    mount.hidden = false;
    setAsideActive(aside, true);

    var closeBtn = mount.querySelector(".site-notice__close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        markDismissed(notice.seq);
        clearNotice(mount, aside);
      });
    }
  }

  function mountNotice() {
    if (!isIndexPage()) return;

    var aside = document.querySelector("aside.right");
    if (!aside) return;

    var mount = aside.querySelector("[data-ti-site-notice]");
    if (!mount) {
      mount = document.createElement("div");
      mount.setAttribute("data-ti-site-notice", "");
      mount.className = "site-notice-mount";
      mount.hidden = true;
      aside.appendChild(mount);
    }

    var url = apiBase().replace(/\/$/, "") + "/notice/active";
    fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.seq) {
          clearNotice(mount, aside);
          return;
        }
        if (isDismissed(data.seq)) {
          clearNotice(mount, aside);
          return;
        }
        renderNotice(data, mount, aside);
      })
      .catch(function () {
        clearNotice(mount, aside);
      });
  }

  function ensureAssets(prefix) {
    if (!document.querySelector('link[data-ti-site-notice-css]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = prefix + "css/components/site-notice.css";
      link.setAttribute("data-ti-site-notice-css", "");
      document.head.appendChild(link);
    }
  }

  function init() {
    if (!isIndexPage()) return;

    var prefix = "";
    if (global.TiSiteRoot && typeof global.TiSiteRoot.relativePrefix === "function") {
      prefix = global.TiSiteRoot.relativePrefix();
    }
    ensureAssets(prefix);
    mountNotice();
  }

  global.TiSiteNotice = { init: init };

  if (isIndexPage()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

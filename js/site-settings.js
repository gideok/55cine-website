/**
 * 사이트 설정 — 멤버십·좌석후원·대관 링크 적용
 */
(function (global) {
  function resolveAssetUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    var rel = String(path).replace(/^\//, "");
    if (global.TiSiteRoot && typeof global.TiSiteRoot.resolve === "function") {
      return global.TiSiteRoot.resolve(rel);
    }
    return rel;
  }

  function applyLink(el, url, label, opts) {
    if (!el) return;
    opts = opts || {};
    if (!url) {
      el.removeAttribute("href");
      if (opts.hideWhenEmpty) {
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
      }
      return;
    }
    el.href = url;
    el.hidden = false;
    el.removeAttribute("aria-hidden");
    if (label) el.textContent = label;
    if (opts.external !== false && /^https?:\/\//i.test(url)) {
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
  }

  function apply(settings) {
    if (!settings) return;

    applyLink(
      document.querySelector("[data-ti-site-cms-link]"),
      settings.membershipCmsUrl,
      settings.membershipCmsLabel,
      { external: true }
    );

    var docLink = document.querySelector("[data-ti-site-donation-doc]");
    if (docLink) {
      if (settings.donationDocPath) {
        docLink.href = resolveAssetUrl(settings.donationDocPath);
        docLink.target = "_blank";
        docLink.rel = "noopener noreferrer";
        docLink.hidden = false;
        docLink.removeAttribute("aria-hidden");
        if (settings.donationDocLabel) docLink.textContent = settings.donationDocLabel;
      } else {
        docLink.hidden = true;
        docLink.setAttribute("aria-hidden", "true");
      }
    }

    applyLink(
      document.querySelector("[data-ti-site-seat-link]"),
      settings.seatSponsorUrl,
      settings.seatSponsorLabel,
      { hideWhenEmpty: true, external: true }
    );

    applyLink(
      document.querySelector("[data-ti-site-rental-link]"),
      settings.rentalFormUrl,
      settings.rentalFormLabel,
      { hideWhenEmpty: true, external: true }
    );
  }

  function load() {
    if (!global.TiApi || typeof global.TiApi.getSiteSettings !== "function") return Promise.resolve();
    return global.TiApi.getSiteSettings().then(apply).catch(function () {});
  }

  global.TiSiteSettings = {
    apply: apply,
    load: load
  };

  if (document.querySelector("[data-ti-site-cms-link], [data-ti-site-donation-doc], [data-ti-site-seat-link], [data-ti-site-rental-link]")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", load);
    } else {
      load();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

/**
 * 매거진 상세 — 이미지 URL + 캐시 무효화
 */
(function (global) {
  "use strict";

  /** 저장·표시 공통 — images/magazine/... 형태로 통일 */
  function normalizeMagazineAssetRelPath(url) {
    if (!url) return "";
    var s = String(url).trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) {
      try {
        s = new URL(s).pathname;
      } catch (e) {
        return s;
      }
    }
    while (/^\.\.\//.test(s)) {
      s = s.slice(3);
    }
    return s.replace(/^\/+/, "");
  }

  function resolveBase(url, base) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf("//") === 0) return "https:" + url;
    var rel = normalizeMagazineAssetRelPath(url);
    if (!rel) return "";
    if (global.TiSiteRoot && typeof global.TiSiteRoot.resolve === "function") {
      return global.TiSiteRoot.resolve(rel);
    }
    if (rel.charAt(0) === "/") return rel;
    return (base || "../") + rel;
  }

  function cacheKeyFromArticle(article) {
    if (!article) return String(Date.now());
    if (article.updatedAt) return String(new Date(article.updatedAt).getTime());
    if (article.createdAt) return String(new Date(article.createdAt).getTime());
    return String(Date.now());
  }

  function withCacheBust(resolved, cacheKey) {
    if (!resolved || !cacheKey) return resolved;
    var sep = resolved.indexOf("?") >= 0 ? "&" : "?";
    return resolved + sep + "v=" + encodeURIComponent(cacheKey);
  }

  function resolve(url, opts) {
    opts = opts || {};
    var base =
      opts.base != null
        ? opts.base
        : typeof global.TI_ASSET_BASE === "string"
          ? global.TI_ASSET_BASE
          : "../";
    var resolved = resolveBase(url, base);
    if (opts.cacheBust !== false && opts.cacheKey) {
      return withCacheBust(resolved, opts.cacheKey);
    }
    return resolved;
  }

  global.TiMagazineAsset = {
    resolve: resolve,
    normalizeRelPath: normalizeMagazineAssetRelPath,
    cacheKeyFromArticle: cacheKeyFromArticle,
    withCacheBust: withCacheBust
  };
})(typeof window !== "undefined" ? window : globalThis);

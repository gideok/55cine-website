/**
 * 매거진 상세 — 이미지 URL + 캐시 무효화
 */
(function (global) {
  "use strict";

  function resolveBase(url, base) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    if (url.indexOf("//") === 0) return "https:" + url;
    if (global.TiSiteRoot && typeof global.TiSiteRoot.resolve === "function") {
      return global.TiSiteRoot.resolve(url);
    }
    if (url.charAt(0) === "/") return url;
    return (base || "../") + String(url).replace(/^\//, "");
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
    cacheKeyFromArticle: cacheKeyFromArticle,
    withCacheBust: withCacheBust
  };
})(typeof window !== "undefined" ? window : globalThis);

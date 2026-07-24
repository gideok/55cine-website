/**
 * 사이트 루트 접두어 — 운영 기본 `/`, (선택) /55cine/ 등 서브디렉터리 배포
 * <head> 최상단에서 로드 — CSS/JS link·script href 자동 보정
 */
(function (global) {
  var cachedPrefix;

  function normalizePrefix(value) {
    if (value == null || value === "") return "/";
    var v = String(value).trim().replace(/\\/g, "/");
    if (!v.startsWith("/")) v = "/" + v;
    if (!v.endsWith("/")) v += "/";
    return v;
  }

  function siteRootFromJsPathname(pathname) {
    if (!pathname) return null;
    var path = String(pathname).replace(/\\/g, "/");
    var idx = path.lastIndexOf("/js/");
    if (idx >= 0) return path.slice(0, idx + 1) || "/";
    return null;
  }

  function isJsBundleSrc(src) {
    if (!src) return false;
    return /^js\//i.test(src) || src.indexOf("/js/") !== -1;
  }

  function detectFromScript() {
    var candidates = [];
    var current = document.currentScript;
    if (current) {
      if (current.src) candidates.push(current.src);
      var attr = current.getAttribute("src");
      if (attr) candidates.push(attr);
    }
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var el = scripts[i];
      var src = el.getAttribute("src");
      if (!src || !isJsBundleSrc(src)) continue;
      candidates.push(src);
      if (el.src) candidates.push(el.src);
    }
    var seen = {};
    for (var j = 0; j < candidates.length; j++) {
      var raw = candidates[j];
      if (!raw || seen[raw]) continue;
      seen[raw] = true;
      try {
        var path = new URL(raw, global.location.href).pathname;
        var root = siteRootFromJsPathname(path);
        if (root) return root;
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  function detectFromPathname() {
    var path = (global.location.pathname || "").replace(/\\/g, "/");
    if (!path || path === "/") return null;
    var markers = [
      "/index.html",
      "/now-playing.html",
      "/past-playing.html",
      "/upcoming-playing.html",
      "/magazine-preview.html",
      "/magazine-serial.html",
      "/magazine-past-articles.html",
      "/gv-moment.html",
      "/theater-info.html",
      "/viewing-guide.html",
      "/membership.html",
      "/daegwan.html",
      "/osinneun-gil.html",
      "/special-exhibition.html",
      "/special-event.html",
      "/movies/movie-detail.html",
      "/movies/now-playing/",
      "/magazine/preview/",
      "/magazine/serial/",
      "/magazine/past-articles/",
      "/magazine/gv-moment/",
      "/special/exhibition/",
      "/special/event/"
    ];
    var best = null;
    for (var i = 0; i < markers.length; i++) {
      var idx = path.indexOf(markers[i]);
      if (idx < 0) continue;
      var prefix = path.slice(0, idx);
      if (prefix.length > (best ? best.length : -1)) best = prefix;
    }
    if (best === null) return null;
    if (best === "") return "/";
    return best + "/";
  }

  function getSiteRootPrefix() {
    if (typeof global.TI_SITE_ROOT_PREFIX === "string" && global.TI_SITE_ROOT_PREFIX) {
      return normalizePrefix(global.TI_SITE_ROOT_PREFIX);
    }
    if (cachedPrefix !== undefined) return cachedPrefix;

    var meta = document.querySelector('meta[name="ti-site-root"]');
    if (meta) {
      var content = meta.getAttribute("content");
      if (content != null && String(content).trim() !== "") {
        cachedPrefix = normalizePrefix(content);
        return cachedPrefix;
      }
    }

    var fromScript = detectFromScript();
    if (fromScript) {
      cachedPrefix = normalizePrefix(fromScript);
      return cachedPrefix;
    }

    var fromPath = detectFromPathname();
    if (fromPath) {
      cachedPrefix = normalizePrefix(fromPath);
      return cachedPrefix;
    }

    cachedPrefix = "/";
    return cachedPrefix;
  }

  function normalizeAssetHref(url) {
    if (!url || typeof url !== "string") return url;
    if (/^https?:\/\//i.test(url) || url.indexOf("//") === 0) return url;

    var root = getSiteRootPrefix();
    if (root === "/") return url;

    try {
      var resolvedPath = new URL(url, global.location.href).pathname;
      if (resolvedPath.indexOf(root) === 0) return url;

      /* ../../../components/… 가 /55cine/ 밖(도메인 루트)으로 빠진 경우 */
      if (resolvedPath.charAt(0) === "/" && resolvedPath.indexOf(root) !== 0) {
        return root.replace(/\/$/, "") + resolvedPath;
      }
    } catch (e) {
      /* ignore */
    }

    return shouldPrefixAssetUrl(url) ? prefixAssetUrl(url) : url;
  }

  function shouldPrefixAssetUrl(url) {
    if (!url || typeof url !== "string") return false;
    if (/^https?:\/\//i.test(url)) return false;
    if (url.indexOf("//") === 0) return false;
    if (url.startsWith("../")) return false;
    var root = getSiteRootPrefix();
    if (root === "/") return false;
    if (url.charAt(0) === "/") return !url.startsWith(root);
    return true;
  }

  function prefixAssetUrl(url) {
    if (!shouldPrefixAssetUrl(url)) return url;
    var root = getSiteRootPrefix();
    if (url.charAt(0) === "/") return root.replace(/\/$/, "") + url;
    return root + url.replace(/^\//, "");
  }

  function resolveSitePath(relPath) {
    if (!relPath) return relPath;
    if (/^https?:\/\//i.test(relPath)) return relPath;
    if (relPath.indexOf("//") === 0) return relPath;
    if (relPath.charAt(0) === "/") {
      var root = getSiteRootPrefix();
      if (root !== "/" && relPath.indexOf(root) !== 0) {
        return root.replace(/\/$/, "") + relPath;
      }
      return relPath;
    }
    if (relPath.startsWith("../")) return relPath;
    return getSiteRootPrefix() + String(relPath).replace(/^\//, "");
  }

  function relativePrefixFromPage() {
    var siteRoot = getSiteRootPrefix();
    var path = (global.location.pathname || "").replace(/\\/g, "/");

    if (siteRoot === "/") {
      var segs = path.split("/").filter(Boolean);
      var depth = segs.length;
      if (depth && /\.html?$/i.test(segs[depth - 1])) depth = Math.max(0, depth - 1);
      return depth > 0 ? new Array(depth).fill("..").join("/") + "/" : "";
    }

    var base = siteRoot.replace(/\/$/, "");
    if (base && path.indexOf(base) !== 0) {
      segs = path.split("/").filter(Boolean);
      depth = segs.length;
      if (depth && /\.html?$/i.test(segs[depth - 1])) depth = Math.max(0, depth - 1);
      return depth > 0 ? new Array(depth).fill("..").join("/") + "/" : "";
    }

    var rest = path.slice(base.length).replace(/^\//, "");
    segs = rest.split("/").filter(Boolean);
    depth = segs.length;
    if (depth && /\.html?$/i.test(segs[depth - 1])) depth = Math.max(0, depth - 1);
    return depth > 0 ? new Array(depth).fill("..").join("/") + "/" : "";
  }

  /** head 파싱 중 link/script/img href·src 를 /55cine/... 로 보정 */
  function installHeadAssetInterceptor() {
    var root = getSiteRootPrefix();
    if (root === "/") return;

    var origCreate = document.createElement;
    document.createElement = function (tagName, options) {
      var el = origCreate.call(document, tagName, options);
      var tag = String(tagName).toLowerCase();
      if (tag !== "link" && tag !== "script" && tag !== "img") return el;

      var origSetAttribute = el.setAttribute;
      el.setAttribute = function (name, value) {
        if (name === "href" || name === "src") {
          value = normalizeAssetHref(value);
        }
        return origSetAttribute.call(this, name, value);
      };
      return el;
    };
  }

  function applyGlobalAssetBase() {
    var root = getSiteRootPrefix();
    if (root === "/") return;
    global.TI_ASSET_BASE = root;
  }

  installHeadAssetInterceptor();
  cachedPrefix = undefined;
  var detectedRoot = getSiteRootPrefix();
  applyGlobalAssetBase();

  global.TiSiteRoot = {
    getPrefix: getSiteRootPrefix,
    resolve: resolveSitePath,
    prefixAsset: prefixAssetUrl,
    relativePrefix: relativePrefixFromPage,
    debug: function () {
      return {
        href: global.location.href,
        pathname: global.location.pathname,
        prefix: getSiteRootPrefix(),
        assetBase: global.TI_ASSET_BASE,
        fromScript: detectFromScript(),
        fromPathname: detectFromPathname()
      };
    }
  };

  global.TI_SITE_ROOT_PREFIX = detectedRoot;

  // 공개 페이지 접속 통계 — admin 경로는 스크립트 내부에서 스킵
  function loadAnalyticsCollector() {
    try {
      var path = (global.location.pathname || "").toLowerCase();
      if (path.indexOf("/admin/") !== -1) return;
      if (document.querySelector('script[data-ti-analytics="1"]')) return;
      var s = document.createElement("script");
      s.async = true;
      s.setAttribute("data-ti-analytics", "1");
      var prefix =
        typeof relativePrefixFromPage === "function" ? relativePrefixFromPage() : "";
      s.src = prefix + "js/analytics-pageview.js";
      (document.head || document.documentElement).appendChild(s);
    } catch (_e) {
      /* ignore */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAnalyticsCollector, { once: true });
  } else {
    loadAnalyticsCollector();
  }
})(window);

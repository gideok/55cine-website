/**
 * partials/mobile-menu-bar.html — 모바일 상단 햄버거(820px 이하)
 * partials/left-gnb.html — GNB + 이번주 시간표 뼈대
 * 마운트: [data-ti-mobile-menu-bar] (선택), [data-ti-left-gnb] (필수)
 * GNB 경로 치환: __TI_SITE_ROOT__(Home·메뉴), __TI_SITE_ROOT__
 * 절대경로 `/…` 링크는 서브디렉터리 배포 시 깨질 수 있음 — 상대·TiSiteRoot 권장
 * 현재 항목: <meta name="ti-nav-current" content="파일명.html" />
 */
(function () {
  var gnbMounts = document.querySelectorAll("[data-ti-left-gnb]");
  if (!gnbMounts.length) return;

  var mobilePlaceholder = document.querySelector("[data-ti-mobile-menu-bar]");

  function computePathPrefixes() {
    if (window.TiSiteRoot && typeof window.TiSiteRoot.relativePrefix === "function") {
      var rel = window.TiSiteRoot.relativePrefix();
      return { testRoot: rel, siteRoot: rel };
    }
    var path = (location.pathname || "").replace(/\\/g, "/");
    var segments = path.split("/").filter(Boolean);
    var depth = segments.length;
    if (depth && /\.html?$/i.test(segments[depth - 1])) {
      depth = Math.max(0, depth - 1);
    }
    var siteRoot = depth > 0 ? new Array(depth).fill("..").join("/") + "/" : "";
    return { testRoot: siteRoot, siteRoot: siteRoot };
  }

  function resolveFromScript(filename) {
    var cs = document.currentScript;
    if (!cs || !cs.src) return null;
    try {
      return new URL("../partials/" + filename, cs.src).href;
    } catch (e) {
      return null;
    }
  }

  function markCurrentNav(root) {
    var meta = document.querySelector('meta[name="ti-nav-current"]');
    var raw = meta && meta.getAttribute("content");
    if (!raw || !root) return;
    var target = raw.trim().toLowerCase();
    if (!target) return;
    var marked = false;
    root.querySelectorAll(".ti-gnb a[href]").forEach(function (a) {
      if (marked) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;
      try {
        var u = new URL(href, location.href);
        var segs = u.pathname.split("/").filter(Boolean);
        var base = (segs[segs.length - 1] || "").toLowerCase();
        if (base === target) {
          a.classList.add("ti-current");
          a.setAttribute("aria-current", "page");
          var det = a.closest("details");
          if (det) det.open = true;
          marked = true;
        }
      } catch (e) {
        /* ignore */
      }
    });
  }

  function injectMobileBar(html) {
    if (!html || !mobilePlaceholder) return;
    var trimmed = html.trim();
    var temp = document.createElement("div");
    temp.innerHTML = trimmed;
    var bar = temp.firstElementChild;
    if (!bar) return;
    mobilePlaceholder.replaceWith(bar);
    mobilePlaceholder = null;
  }

  var gnbUrl = resolveFromScript("left-gnb.html");
  if (!gnbUrl) return;

  var mobileUrl = mobilePlaceholder ? resolveFromScript("mobile-menu-bar.html") : null;

  var prefixes = computePathPrefixes();

  var fetches = [
    fetch(gnbUrl).then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      return res.text();
    })
  ];
  if (mobileUrl) {
    fetches.push(
      fetch(mobileUrl)
        .then(function (res) {
          if (!res.ok) throw new Error(String(res.status));
          return res.text();
        })
        .catch(function () {
          return "";
        })
    );
  }

  Promise.all(fetches)
    .then(function (results) {
      var gnbTemplate = results[0];
      var mobileTemplate = results.length > 1 ? results[1] : null;

      if (mobileTemplate) {
        injectMobileBar(mobileTemplate.replace(/__TI_SITE_ROOT__/g, prefixes.siteRoot));
      }

      var html = gnbTemplate.replace(/__TI_SITE_ROOT__/g, prefixes.siteRoot);
      for (var i = 0; i < gnbMounts.length; i++) {
        gnbMounts[i].innerHTML = html;
        markCurrentNav(gnbMounts[i]);
      }
      window.dispatchEvent(new CustomEvent("ti-left-gnb:loaded", { bubbles: true }));
    })
    .catch(function () {
      /* file:// 등 */
    });
})();

(function (global) {
  var PREFIX = "ti_admin_list_";

  function persist(key, state) {
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(state));
    } catch (_e) {
      /* ignore */
    }
  }

  function peek(key) {
    try {
      var raw = sessionStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function restoreState(key, state, fields) {
    var saved = peek(key) || {};
    var params = new URLSearchParams(global.location.search);

    fields.forEach(function (field) {
      if (params.has(field)) {
        var val = params.get(field);
        if (field === "page" || field === "pageSize") {
          state[field] = Math.max(1, Number(val) || 1);
        } else if (field === "isPast") {
          state[field] = val === "1" || val === "true";
        } else {
          state[field] = val || "";
        }
      } else if (saved[field] !== undefined) {
        state[field] = saved[field];
      }
    });

    return state;
  }

  function listUrl(listPath, key, state, fields) {
    if (state) persist(key, state);
    var saved = state || peek(key);
    if (!saved) return listPath;

    var params = new URLSearchParams();
    (fields || ["page", "q"]).forEach(function (field) {
      var val = saved[field];
      if (field === "page") {
        if (val > 1) params.set("page", String(val));
        return;
      }
      if (field === "pageSize") {
        if (val && val !== 20) params.set("pageSize", String(val));
        return;
      }
      if (field === "isPast") {
        if (val) params.set("isPast", "1");
        return;
      }
      if (val !== undefined && val !== null && val !== "") {
        params.set(field, String(val));
      }
    });

    var qs = params.toString();
    return qs ? listPath + "?" + qs : listPath;
  }

  function syncUrl(listPath, key, state, fields) {
    persist(key, state);
    var url = listUrl(listPath, key, state, fields);
    var next = url.split("?")[1] || "";
    var current = global.location.search.replace(/^\?/, "");
    if (next !== current) {
      global.history.replaceState(null, "", url);
    }
  }

  var MAX_PAGE_DOTS = 20;

  function buildDotWindow(page, totalPages) {
    if (totalPages <= MAX_PAGE_DOTS) {
      return { start: 1, end: totalPages, leftEllipsis: false, rightEllipsis: false };
    }

    var half = Math.floor(MAX_PAGE_DOTS / 2);
    var start = page - half;
    var end = start + MAX_PAGE_DOTS - 1;

    if (start < 1) {
      start = 1;
      end = MAX_PAGE_DOTS;
    }
    if (end > totalPages) {
      end = totalPages;
      start = totalPages - MAX_PAGE_DOTS + 1;
    }

    return {
      start: start,
      end: end,
      leftEllipsis: start > 1,
      rightEllipsis: end < totalPages
    };
  }

  function renderPagerHtml(data, idPrefix) {
    idPrefix = idPrefix || "admin";
    var page = data.page || 1;
    var totalPages = Math.max(1, data.totalPages || 1);
    var windowRange = buildDotWindow(page, totalPages);
    var dots = "";

    if (windowRange.leftEllipsis) {
      dots += '<span class="admin-page-dots-ellipsis" aria-hidden="true">...</span>';
    }

    for (var i = windowRange.start; i <= windowRange.end; i++) {
      dots +=
        '<button type="button" class="admin-page-dot' +
        (i === page ? " is-active" : "") +
        '" data-page="' +
        i +
        '" aria-label="페이지 ' +
        i +
        '"></button>';
    }

    if (windowRange.rightEllipsis) {
      dots += '<span class="admin-page-dots-ellipsis" aria-hidden="true">...</span>';
    }

    return (
      '<footer class="admin-list-foot" aria-label="페이지네이션">' +
      '<button type="button" class="admin-page-btn" id="' +
      idPrefix +
      'PagerPrev"' +
      (page <= 1 ? " disabled" : "") +
      ">이전</button>" +
      '<span class="admin-page-fraction" id="' +
      idPrefix +
      'PagerFraction" aria-live="polite">' +
      page +
      " / " +
      totalPages +
      "</span>" +
      '<div class="admin-page-dots" id="' +
      idPrefix +
      'PagerDots">' +
      dots +
      "</div>" +
      '<button type="button" class="admin-page-btn" id="' +
      idPrefix +
      'PagerNext"' +
      (page >= totalPages ? " disabled" : "") +
      ">다음</button>" +
      "</footer>"
    );
  }

  function bindPager(idPrefix, state, data, onPageChange) {
    var totalPages = Math.max(1, data.totalPages || 1);
    var prev = document.getElementById(idPrefix + "PagerPrev");
    var next = document.getElementById(idPrefix + "PagerNext");
    var dotsRoot = document.getElementById(idPrefix + "PagerDots");

    if (prev) {
      prev.onclick = function () {
        if (state.page > 1) {
          state.page--;
          onPageChange();
        }
      };
    }

    if (next) {
      next.onclick = function () {
        if (state.page < totalPages) {
          state.page++;
          onPageChange();
        }
      };
    }

    if (dotsRoot) {
      dotsRoot.querySelectorAll(".admin-page-dot").forEach(function (dot) {
        dot.onclick = function () {
          var p = Number(dot.getAttribute("data-page"));
          if (p >= 1 && p <= totalPages && p !== state.page) {
            state.page = p;
            onPageChange();
          }
        };
      });
    }
  }

  function bindEditLinks(root, key, state) {
    if (!root) return;
    root.querySelectorAll("[data-admin-edit]").forEach(function (link) {
      link.addEventListener("click", function () {
        persist(key, state);
      });
    });
  }

  global.TiAdminList = {
    persist: persist,
    peek: peek,
    restoreState: restoreState,
    listUrl: listUrl,
    syncUrl: syncUrl,
    renderPagerHtml: renderPagerHtml,
    bindPager: bindPager,
    bindEditLinks: bindEditLinks
  };
})(typeof window !== "undefined" ? window : globalThis);

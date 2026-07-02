/**
 * 관리자 API 클라이언트 — /api/v1/admin/*
 */
(function (global) {
  var API_BASE =
    (global.TiResolveApiBase && global.TiResolveApiBase()) ||
    global.TI_API_BASE ||
    "/api/v1";
  if (global.TiNormalizeApiBase) {
    API_BASE = global.TiNormalizeApiBase(API_BASE);
  }
  global.TI_API_BASE = API_BASE;
  API_BASE = API_BASE.replace(/\/$/, "");

  function adminHeaders(withJsonBody) {
    var headers = { Accept: "application/json" };
    if (global.TiAdminAuth && typeof global.TiAdminAuth.sessionHeaders === "function") {
      Object.assign(headers, global.TiAdminAuth.sessionHeaders());
    }
    if (withJsonBody) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  function parseError(res, body) {
    var msg =
      (body && body.error && body.error.message) ||
      "요청 실패 (" + res.status + ")";
    throw new Error(msg);
  }

  function apiJson(method, path, body) {
    var url = API_BASE + (path.charAt(0) === "/" ? path : "/" + path);
    var hasBody = body !== undefined;
    var opts = {
      method: method,
      credentials: "include",
      headers: adminHeaders(hasBody)
    };
    if (hasBody) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () {
        return {};
      }).then(function (data) {
        if (res.status === 401 && global.TiAdminAuth) {
          try {
            global.localStorage.removeItem(global.TiAdminAuth.TOKEN_KEY);
          } catch (_e) {
            /* ignore */
          }
          if (global.TiAdminAuth.isAdminPath && global.TiAdminAuth.isAdminPath()) {
            global.TiAdminAuth.redirectUnauthenticated();
            return Promise.reject(new Error(global.TiAdminAuth.AUTH_MESSAGE || "관리자 인증이 필요합니다."));
          }
        }
        if (!res.ok) parseError(res, data);
        return data;
      });
    });
  }

  function uploadFile(file, fields) {
    var url = API_BASE + "/admin/upload";
    var form = new FormData();
    Object.keys(fields || {}).forEach(function (key) {
      form.append(key, String(fields[key]));
    });
    form.append("file", file);
    return fetch(url, {
      method: "POST",
      credentials: "include",
      headers: adminHeaders(false),
      body: form
    }).then(function (res) {
      return res.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!res.ok) parseError(res, data);
        return data;
      });
    });
  }

  global.TiAdminApi = {
    getDashboard: function () {
      return apiJson("GET", "/admin/dashboard");
    },
    getWorkSchedule: function (year, month) {
      return apiJson(
        "GET",
        "/admin/work-schedule?year=" +
          encodeURIComponent(String(year)) +
          "&month=" +
          encodeURIComponent(String(month))
      );
    },
    getPrograms: function (q, page, pageSize, desktopOnly) {
      var path =
        "/admin/programs?page=" +
        encodeURIComponent(String(page || 1)) +
        "&pageSize=" +
        encodeURIComponent(String(pageSize || 20));
      if (q) path += "&q=" + encodeURIComponent(q);
      if (desktopOnly) path += "&desktopOnly=1";
      return apiJson("GET", path);
    },
    getProgram: function (seq) {
      return apiJson("GET", "/admin/programs/" + encodeURIComponent(String(seq)));
    },
    getProgramByProgId: function (progId) {
      return apiJson(
        "GET",
        "/admin/programs/by-prog/" + encodeURIComponent(String(progId))
      );
    },
    updateProgram: function (seq, body) {
      return apiJson("PUT", "/admin/programs/" + encodeURIComponent(String(seq)), body);
    },
    upsertProgramByProgId: function (progId, body) {
      return apiJson(
        "PUT",
        "/admin/programs/by-prog/" + encodeURIComponent(String(progId)),
        body
      );
    },
    getProgramFormOptions: function () {
      return apiJson("GET", "/admin/programs/form-options");
    },
    checkProgramDuplicateTitle: function (name) {
      return apiJson(
        "GET",
        "/admin/programs/check-duplicate-title?name=" + encodeURIComponent(String(name || ""))
      );
    },
    checkProgramDuplicateSlug: function (slug, excludeSeq) {
      var path =
        "/admin/programs/check-duplicate-slug?slug=" +
        encodeURIComponent(String(slug || ""));
      if (excludeSeq != null && excludeSeq > 0) {
        path += "&excludeSeq=" + encodeURIComponent(String(excludeSeq));
      }
      return apiJson("GET", path);
    },
    createProgBase: function (body) {
      return apiJson("POST", "/admin/programs/prog-base", body);
    },
    updateProgBase: function (progId, body) {
      return apiJson(
        "PUT",
        "/admin/programs/prog-base/" + encodeURIComponent(String(progId)),
        body
      );
    },
    updateProgramAll: function (progId, baseBody, webBody) {
      return apiJson(
        "PUT",
        "/admin/programs/full/" + encodeURIComponent(String(progId)),
        { base: baseBody, web: webBody }
      );
    },
    getSpecialList: function (kind, q, page, pageSize) {
      var path =
        "/admin/special?page=" +
        encodeURIComponent(String(page || 1)) +
        "&pageSize=" +
        encodeURIComponent(String(pageSize || 20));
      if (kind) path += "&kind=" + encodeURIComponent(kind);
      if (q) path += "&q=" + encodeURIComponent(q);
      return apiJson("GET", path);
    },
    getSpecial: function (seq) {
      return apiJson("GET", "/admin/special/" + encodeURIComponent(String(seq)));
    },
    createSpecial: function (body) {
      return apiJson("POST", "/admin/special", body);
    },
    updateSpecial: function (seq, body) {
      return apiJson("PUT", "/admin/special/" + encodeURIComponent(String(seq)), body);
    },
    deleteSpecial: function (seq) {
      return apiJson("DELETE", "/admin/special/" + encodeURIComponent(String(seq)));
    },
    getMagazineList: function (opts) {
      opts = opts || {};
      var parts = [
        "page=" + encodeURIComponent(String(opts.page || 1)),
        "pageSize=" + encodeURIComponent(String(opts.pageSize || 20))
      ];
      if (opts.isPast) parts.push("isPast=true");
      else if (opts.section) parts.push("section=" + encodeURIComponent(opts.section));
      if (opts.q) parts.push("q=" + encodeURIComponent(opts.q));
      return apiJson("GET", "/admin/magazine?" + parts.join("&"));
    },
    getMagazine: function (seq) {
      return apiJson("GET", "/admin/magazine/" + encodeURIComponent(String(seq)));
    },
    createMagazine: function (body) {
      return apiJson("POST", "/admin/magazine", body);
    },
    updateMagazine: function (seq, body) {
      return apiJson("PUT", "/admin/magazine/" + encodeURIComponent(String(seq)), body);
    },
    deleteMagazine: function (seq) {
      return apiJson("DELETE", "/admin/magazine/" + encodeURIComponent(String(seq)));
    },
    markMagazinePast: function (seq) {
      return apiJson("POST", "/admin/magazine/" + encodeURIComponent(String(seq)) + "/mark-past");
    },
    restoreMagazineFromPast: function (seq, section) {
      return apiJson(
        "POST",
        "/admin/magazine/" + encodeURIComponent(String(seq)) + "/restore",
        { section: section }
      );
    },
    uploadFile: uploadFile,
    uploadMagazineTemp: function (file) {
      return uploadFile(file, { category: "magazine-temp" });
    },
    uploadSpecialTemp: function (file) {
      return uploadFile(file, { category: "special-temp" });
    },
    uploadProgramPoster: function (file, programSeq) {
      return uploadFile(file, { category: "program", programSeq: String(programSeq) });
    },
    getNoticeList: function () {
      return apiJson("GET", "/admin/notices");
    },
    getNotice: function (seq) {
      return apiJson("GET", "/admin/notices/" + encodeURIComponent(String(seq)));
    },
    createNotice: function (body) {
      return apiJson("POST", "/admin/notices", body);
    },
    updateNotice: function (seq, body) {
      return apiJson("PUT", "/admin/notices/" + encodeURIComponent(String(seq)), body);
    },
    deleteNotice: function (seq) {
      return apiJson("DELETE", "/admin/notices/" + encodeURIComponent(String(seq)));
    },
    activateNotice: function (seq) {
      return apiJson("POST", "/admin/notices/" + encodeURIComponent(String(seq)) + "/activate");
    },
    deactivateNotice: function (seq) {
      return apiJson("POST", "/admin/notices/" + encodeURIComponent(String(seq)) + "/deactivate");
    },
    uploadNoticeTemp: function (file) {
      return uploadFile(file, { category: "notice-temp" });
    },
    getSiteSettings: function () {
      return apiJson("GET", "/admin/site-settings");
    },
    updateSiteSettings: function (body) {
      return apiJson("PUT", "/admin/site-settings", body);
    },
    uploadSiteDocumentTemp: function (file) {
      return uploadFile(file, { category: "site-document-temp" });
    },
    searchKmdb: function (title) {
      return apiJson(
        "GET",
        "/admin/kmdb/search?title=" + encodeURIComponent(String(title || ""))
      );
    },
    fetchProgramPosterFromUrl: function (seq, url) {
      return apiJson(
        "POST",
        "/admin/programs/" + encodeURIComponent(String(seq)) + "/poster-from-url",
        { url: url }
      );
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * 관리자 API 클라이언트 — /api/v1/admin/*
 */
(function (global) {
  if (typeof global.TI_API_BASE !== "string" || !global.TI_API_BASE) {
    var loc = global.location;
    if (loc) {
      var host = loc.hostname || "";
      var port = loc.port || "";
      var isLocal = host === "localhost" || host === "127.0.0.1";
      if (isLocal && (port === "8080" || port === "5500" || port === "8888" || port === "")) {
        global.TI_API_BASE = "http://localhost:3000/api/v1";
      } else {
        global.TI_API_BASE = "/api/v1";
      }
    }
  }

  var API_BASE = (global.TI_API_BASE || "/api/v1").replace(/\/$/, "");

  function adminHeaders(withJsonBody) {
    var headers = {
      Accept: "application/json",
      // 추후수정 및 로그인 연동 — 스텁 인증 헤더
      "X-Admin-Auth": "true"
    };
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
      credentials: "same-origin",
      headers: adminHeaders(hasBody)
    };
    if (hasBody) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () {
        return {};
      }).then(function (data) {
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
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        // 추후수정 및 로그인 연동
        "X-Admin-Auth": "true"
      },
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
    getPrograms: function (q, page, pageSize) {
      var path =
        "/admin/programs?page=" +
        encodeURIComponent(String(page || 1)) +
        "&pageSize=" +
        encodeURIComponent(String(pageSize || 20));
      if (q) path += "&q=" + encodeURIComponent(q);
      return apiJson("GET", path);
    },
    getProgram: function (seq) {
      return apiJson("GET", "/admin/programs/" + encodeURIComponent(String(seq)));
    },
    updateProgram: function (seq, body) {
      return apiJson("PUT", "/admin/programs/" + encodeURIComponent(String(seq)), body);
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
    getSpecial: function (publicId) {
      return apiJson("GET", "/admin/special/" + encodeURIComponent(publicId));
    },
    createSpecial: function (body) {
      return apiJson("POST", "/admin/special", body);
    },
    updateSpecial: function (publicId, body) {
      return apiJson("PUT", "/admin/special/" + encodeURIComponent(publicId), body);
    },
    deleteSpecial: function (publicId) {
      return apiJson("DELETE", "/admin/special/" + encodeURIComponent(publicId));
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
    uploadFile: uploadFile,
    uploadMagazineTemp: function (file) {
      return uploadFile(file, { category: "magazine-temp" });
    },
    uploadProgramPoster: function (file, programSeq) {
      return uploadFile(file, { category: "program", programSeq: String(programSeq) });
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

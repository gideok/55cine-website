/**
 * 관리자 API 클라이언트 — /api/v1/admin/*
 */
(function (global) {
  var API_BASE =
    (global.TI_API_BASE || "/api/v1").replace(/\/$/, "");

  function adminHeaders() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      // 추후수정 및 로그인 연동 — 스텁 인증 헤더
      "X-Admin-Auth": "true"
    };
  }

  function parseError(res, body) {
    var msg =
      (body && body.error && body.error.message) ||
      "요청 실패 (" + res.status + ")";
    throw new Error(msg);
  }

  function apiJson(method, path, body) {
    var url = API_BASE + (path.charAt(0) === "/" ? path : "/" + path);
    var opts = {
      method: method,
      credentials: "same-origin",
      headers: adminHeaders()
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
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
    form.append("file", file);
    Object.keys(fields || {}).forEach(function (key) {
      form.append(key, String(fields[key]));
    });
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
    getMagazine: function (publicId) {
      return apiJson("GET", "/admin/magazine/" + encodeURIComponent(publicId));
    },
    createMagazine: function (body) {
      return apiJson("POST", "/admin/magazine", body);
    },
    updateMagazine: function (publicId, body) {
      return apiJson("PUT", "/admin/magazine/" + encodeURIComponent(publicId), body);
    },
    deleteMagazine: function (publicId) {
      return apiJson("DELETE", "/admin/magazine/" + encodeURIComponent(publicId));
    },
    markMagazinePast: function (publicId) {
      return apiJson("POST", "/admin/magazine/" + encodeURIComponent(publicId) + "/mark-past");
    },
    uploadFile: uploadFile
  };
})(typeof window !== "undefined" ? window : globalThis);

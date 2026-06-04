/**
 * Phase 2 공통 API 클라이언트 (개발명세_Phase2.md §5.1)
 * 운영: Nginx /api/ → 백엔드. 로컬: window.TI_API_BASE = "http://localhost:3000/api/v1"
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

  var API_BASE = global.TI_API_BASE || "/api/v1";

  function apiGet(path) {
    var url = API_BASE + (path.charAt(0) === "/" ? path : "/" + path);
    return fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () {
          return {};
        }).then(function (body) {
          var msg =
            (body.error && body.error.message) ||
            "요청 실패 (" + res.status + ")";
          throw new Error(msg);
        });
      }
      return res.json();
    });
  }

  function formatAnchorDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  /**
   * 주간 시간표 — anchor 미전달 시 백엔드 서버(Asia/Seoul) 오늘 기준
   */
  function getWeekSchedule(anchorDate) {
    var path = "/schedule/week";
    if (anchorDate != null && anchorDate !== "") {
      var anchor =
        anchorDate instanceof Date ? formatAnchorDate(anchorDate) : anchorDate;
      if (anchor) path += "?anchor=" + encodeURIComponent(anchor);
    }
    return apiGet(path);
  }

  function getMovieList(section) {
    return apiGet("/movies?section=" + encodeURIComponent(section)).then(function (data) {
      return data.movies || [];
    });
  }

  /**
   * 상영작 목록 페이지 단위 (PC 페이지네이션 / 모바일 추가 로드)
   * @returns {{ movies: Array, page: number, pageSize: number, total: number, totalPages: number }}
   */
  function getMovieListPage(section, page, pageSize, query) {
    var path =
      "/movies?section=" +
      encodeURIComponent(section) +
      "&page=" +
      encodeURIComponent(String(page)) +
      "&pageSize=" +
      encodeURIComponent(String(pageSize));
    if (query) path += "&q=" + encodeURIComponent(query);
    return apiGet(path);
  }

  function getMovieCatalog() {
    return apiGet("/movies/catalog").then(function (data) {
      return data.movies || [];
    });
  }

  function getMovieBySlug(slug, fromSection) {
    var path = "/movies/" + encodeURIComponent(slug);
    if (fromSection) path += "?from=" + encodeURIComponent(fromSection);
    return apiGet(path);
  }

  global.TiApi = {
    apiGet: apiGet,
    getWeekSchedule: getWeekSchedule,
    getMovieList: getMovieList,
    getMovieListPage: getMovieListPage,
    getMovieCatalog: getMovieCatalog,
    getMovieBySlug: getMovieBySlug,
    formatAnchorDate: formatAnchorDate
  };
})(typeof window !== "undefined" ? window : globalThis);

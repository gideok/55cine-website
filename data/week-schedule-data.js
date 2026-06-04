/**
 * GNB 시간표 헬퍼 + API 응답 적용 (GET /api/v1/schedule/week)
 * 데이터는 js/week-schedule.js 가 TiApi.getWeekSchedule 로 로드합니다.
 */
(function () {
  var BASE =
    (typeof window !== "undefined" && typeof window.TI_ASSET_BASE === "string" && window.TI_ASSET_BASE) ||
    (typeof window !== "undefined" && typeof window.WEEK_SCHEDULE_ASSET_BASE === "string" && window.WEEK_SCHEDULE_ASSET_BASE) ||
    "";

  function withBase(path) {
    if (!path) return path;
    if (typeof window !== "undefined" && window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(path);
    }
    return BASE + path;
  }

  function resolveDetailUrl(path) {
    return withBase(path);
  }

  function coerceBool(value) {
    return value === true || value === "true" || value === "True" || value === 1;
  }

  window.parseMovieTitleWithStatus = function (title) {
    var suffixMatch = String(title || "").match(/\s*\((개봉|종영|중영)\)\s*$/);
    if (!suffixMatch) {
      return {
        cleanTitle: title || "",
        badgeLabel: "",
        badgeClass: "",
        opening: false,
        closing: false
      };
    }
    var rawStatus = suffixMatch[1];
    var badgeLabel = rawStatus === "중영" ? "종영" : rawStatus;
    var badgeClass = badgeLabel === "개봉" ? "movie-status-badge--open" : "movie-status-badge--end";
    return {
      cleanTitle: String(title).replace(/\s*\((개봉|종영|중영)\)\s*$/, ""),
      badgeLabel: badgeLabel,
      badgeClass: badgeClass,
      opening: badgeLabel === "개봉",
      closing: badgeLabel === "종영"
    };
  };

  var SCHEDULE_BADGE_DEFS = [
    { key: "opening", label: "개봉", tiClass: "ti-badge--open", indexClass: "movie-status-badge--open" },
    { key: "closing", label: "종영", tiClass: "ti-badge--end", indexClass: "movie-status-badge--end" },
    { key: "gv", label: "GV", tiClass: "ti-badge--gv", indexClass: "movie-status-badge--gv" },
    { key: "ct", label: "CT", tiClass: "ti-badge--ct", indexClass: "movie-status-badge--ct" }
  ];

  /**
   * @param {object} entry
   * @returns {{ time: string, title: string, opening: boolean, closing: boolean, gv: boolean, ct: boolean, badges: Array<{label:string,tiClass:string,indexClass:string}> }}
   */
  window.normalizeWeekScheduleEntry = function (entry) {
    entry = entry || {};
    var parsed = window.parseMovieTitleWithStatus(entry.title);

    var opening =
      coerceBool(entry.opening) ||
      coerceBool(entry["개봉여부"]) ||
      parsed.opening;
    var closing =
      coerceBool(entry.closing) ||
      coerceBool(entry["종영여부"]) ||
      parsed.closing;
    var gv = coerceBool(entry.gv) || coerceBool(entry["GV여부"]);
    var ct = coerceBool(entry.ct) || coerceBool(entry["CT여부"]);

    var flags = { opening: opening, closing: closing, gv: gv, ct: ct };
    var badges = [];

    SCHEDULE_BADGE_DEFS.forEach(function (def) {
      if (!flags[def.key]) return;
      badges.push({
        label: def.label,
        tiClass: def.tiClass,
        indexClass: def.indexClass
      });
    });

    return {
      time: entry.time != null ? String(entry.time) : "",
      title: parsed.cleanTitle,
      opening: opening,
      closing: closing,
      gv: gv,
      ct: ct,
      badges: badges,
      badgeLabel: parsed.badgeLabel,
      badgeClass: parsed.badgeClass
    };
  };

  function normalizeEntries(entries) {
    return (entries || []).map(function (entry) {
      var n = window.normalizeWeekScheduleEntry(entry);
      return {
        time: n.time,
        title: n.title,
        opening: n.opening,
        closing: n.closing,
        gv: n.gv,
        ct: n.ct
      };
    });
  }

  window.WEEK_SCHEDULE = [];

  /**
   * @param {{ days?: Array, moviesByTitle?: Object }} payload
   */
  window.applyWeekScheduleApiPayload = function (payload) {
    payload = payload || {};
    window.WEEK_SCHEDULE = (payload.days || []).map(function (day) {
      return {
        label: day.label,
        weekday: day.weekday,
        entries: normalizeEntries(day.entries || [])
      };
    });

    window.MOVIE_POSTER_BY_TITLE = {};
    window.MOVIE_DETAIL_BY_TITLE = {};
    var movies = payload.moviesByTitle || {};
    for (var title in movies) {
      if (!Object.prototype.hasOwnProperty.call(movies, title)) continue;
      var row = movies[title];
      if (row && row.poster) {
        window.MOVIE_POSTER_BY_TITLE[title] = withBase(row.poster);
      }
      if (row && row.detailUrl) {
        window.MOVIE_DETAIL_BY_TITLE[title] = row.detailUrl;
      } else if (row && row.slug) {
        window.MOVIE_DETAIL_BY_TITLE[title] =
          "movies/movie-detail.html?slug=" + encodeURIComponent(row.slug);
      }
    }

    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent("ti-week-schedule:data-ready"));
    }
  };

  window.DEFAULT_SCHEDULE_POSTER = withBase("images/schedule-poster-placeholder.svg");

  window.movieDetailUrlForTitle = function (title) {
    if (!title) return "";
    var info = window.parseMovieTitleWithStatus(title);
    var raw =
      window.MOVIE_DETAIL_BY_TITLE[title] ||
      window.MOVIE_DETAIL_BY_TITLE[info.cleanTitle] ||
      "";
    return resolveDetailUrl(raw);
  };

  window.movieDetailUrlForPoster = function (posterUrl) {
    if (!posterUrl) return "";
    if (posterUrl.indexOf("movie001.jpg") !== -1) {
      return resolveDetailUrl("movies/movie-detail.html");
    }
    if (posterUrl.indexOf("movie002.jpg") !== -1) {
      return resolveDetailUrl("movies/movie-detail.html");
    }
    return "";
  };
})();

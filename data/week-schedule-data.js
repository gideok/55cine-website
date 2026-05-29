/**
 * 이번 주 시간표 정적 데이터 (5/21~6/3, index.html · test 페이지 공통)
 * 하위 경로에서 열 때는 로드 전에 window.TI_ASSET_BASE 또는 WEEK_SCHEDULE_ASSET_BASE 를 설정하세요.
 *
 * entries 항목:
 *   time, title, opening(개봉), closing(종영), gv(GV), ct(CT) — 여부는 boolean (API True/False)
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

  window.WEEK_SCHEDULE = [
    {
      label: "5/21(목)",
      weekday: "목",
      entries: normalizeEntries([
        { time: "11:30", title: "그녀가 돌아온 날", opening: false, closing: false, gv: false, ct: false },
        { time: "13:15", title: "교생실습", opening: false, closing: false, gv: false, ct: false },
        { time: "15:10", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "17:10", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "19:30", title: "유신의 집행관", opening: false, closing: false, gv: true, ct: false },
      ])
    },
    {
      label: "5/22(금)",
      weekday: "금",
      entries: normalizeEntries([
        { time: "11:30", title: "새벽의 Tango", opening: false, closing: false, gv: false, ct: false },
        { time: "13:50", title: "세계의 주인", opening: false, closing: false, gv: false, ct: false },
        { time: "16:10", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "19:00", title: "이반리 장만옥", opening: false, closing: false, gv: true, ct: false },
      ])
    },
    {
      label: "5/23(토)",
      weekday: "토",
      entries: normalizeEntries([
        { time: "11:30", title: "세계의 주인", opening: false, closing: false, gv: false, ct: false },
        { time: "13:45", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "15:55", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "17:50", title: "달걀 원정대", opening: false, closing: false, gv: false, ct: false },
        { time: "20:00", title: "그녀가 돌아온 날", opening: false, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "5/24(일)",
      weekday: "일",
      entries: normalizeEntries([
        { time: "11:30", title: "달걀 원정대", opening: false, closing: false, gv: false, ct: false },
        { time: "13:40", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "15:35", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "17:45", title: "힌드의 목소리", opening: false, closing: false, gv: false, ct: false },
        { time: "19:30", title: "세계의 주인", opening: false, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "5/25(월)",
      weekday: "월",
      entries: normalizeEntries([
        { time: "11:30", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "13:40", title: "달걀 원정대", opening: false, closing: false, gv: false, ct: false },
        { time: "15:50", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "17:45", title: "세계의 주인", opening: false, closing: false, gv: false, ct: false },
        { time: "20:00", title: "교생실습", opening: false, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "5/26(화)",
      weekday: "화",
      entries: normalizeEntries([
        { time: "11:00", title: "교생실습", opening: false, closing: false, gv: false, ct: false },
        { time: "12:50", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "15:00", title: "그녀가 돌아온 날", opening: false, closing: false, gv: false, ct: false },
        { time: "16:40", title: "힌드의 목소리", opening: false, closing: false, gv: false, ct: false },
        { time: "19:00", title: "어쩔수가없다", opening: false, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "5/27(수)",
      weekday: "수",
      entries: normalizeEntries([
        { time: "11:30", title: "그녀가 돌아온 날", opening: false, closing: false, gv: false, ct: false },
        { time: "13:10", title: "세계의 주인", opening: false, closing: false, gv: false, ct: false },
        { time: "15:50", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "18:05", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "20:15", title: "뒷자리에 태워줘", opening: true, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "5/28(목)",
      weekday: "목",
      entries: normalizeEntries([
        { time: "10:15", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "12:30", title: "교생실습", opening: false, closing: false, gv: false, ct: false },
        { time: "14:20", title: "그녀가 돌아온 날", opening: false, closing: false, gv: false, ct: false },
        { time: "16:00", title: "세계의 주인", opening: false, closing: false, gv: false, ct: false },
        { time: "18:15", title: "뒷자리에 태워줘", opening: false, closing: false, gv: false, ct: false },
        { time: "20:20", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "5/29(금)",
      weekday: "금",
      entries: normalizeEntries([
        { time: "10:15", title: "누룩", opening: false, closing: false, gv: false, ct: false },
        { time: "11:55", title: "새벽의 Tango", opening: false, closing: false, gv: false, ct: false },
        { time: "14:10", title: "뒷자리에 태워줘", opening: false, closing: false, gv: false, ct: false },
        { time: "16:15", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "18:10", title: "교생실습", opening: false, closing: false, gv: false, ct: false },
        { time: "20:00", title: "인디피크2025 - 단편 : 도시의 행복", opening: false, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "5/30(토)",
      weekday: "토",
      entries: normalizeEntries([
        { time: "11:30", title: "세계의 주인", opening: false, closing: false, gv: false, ct: false },
        { time: "13:45", title: "뒷자리에 태워줘", opening: false, closing: false, gv: false, ct: false },
        { time: "15:50", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "17:45", title: "달걀 원정대", opening: false, closing: false, gv: false, ct: false },
        { time: "19:55", title: "그녀가 돌아온 날", opening: false, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "5/31(일)",
      weekday: "일",
      entries: normalizeEntries([
        { time: "11:30", title: "뒷자리에 태워줘", opening: false, closing: false, gv: false, ct: false },
        { time: "14:00", title: "남태령", opening: false, closing: false, gv: true, ct: false },
        { time: "17:15", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "19:10", title: "새벽의 Tango", opening: false, closing: true, gv: false, ct: false },
      ])
    },
    {
      label: "6/1(월)",
      weekday: "월",
      entries: normalizeEntries([
        { time: "11:30", title: "교생실습", opening: false, closing: false, gv: false, ct: false },
        { time: "13:20", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "15:15", title: "그녀가 돌아온 날", opening: false, closing: false, gv: false, ct: false },
        { time: "16:55", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "19:10", title: "뒷자리에 태워줘", opening: false, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "6/2(화)",
      weekday: "화",
      entries: normalizeEntries([
        { time: "10:15", title: "누룩", opening: false, closing: false, gv: false, ct: false },
        { time: "11:55", title: "세계의 주인", opening: false, closing: false, gv: false, ct: false },
        { time: "14:10", title: "남태령", opening: false, closing: false, gv: false, ct: false },
        { time: "16:20", title: "교생실습", opening: false, closing: false, gv: false, ct: false },
        { time: "18:10", title: "달걀 원정대", opening: false, closing: false, gv: false, ct: false },
        { time: "20:20", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
      ])
    },
    {
      label: "6/3(수)",
      weekday: "수",
      entries: normalizeEntries([
        { time: "11:00", title: "세계의 주인", opening: false, closing: false, gv: false, ct: false },
        { time: "13:15", title: "순례자들은 왜 돌아오지 않는가", opening: true, closing: false, gv: false, ct: false },
        { time: "14:30", title: "너바나 더 밴드", opening: false, closing: false, gv: false, ct: false },
        { time: "16:25", title: "뒷자리에 태워줘", opening: false, closing: false, gv: false, ct: false },
        { time: "18:30", title: "순례자들은 왜 돌아오지 않는가", opening: true, closing: false, gv: false, ct: false },
        { time: "19:45", title: "남태령", opening: false, closing: false, gv: false, ct: false },
      ])
    }
  ];

  /** [현재 상영작]과 제목이 일치할 때 상세·포스터 경로 */
  var nowPlayingByTitle = {
    "달걀 원정대": {
      poster: "images/movies/now-playing/riddle-of-fire-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=riddle-of-fire"
    },
    "그녀가 돌아온 날": {
      poster: "images/movies/now-playing/the-day-she-returns-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=the-day-she-returns"
    },
    "새벽의 Tango": {
      poster: "images/movies/now-playing/tango-at-dawn-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=tango-at-dawn"
    },
    "힌드의 목소리": {
      poster: "images/movies/now-playing/the-voice-of-hind-rajab-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=the-voice-of-hind-rajab"
    },
    누룩: {
      poster: "images/movies/now-playing/the-yeast-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=the-yeast"
    },
    "빨간 나라를 보았니": {
      poster: "images/movies/now-playing/have-you-seen-the-land-of-the-red-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=have-you-seen-the-land-of-the-red"
    },
    "세계의 주인": {
      poster: "images/movies/now-playing/the-world-of-love-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=the-world-of-love"
    },
    "교생실습": {
      poster: "images/movies/now-playing/teaching-practice-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=teaching-practice"
    },
    "남태령": {
      poster: "images/movies/now-playing/namtaeryeong-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=namtaeryeong"
    },
    "너바나 더 밴드": {
      poster: "images/movies/now-playing/nirvanna-the-band-the-show-the-movie-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=nirvanna-the-band-the-show-the-movie"
    },
    "뒷자리에 태워줘": {
      poster: "images/movies/now-playing/pillion-poster.jpg",
      detailUrl: "movies/movie-detail.html?slug=pillion"
    }
  };

  window.DEFAULT_SCHEDULE_POSTER = withBase("images/schedule-poster-placeholder.svg");

  window.MOVIE_POSTER_BY_TITLE = {};
  window.MOVIE_DETAIL_BY_TITLE = {};

  for (var title in nowPlayingByTitle) {
    if (!Object.prototype.hasOwnProperty.call(nowPlayingByTitle, title)) continue;
    var row = nowPlayingByTitle[title];
    window.MOVIE_POSTER_BY_TITLE[title] = withBase(row.poster);
    window.MOVIE_DETAIL_BY_TITLE[title] = row.detailUrl;
  }

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

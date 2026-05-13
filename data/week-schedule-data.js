/**
 * 이번 주 시간표 정적 데이터 (index.html · test 페이지 공통)
 * 하위 경로에서 열 때는 로드 전에 window.TEST_TI_ASSET_BASE 또는 WEEK_SCHEDULE_ASSET_BASE 를 설정하세요.
 */
(function () {
  var BASE =
    (typeof window !== "undefined" && typeof window.TEST_TI_ASSET_BASE === "string" && window.TEST_TI_ASSET_BASE) ||
    (typeof window !== "undefined" && typeof window.WEEK_SCHEDULE_ASSET_BASE === "string" && window.WEEK_SCHEDULE_ASSET_BASE) ||
    "";

  function withBase(path) {
    if (!path) return path;
    return BASE + path;
  }

  window.WEEK_SCHEDULE = [
    {
      label: "4/30(목)",
      weekday: "목",
      entries: [
        { time: "11:30", title: "빨간 나리를 보았니" },
        { time: "13:50", title: "세계의 주인" },
        { time: "16:15", title: "극장의 시간들" },
        { time: "18:20", title: "힌드의 목소리" },
        { time: "20:05", title: "새벽의 Tango" }
      ]
    },
    {
      label: "5/1(금)",
      weekday: "금",
      entries: [
        { time: "11:30", title: "누룩" },
        { time: "13:10", title: "센티멘탈 밸류" },
        { time: "14:00", title: "르누아르" },
        { time: "15:40", title: "힌드의 목소리" },
        { time: "17:25", title: "새벽의 Tango" },
        { time: "19:40", title: "세계의 주인" }
      ]
    },
    {
      label: "5/2(토)",
      weekday: "토",
      entries: [
        { time: "11:30", title: "세계의 주인" },
        { time: "13:45", title: "힌드의 목소리" },
        { time: "15:30", title: "새벽의 Tango" },
        { time: "17:45", title: "센티멘탈 밸류" },
        { time: "20:15", title: "누룩" }
      ]
    },
    {
      label: "5/3(일)",
      weekday: "일",
      entries: [
        { time: "11:30", title: "새벽의 Tango" },
        { time: "13:45", title: "센티멘탈 밸류" },
        { time: "16:15", title: "힌드의 목소리" },
        { time: "18:00", title: "세계의 주인" },
        { time: "20:15", title: "주의에게" }
      ]
    },
    {
      label: "5/4(월)",
      weekday: "월",
      entries: [
        { time: "11:30", title: "주의에게" },
        { time: "13:30", title: "누룩" },
        { time: "15:10", title: "새벽의 Tango" },
        { time: "17:25", title: "빨간 나리를 보았니" },
        { time: "19:40", title: "극장의 시간들 (중영)" }
      ]
    },
    {
      label: "5/5(화)",
      weekday: "화",
      entries: [
        { time: "11:30", title: "누룩" },
        { time: "13:10", title: "새벽의 Tango" },
        { time: "15:25", title: "힌드의 목소리" },
        { time: "17:10", title: "센티멘탈 밸류 (중영)" },
        { time: "19:40", title: "세계의 주인" }
      ]
    },
    {
      label: "5/6(수)",
      weekday: "수",
      entries: [
        { time: "11:15", title: "새벽의 Tango" },
        { time: "13:30", title: "세계의 주인" },
        { time: "15:45", title: "누룩" },
        { time: "17:30", title: "그녀가 돌아온 날 (개봉)" },
        { time: "19:15", title: "달갈 원정대 (개봉)" }
      ]
    }
  ];

  var postersRel = {
    르누아르: "images/movie001.jpg",
    "빨간 나리를 보았니": "images/movie001.jpg",
    "세계의 주인": "images/movie002.jpg",
    "극장의 시간들": "images/movie003.jpg",
    "극장의 시간들 (중영)": "images/movie003.jpg",
    "힌드의 목소리": "images/movie004.jpg",
    "새벽의 Tango": "images/movie001.jpg",
    누룩: "images/movie002.jpg",
    "센티멘탈 밸류": "images/movie003.jpg",
    "센티멘탈 밸류 (중영)": "images/movie003.jpg",
    주의에게: "images/movie004.jpg",
    "그녀가 돌아온 날 (개봉)": "images/movie001.jpg",
    "달갈 원정대 (개봉)": "images/movie002.jpg"
  };

  window.MOVIE_POSTER_BY_TITLE = {};
  for (var key in postersRel) {
    if (Object.prototype.hasOwnProperty.call(postersRel, key)) {
      window.MOVIE_POSTER_BY_TITLE[key] = withBase(postersRel[key]);
    }
  }

  window.movieDetailUrlForPoster = function (posterUrl) {
    if (!posterUrl) return "";
    if (posterUrl.indexOf("movie001.jpg") !== -1) return withBase("movie-detail.html");
    if (posterUrl.indexOf("movie002.jpg") !== -1) return withBase("movie-detail-type2.html");
    return "";
  };

  window.parseMovieTitleWithStatus = function (title) {
    var suffixMatch = title.match(/\s*\((개봉|종영|중영)\)\s*$/);
    if (!suffixMatch) {
      return { cleanTitle: title, badgeLabel: "", badgeClass: "" };
    }
    var rawStatus = suffixMatch[1];
    var badgeLabel = rawStatus === "중영" ? "종영" : rawStatus;
    var badgeClass = badgeLabel === "개봉" ? "movie-status-badge--open" : "movie-status-badge--end";
    return {
      cleanTitle: title.replace(/\s*\((개봉|종영|중영)\)\s*$/, ""),
      badgeLabel: badgeLabel,
      badgeClass: badgeClass
    };
  };
})();

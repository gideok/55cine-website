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

  /** 테스트 UI: 상세는 test/movies/now-playing/ 기준, 포스터만 사이트 루트 images/ */
  var isTestTi =
    typeof window !== "undefined" &&
    typeof window.TEST_TI_ASSET_BASE === "string" &&
    window.TEST_TI_ASSET_BASE;

  function withDetailBase(path) {
    if (!path) return path;
    return isTestTi ? path : withBase(path);
  }

  window.WEEK_SCHEDULE = [
    {
      label: "5/14(목)",
      weekday: "목",
      entries: [
        { time: "11:30", title: "세계의 주인" },
        { time: "13:45", title: "빨간 나라를 보았니" },
        { time: "16:00", title: "새벽의 Tango" },
        { time: "18:15", title: "교생실습" },
        { time: "20:05", title: "그녀가 돌아온 날" }
      ]
    },
    {
      label: "5/15(금)",
      weekday: "금",
      entries: [
        { time: "11:30", title: "누룩" },
        { time: "13:15", title: "그녀가 돌아온 날" },
        { time: "15:00", title: "교생실습" },
        { time: "16:55", title: "빨간 나라를 보았니" },
        { time: "19:30", title: "달걀 원정대" }
      ]
    },
    {
      label: "5/16(토)",
      weekday: "토",
      entries: [
        { time: "11:30", title: "교생실습" },
        { time: "13:20", title: "달걀 원정대" },
        { time: "15:30", title: "그녀가 돌아온 날" },
        { time: "17:10", title: "힌드의 목소리" },
        { time: "19:00", title: "세계의 주인" }
      ]
    },
    {
      label: "5/17(일)",
      weekday: "일",
      entries: [
        { time: "11:30", title: "힌드의 목소리" },
        { time: "13:15", title: "그녀가 돌아온 날" },
        { time: "14:55", title: "달걀 원정대" },
        { time: "17:05", title: "세계의 주인" },
        { time: "19:20", title: "교생실습" }
      ]
    },
    {
      label: "5/18(월)",
      weekday: "월",
      entries: [
        { time: "11:30", title: "그녀가 돌아온 날" },
        { time: "13:10", title: "세계의 주인" },
        { time: "15:25", title: "새벽의 Tango" },
        { time: "17:40", title: "교생실습" },
        { time: "19:30", title: "빨간 나라를 보았니 (종영)" }
      ]
    },
    {
      label: "5/19(화)",
      weekday: "화",
      entries: [
        { time: "10:30", title: "세계의 주인" },
        { time: "12:45", title: "누룩" },
        { time: "14:25", title: "교생실습" },
        { time: "16:15", title: "새벽의 Tango" },
        { time: "18:25", title: "그녀가 돌아온 날" },
        { time: "20:05", title: "달걀 원정대" }
      ]
    },
    {
      label: "5/20(수)",
      weekday: "수",
      entries: [
        { time: "10:30", title: "교생실습" },
        { time: "12:20", title: "남태령 (개봉)" },
        { time: "14:30", title: "너바나'와는 별 관련 없는 '너바나 더 밴드' (개봉)" },
        { time: "16:25", title: "그녀가 돌아온 날" },
        { time: "18:10", title: "남태령 (개봉)" },
        { time: "20:20", title: "너바나'와는 별 관련 없는 '너바나 더 밴드' (개봉)" }
      ]
    }
  ];

  /** [현재 상영작]과 제목이 일치할 때 상세·포스터 경로 */
  var nowPlayingByTitle = {
    "달걀 원정대": {
      poster: "images/movies/now-playing/riddle-of-fire-poster.jpg",
      detailUrl: "movies/now-playing/riddle-of-fire.html"
    },
    "그녀가 돌아온 날": {
      poster: "images/movies/now-playing/the-day-she-returns-poster.jpg",
      detailUrl: "movies/now-playing/the-day-she-returns.html"
    },
    "새벽의 Tango": {
      poster: "images/movies/now-playing/tango-at-dawn-poster.jpg",
      detailUrl: "movies/now-playing/tango-at-dawn.html"
    },
    "힌드의 목소리": {
      poster: "images/movies/now-playing/the-voice-of-hind-rajab-poster.jpg",
      detailUrl: "movies/now-playing/the-voice-of-hind-rajab.html"
    },
    누룩: {
      poster: "images/movies/now-playing/the-yeast-poster.jpg",
      detailUrl: "movies/now-playing/the-yeast.html"
    },
    "빨간 나라를 보았니": {
      poster: "images/movies/now-playing/have-you-seen-the-land-of-the-red-poster.jpg",
      detailUrl: "movies/now-playing/have-you-seen-the-land-of-the-red.html"
    },
    "세계의 주인": {
      poster: "images/movies/now-playing/the-world-of-love-poster.jpg",
      detailUrl: "movies/now-playing/the-world-of-love.html"
    },
    "교생실습": {
      poster: "images/movies/now-playing/teaching-practice-poster.jpg",
      detailUrl: "movies/now-playing/teaching-practice.html"
    },
    "남태령 (개봉)": {
      poster: "images/movies/now-playing/namtaeryeong-poster.jpg",
      detailUrl: "movies/now-playing/namtaeryeong.html"
    },
    "남태령": {
      poster: "images/movies/now-playing/namtaeryeong-poster.jpg",
      detailUrl: "movies/now-playing/namtaeryeong.html"
    },
    "너바나'와는 별 관련 없는 '너바나 더 밴드' (개봉)": {
      poster: "images/movies/now-playing/nirvanna-the-band-the-show-the-movie-poster.jpg",
      detailUrl: "movies/now-playing/nirvanna-the-band-the-show-the-movie.html"
    },
    "너바나'와는 별 관련 없는 '너바나 더 밴드'": {
      poster: "images/movies/now-playing/nirvanna-the-band-the-show-the-movie-poster.jpg",
      detailUrl: "movies/now-playing/nirvanna-the-band-the-show-the-movie.html"
    }
  };

  window.MOVIE_POSTER_BY_TITLE = {};
  window.MOVIE_DETAIL_BY_TITLE = {};

  for (var title in nowPlayingByTitle) {
    if (!Object.prototype.hasOwnProperty.call(nowPlayingByTitle, title)) continue;
    var row = nowPlayingByTitle[title];
    window.MOVIE_POSTER_BY_TITLE[title] = withBase(row.poster);
    window.MOVIE_DETAIL_BY_TITLE[title] = withDetailBase(row.detailUrl);
  }

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

  window.movieDetailUrlForTitle = function (title) {
    if (!title) return "";
    var info = window.parseMovieTitleWithStatus(title);
    return (
      window.MOVIE_DETAIL_BY_TITLE[title] ||
      window.MOVIE_DETAIL_BY_TITLE[info.cleanTitle] ||
      ""
    );
  };

  window.movieDetailUrlForPoster = function (posterUrl) {
    if (!posterUrl) return "";
    if (posterUrl.indexOf("movie001.jpg") !== -1) return withBase("movie-detail.html");
    if (posterUrl.indexOf("movie002.jpg") !== -1) return withBase("movie-detail-type2.html");
    return "";
  };
})();

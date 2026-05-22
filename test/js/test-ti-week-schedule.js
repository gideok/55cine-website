(function () {
  var BASE =
    typeof window.TEST_TI_ASSET_BASE === "string" ? window.TEST_TI_ASSET_BASE : "";

  function asset(path) {
    if (!path) return path;
    return BASE + path;
  }

  /** test/ 하위 깊이에 맞게 movies/now-playing/… 상세 경로 보정 */
  function computeTestRoot() {
    var path = (location.pathname || "").replace(/\\/g, "/");
    var lower = path.toLowerCase();
    var needle = "/test/";
    var i = lower.indexOf(needle);
    if (i === -1) return "";
    var rest = path.slice(i + needle.length);
    var segments = rest.split("/").filter(Boolean);
    var depth = Math.max(0, segments.length - 1);
    return depth > 0 ? new Array(depth).fill("..").join("/") + "/" : "";
  }

  function resolveMovieDetailUrl(url) {
    if (!url || /^https?:/i.test(url)) return url || "";
    var testRoot = computeTestRoot();
    if (!testRoot) return url;
    return testRoot + url.replace(/^\//, "");
  }

  var WEEK_SCHEDULE = window.WEEK_SCHEDULE;
  var MOVIE_POSTER_BY_TITLE = window.MOVIE_POSTER_BY_TITLE;
  var parseMovieTitleWithStatus = window.parseMovieTitleWithStatus;
  var movieDetailUrlForPoster = window.movieDetailUrlForPoster;
  var movieDetailUrlForTitle = window.movieDetailUrlForTitle;
  if (!WEEK_SCHEDULE || !MOVIE_POSTER_BY_TITLE || !parseMovieTitleWithStatus) {
    return;
  }

  var MOVIE_IMAGES = [
    asset("images/movie001.jpg"),
    asset("images/movie002.jpg"),
    asset("images/movie003.jpg"),
    asset("images/movie004.jpg")
  ];
  var WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

  var scheduleInitDone = false;

  function initTestTiWeekSchedule() {
    if (scheduleInitDone) return;

    var dayTabs = document.getElementById("tiDayTabs");
    var panelsWrap = document.getElementById("tiSchedulePanels");
    if (!dayTabs || !panelsWrap) return;
    if (dayTabs.querySelector(".ti-day-tab")) {
      scheduleInitDone = true;
      return;
    }

    scheduleInitDone = true;

    var todayWeekdayLabel = WEEKDAY_LABELS[new Date().getDay()];
    var defaultIndex = Math.max(
      0,
      WEEK_SCHEDULE.findIndex(function (day) {
        return day.weekday === todayWeekdayLabel;
      })
    );

    WEEK_SCHEDULE.forEach(function (day, i) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "ti-day-tab";
      tab.setAttribute("role", "tab");
      tab.id = "ti-tab-day-" + i;
      tab.setAttribute("aria-controls", "ti-panel-day-" + i);
      tab.textContent = day.label;
      tab.setAttribute("aria-selected", i === defaultIndex ? "true" : "false");
      dayTabs.appendChild(tab);

      var panel = document.createElement("div");
      panel.className = "ti-panel" + (i === defaultIndex ? " is-active" : "");
      panel.id = "ti-panel-day-" + i;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", "ti-tab-day-" + i);
      panel.hidden = i !== defaultIndex;

      day.entries.forEach(function (entry, entryIndex) {
        var titleInfo = parseMovieTitleWithStatus(entry.title);
        var poster =
          MOVIE_POSTER_BY_TITLE[entry.title] ||
          MOVIE_POSTER_BY_TITLE[titleInfo.cleanTitle] ||
          MOVIE_IMAGES[entryIndex % MOVIE_IMAGES.length];
        var detailUrl = resolveMovieDetailUrl(
          (movieDetailUrlForTitle && movieDetailUrlForTitle(entry.title)) ||
            (movieDetailUrlForPoster && movieDetailUrlForPoster(poster)) ||
            ""
        );

        var row = document.createElement("div");
        row.className = "ti-row";

        var slot = document.createElement("span");
        slot.className = "ti-slot";
        slot.setAttribute("aria-label", entryIndex + 1 + "회차");
        slot.textContent = String(entryIndex + 1);

        var img = document.createElement("img");
        img.className = "ti-poster";
        img.src = poster;
        img.alt = entry.title + " 포스터";
        img.width = 40;
        img.height = 40;

        var titleWrap = document.createElement("span");
        titleWrap.className = "ti-title";
        var titleText = document.createElement("span");
        titleText.className = "ti-title-text";
        if (detailUrl) {
          var la = document.createElement("a");
          la.href = detailUrl;
          la.textContent = titleInfo.cleanTitle;
          titleText.appendChild(la);
        } else {
          titleText.textContent = titleInfo.cleanTitle;
        }
        titleWrap.appendChild(titleText);
        if (titleInfo.badgeLabel) {
          var badge = document.createElement("span");
          badge.className = "ti-badge";
          badge.textContent = titleInfo.badgeLabel;
          titleWrap.appendChild(badge);
        }

        var timeEl = document.createElement("span");
        timeEl.className = "ti-time";
        timeEl.textContent = entry.time;

        var bookUrl =
          "https://www.dtryx.com/cinema/main.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059";
        var book = document.createElement("a");
        book.className = "ti-book";
        book.href = bookUrl;
        book.target = "_blank";
        book.rel = "noopener noreferrer";
        book.setAttribute("aria-label", entry.title + " " + entry.time + " 예매하기");
        book.textContent = "예매";

        var posterWrap = detailUrl ? document.createElement("a") : document.createElement("span");
        if (detailUrl) posterWrap.href = detailUrl;
        posterWrap.appendChild(img);

        row.appendChild(slot);
        row.appendChild(posterWrap);
        row.appendChild(titleWrap);
        row.appendChild(timeEl);
        row.appendChild(book);
        panel.appendChild(row);
      });

      panelsWrap.appendChild(panel);

      tab.addEventListener("click", function () {
        dayTabs.querySelectorAll(".ti-day-tab").forEach(function (t) {
          t.setAttribute("aria-selected", "false");
        });
        tab.setAttribute("aria-selected", "true");
        panelsWrap.querySelectorAll(".ti-panel").forEach(function (p, idx) {
          var active = idx === i;
          p.classList.toggle("is-active", active);
          p.hidden = !active;
        });
      });
    });

    var selected = dayTabs.querySelector('[aria-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  window.addEventListener("ti-left-gnb:loaded", initTestTiWeekSchedule);
  initTestTiWeekSchedule();
  window.addEventListener("load", initTestTiWeekSchedule);
  if (document.readyState === "complete") {
    window.requestAnimationFrame(initTestTiWeekSchedule);
  }
})();

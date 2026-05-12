(function () {
  var BASE =
    typeof window.TEST_TI_ASSET_BASE === "string" ? window.TEST_TI_ASSET_BASE : "";

  function asset(path) {
    if (!path) return path;
    return BASE + path;
  }

  var MOVIE_IMAGES = [
    asset("images/movie001.jpg"),
    asset("images/movie002.jpg"),
    asset("images/movie003.jpg"),
    asset("images/movie004.jpg")
  ];
  var WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

  var WEEK_SCHEDULE = [
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
        { time: "11:30", title: "누륵" },
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
        { time: "20:15", title: "누륵" }
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
        { time: "13:30", title: "누륵" },
        { time: "15:10", title: "새벽의 Tango" },
        { time: "17:25", title: "빨간 나리를 보았니" },
        { time: "19:40", title: "극장의 시간들 (중영)" }
      ]
    },
    {
      label: "5/5(화)",
      weekday: "화",
      entries: [
        { time: "11:30", title: "누륵" },
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
        { time: "15:45", title: "누륵" },
        { time: "17:30", title: "그녀가 돌아온 날 (개봉)" },
        { time: "19:15", title: "달갈 원정대 (개봉)" }
      ]
    }
  ];

  var MOVIE_POSTER_BY_TITLE = {
    르누아르: asset("images/movie001.jpg"),
    "빨간 나리를 보았니": asset("images/movie001.jpg"),
    "세계의 주인": asset("images/movie002.jpg"),
    "극장의 시간들": asset("images/movie003.jpg"),
    "극장의 시간들 (중영)": asset("images/movie003.jpg"),
    "힌드의 목소리": asset("images/movie004.jpg"),
    "새벽의 Tango": asset("images/movie001.jpg"),
    누륵: asset("images/movie002.jpg"),
    "센티멘탈 밸류": asset("images/movie003.jpg"),
    "센티멘탈 밸류 (중영)": asset("images/movie003.jpg"),
    주의에게: asset("images/movie004.jpg"),
    "그녀가 돌아온 날 (개봉)": asset("images/movie001.jpg"),
    "달갈 원정대 (개봉)": asset("images/movie002.jpg")
  };

  function movieDetailUrlForPoster(posterUrl) {
    if (posterUrl.indexOf("movie001.jpg") !== -1) return asset("movie-detail.html");
    if (posterUrl.indexOf("movie002.jpg") !== -1) return asset("movie-detail-type2.html");
    return "";
  }

  function parseMovieTitleWithStatus(title) {
    var suffixMatch = title.match(/\s*\((개봉|종영|중영)\)\s*$/);
    if (!suffixMatch) {
      return { cleanTitle: title, badgeLabel: "", badgeClass: "" };
    }
    var rawStatus = suffixMatch[1];
    var badgeLabel = rawStatus === "중영" ? "종영" : rawStatus;
    return {
      cleanTitle: title.replace(/\s*\((개봉|종영|중영)\)\s*$/, ""),
      badgeLabel: badgeLabel
    };
  }

  var dayTabs = document.getElementById("tiDayTabs");
  var panelsWrap = document.getElementById("tiSchedulePanels");
  if (!dayTabs || !panelsWrap) return;

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
      var detailUrl = movieDetailUrlForPoster(poster);

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

      var book = document.createElement("button");
      book.type = "button";
      book.className = "ti-book";
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
})();

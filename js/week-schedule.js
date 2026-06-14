(function () {
  var BASE = typeof window.TI_ASSET_BASE === "string" ? window.TI_ASSET_BASE : "";
  var MOBILE_MQ = window.matchMedia("(max-width: 820px)");

  function asset(path) {
    if (!path) return path;
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(path);
    }
    return BASE + path;
  }

  function resolveMovieDetailUrl(url) {
    if (!url || /^https?:/i.test(url)) return url || "";
    if (window.TiSiteRoot && typeof window.TiSiteRoot.resolve === "function") {
      return window.TiSiteRoot.resolve(url);
    }
    return url;
  }

  var scheduleBootstrapped = false;
  var scheduleFetchStarted = false;

  function getWeekScheduleRef() {
    return window.WEEK_SCHEDULE;
  }

  function getMoviePosterMap() {
    return window.MOVIE_POSTER_BY_TITLE || {};
  }

  function getNormalizeEntry() {
    return window.normalizeWeekScheduleEntry;
  }

  function getDefaultSchedulePoster() {
    return window.DEFAULT_SCHEDULE_POSTER;
  }

  function getMovieDetailUrlForPoster() {
    return window.movieDetailUrlForPoster;
  }

  function getMovieDetailUrlForTitle() {
    return window.movieDetailUrlForTitle;
  }

  var BOOK_URL =
    "https://www.dtryx.com/cinema/main.do?cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059";

  var scheduleState = {
    weekView: "primary",
    activeIndex: 0
  };

  var scheduleDom = {
    dayTabs: null,
    panelsWrap: null,
    schedTitle: null
  };

  var enrichedDays = [];
  var scrollSyncBound = false;
  var weekTransitionLock = false;
  var SCHEDULE_STATE_KEY = "ti-gnb-schedule-state";
  /** API 응답 anchor — 백엔드 서버 기준 '오늘' */
  var scheduleAnchorToday = null;

  function saveScheduleState() {
    var days = daysForActiveView();
    if (!days.length) return;
    var day = days[scheduleState.activeIndex];
    try {
      sessionStorage.setItem(
        SCHEDULE_STATE_KEY,
        JSON.stringify({
          weekView: scheduleState.weekView,
          activeIndex: scheduleState.activeIndex,
          dayLabel: day && day.label ? day.label : ""
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function getSavedScheduleState() {
    try {
      var raw = sessionStorage.getItem(SCHEDULE_STATE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function resolveSavedScheduleIndex(saved, days) {
    if (!saved || !days.length) return -1;
    if (saved.dayLabel) {
      var byLabel = days.findIndex(function (day) {
        return day.label === saved.dayLabel;
      });
      if (byLabel >= 0) return byLabel;
    }
    if (typeof saved.activeIndex === "number" && saved.activeIndex >= 0 && saved.activeIndex < days.length) {
      return saved.activeIndex;
    }
    return -1;
  }

  function applySavedScheduleState(saved) {
    if (!saved) return false;
    var targetWeek =
      saved.weekView === "following" && hasFollowingWeekData() ? "following" : "primary";
    if (scheduleState.weekView !== targetWeek) {
      scheduleState.weekView = targetWeek;
      renderSchedule();
    }
    var days = daysForActiveView();
    if (!days.length) return false;
    var index = resolveSavedScheduleIndex(saved, days);
    if (index < 0) index = defaultActiveIndex(days);
    setActiveIndex(index, { scrollTab: true, scrollPanel: false, skipSave: true });
    return true;
  }

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function parseScheduleLabel(label, refYear) {
    var m = String(label || "").match(/^(\d{1,2})\/(\d{1,2})\(([일월화수목금토])\)$/);
    if (!m) return null;
    var month = parseInt(m[1], 10);
    var day = parseInt(m[2], 10);
    var year = refYear != null ? refYear : getScheduleToday().getFullYear();
    return {
      label: label,
      weekday: m[3],
      date: new Date(year, month - 1, day)
    };
  }

  function parseAnchorIso(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return stripTime(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  function getScheduleToday() {
    if (scheduleAnchorToday) return scheduleAnchorToday;
    return stripTime(new Date());
  }

  function inferScheduleDates(schedule, refDate) {
    var ref = stripTime(refDate || getScheduleToday());
    var refYear = ref.getFullYear();

    return schedule.map(function (day) {
      var parsed = parseScheduleLabel(day.label, refYear);
      if (!parsed) {
        return Object.assign({}, day, { date: null });
      }
      var date = parsed.date;
      var diffDays = Math.round((date.getTime() - ref.getTime()) / 86400000);
      if (diffDays > 200) {
        date = parseScheduleLabel(day.label, refYear - 1).date;
      } else if (diffDays < -200) {
        date = parseScheduleLabel(day.label, refYear + 1).date;
      }
      return Object.assign({}, day, { date: stripTime(date) });
    });
  }

  function getCinemaWeekStart(date) {
    var d = stripTime(date);
    var daysSinceThursday = (d.getDay() + 3) % 7;
    return addDays(d, -daysSinceThursday);
  }

  function getCinemaWeekEnd(weekStart) {
    return addDays(weekStart, 6);
  }

  function compareDates(a, b) {
    return stripTime(a).getTime() - stripTime(b).getTime();
  }

  function isInRange(date, start, end) {
    if (!date) return false;
    var t = stripTime(date).getTime();
    return t >= stripTime(start).getTime() && t <= stripTime(end).getTime();
  }

  function getPrimaryWeekRange() {
    var today = getScheduleToday();
    var start = getCinemaWeekStart(today);
    return { start: start, end: getCinemaWeekEnd(start) };
  }

  function getFollowingWeekRange() {
    var primary = getPrimaryWeekRange();
    var start = addDays(primary.end, 1);
    return { start: start, end: getCinemaWeekEnd(start) };
  }

  function getActiveWeekRange() {
    if (scheduleState.weekView === "following") {
      return getFollowingWeekRange();
    }
    return getPrimaryWeekRange();
  }

  function hasFollowingWeekData() {
    var following = getFollowingWeekRange();
    return enrichedDays.some(function (day) {
      return day.date && isInRange(day.date, following.start, following.end);
    });
  }

  function daysForActiveView() {
    var range = getActiveWeekRange();
    return enrichedDays.filter(function (day) {
      return day.date && isInRange(day.date, range.start, range.end);
    });
  }

  function defaultActiveIndex(days) {
    var today = getScheduleToday();
    var idx = days.findIndex(function (day) {
      return day.date && day.date.getTime() === today.getTime();
    });
    return idx >= 0 ? idx : 0;
  }

  function resolvePosterSrc(posterUrl) {
    var fallback = asset("images/schedule-poster-placeholder.svg");
    if (!posterUrl) return fallback;
    if (/^https?:\/\//i.test(posterUrl) || posterUrl.indexOf("data:") === 0) {
      return posterUrl;
    }
    if (posterUrl.charAt(0) === "/") {
      return posterUrl;
    }
    return asset(String(posterUrl).replace(/^\//, ""));
  }

  function posterForTitle(title) {
    var posters = getMoviePosterMap();
    return resolvePosterSrc(
      posters[title] || getDefaultSchedulePoster() || "images/schedule-poster-placeholder.svg"
    );
  }

  function isPlaceholderPoster(posterUrl) {
    if (!posterUrl) return true;
    return posterUrl.indexOf("schedule-poster-placeholder") !== -1;
  }

  function setActiveIndex(index, options) {
    var days = daysForActiveView();
    if (!days.length) return;
    var nextIndex = Math.max(0, Math.min(index, days.length - 1));
    scheduleState.activeIndex = nextIndex;

    if (!scheduleDom.dayTabs || !scheduleDom.panelsWrap) return;

    var tabs = scheduleDom.dayTabs.querySelectorAll(".ti-day-tab");
    var panels = scheduleDom.panelsWrap.querySelectorAll(".ti-panel");

    tabs.forEach(function (tab, i) {
      var selected = i === nextIndex;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      if (selected && options && options.scrollTab) {
        tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    });

    if (isMobileSwipeMode()) {
      panels.forEach(function (panel, i) {
        panel.classList.toggle("is-active", i === nextIndex);
        panel.hidden = false;
      });
      var panel = panels[nextIndex];
      if (panel && options && options.scrollPanel) {
        panel.scrollIntoView({ behavior: options.instant ? "auto" : "smooth", inline: "start", block: "nearest" });
      }
    } else {
      panels.forEach(function (panel, i) {
        var active = i === nextIndex;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    }

    if (!options || !options.skipSave) {
      saveScheduleState();
    }
  }

  function bindSchedulePreserveOnNavigate(link) {
    if (!link || link.dataset.schedulePreserveBound === "1") return;
    link.dataset.schedulePreserveBound = "1";
    link.addEventListener("click", saveScheduleState);
  }

  function isMobileSwipeMode() {
    return MOBILE_MQ.matches;
  }

  function updateSwipeLayout() {
    if (!scheduleDom.panelsWrap) return;
    scheduleDom.panelsWrap.classList.toggle("ti-sched-scroll--swipe", isMobileSwipeMode());
    setActiveIndex(scheduleState.activeIndex, { scrollPanel: false });
  }

  function setWeekView(view, preferredIndex) {
    weekTransitionLock = true;
    scheduleState.weekView = view;
    renderSchedule();
    if (scheduleDom.panelsWrap) {
      scheduleDom.panelsWrap.scrollLeft = 0;
    }
    var days = daysForActiveView();
    var index =
      typeof preferredIndex === "number"
        ? preferredIndex
        : view === "primary"
          ? defaultActiveIndex(days)
          : 0;
    setActiveIndex(index, { scrollTab: true, scrollPanel: true, instant: true });
    window.requestAnimationFrame(function () {
      weekTransitionLock = false;
    });
  }

  function bindScrollSync() {
    if (!scheduleDom.panelsWrap || scrollSyncBound) return;
    scrollSyncBound = true;

    scheduleDom.panelsWrap.addEventListener(
      "scroll",
      function () {
        if (!isMobileSwipeMode() || weekTransitionLock) return;
        var panels = scheduleDom.panelsWrap.querySelectorAll(".ti-panel");
        if (!panels.length) return;

        var wrapRect = scheduleDom.panelsWrap.getBoundingClientRect();
        var wrapCenter = wrapRect.left + wrapRect.width / 2;
        var nearest = 0;
        var nearestDist = Infinity;

        panels.forEach(function (panel, i) {
          var rect = panel.getBoundingClientRect();
          var center = rect.left + rect.width / 2;
          var dist = Math.abs(center - wrapCenter);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = i;
          }
        });

        if (nearest !== scheduleState.activeIndex) {
          scheduleState.activeIndex = nearest;
          scheduleDom.dayTabs.querySelectorAll(".ti-day-tab").forEach(function (tab, i) {
            tab.setAttribute("aria-selected", i === nearest ? "true" : "false");
            if (i === nearest) {
              tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            }
          });
          panels.forEach(function (panel, i) {
            panel.classList.toggle("is-active", i === nearest);
          });
          saveScheduleState();
        }
      },
      { passive: true }
    );
  }

  function createWeekNavButton(label, action) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ti-week-nav-btn";
    btn.textContent = label;
    btn.addEventListener("click", function () {
      if (action === "following") {
        setWeekView("following", 0);
        return;
      }
      var primaryDays = enrichedDays.filter(function (day) {
        var range = getPrimaryWeekRange();
        return day.date && isInRange(day.date, range.start, range.end);
      });
      setWeekView("primary", Math.max(0, primaryDays.length - 1));
    });
    return btn;
  }

  function buildRow(entry, entryIndex) {
    var normalize = getNormalizeEntry();
    if (!normalize) return document.createElement("div");
    var scheduleEntry = normalize(entry);
    var poster = posterForTitle(scheduleEntry.title);
    var posters = getMoviePosterMap();
    var hasPoster = Boolean(
      posters[scheduleEntry.title] || posters[entry.title]
    );
    var detailForTitle = getMovieDetailUrlForTitle();
    var detailForPoster = getMovieDetailUrlForPoster();
    var detailUrl = resolveMovieDetailUrl(
      (detailForTitle && detailForTitle(scheduleEntry.title)) ||
        (detailForPoster && detailForPoster(poster)) ||
        ""
    );

    var row = document.createElement("div");
    row.className = "ti-row";

    var slot = document.createElement("span");
    slot.className = "ti-slot";
    slot.setAttribute("aria-label", entryIndex + 1 + "회차");
    slot.textContent = String(entryIndex + 1);

    var img = document.createElement("img");
    img.className = "ti-poster" + (!hasPoster || isPlaceholderPoster(poster) ? " ti-poster--placeholder" : "");
    img.src = poster;
    img.alt = scheduleEntry.title + (hasPoster ? " 포스터" : " (상영작 정보 없음)");
    img.width = 40;
    img.height = 40;
    img.loading = "lazy";
    img.decoding = "async";

    var titleWrap = document.createElement("span");
    titleWrap.className = "ti-title";
    var titleMain = document.createElement("span");
    titleMain.className = "ti-title-main";
    var titleText = document.createElement("span");
    titleText.className = "ti-title-text";
    if (detailUrl) {
      var la = document.createElement("a");
      la.href = detailUrl;
      la.textContent = scheduleEntry.title;
      bindSchedulePreserveOnNavigate(la);
      titleText.appendChild(la);
    } else {
      titleText.textContent = scheduleEntry.title;
    }
    titleMain.appendChild(titleText);
    if (scheduleEntry.badges.length) {
      var badgesWrap = document.createElement("span");
      badgesWrap.className = "ti-badges";
      scheduleEntry.badges.forEach(function (badgeInfo) {
        var badge = document.createElement("span");
        badge.className = "ti-badge" + (badgeInfo.tiClass ? " " + badgeInfo.tiClass : "");
        badge.textContent = badgeInfo.label;
        badgesWrap.appendChild(badge);
      });
      titleMain.appendChild(badgesWrap);
    }
    titleWrap.appendChild(titleMain);

    var timeEl = document.createElement("span");
    timeEl.className = "ti-time";
    timeEl.textContent = scheduleEntry.time;

    var book = document.createElement("a");
    book.className = "ti-book";
    book.href = BOOK_URL;
    book.target = "_blank";
    book.rel = "noopener noreferrer";
    book.setAttribute("aria-label", scheduleEntry.title + " " + scheduleEntry.time + " 예매하기");
    book.textContent = "예매";

    var posterWrap = detailUrl ? document.createElement("a") : document.createElement("span");
    if (detailUrl) {
      posterWrap.href = detailUrl;
      bindSchedulePreserveOnNavigate(posterWrap);
    }
    posterWrap.appendChild(img);

    row.appendChild(slot);
    row.appendChild(posterWrap);
    row.appendChild(titleWrap);
    row.appendChild(timeEl);
    row.appendChild(book);
    return row;
  }

  function renderSchedule() {
    var dayTabs = scheduleDom.dayTabs;
    var panelsWrap = scheduleDom.panelsWrap;
    if (!dayTabs || !panelsWrap) return;

    var days = daysForActiveView();
    dayTabs.innerHTML = "";
    panelsWrap.innerHTML = "";

    if (!days.length) {
      var empty = document.createElement("p");
      empty.className = "ti-sched-empty";
      empty.textContent = "표시할 시간표가 없습니다.";
      panelsWrap.appendChild(empty);
      return;
    }

    var showFollowingNav =
      scheduleState.weekView === "primary" && hasFollowingWeekData();
    var showPrimaryNav = scheduleState.weekView === "following";

    days.forEach(function (day, i) {
      var globalIndex = enrichedDays.indexOf(day);

      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "ti-day-tab";
      tab.setAttribute("role", "tab");
      tab.id = "ti-tab-day-" + globalIndex;
      tab.setAttribute("aria-controls", "ti-panel-day-" + globalIndex);
      tab.textContent = day.label;
      tab.setAttribute("aria-selected", i === scheduleState.activeIndex ? "true" : "false");
      tab.addEventListener("click", function () {
        setActiveIndex(i, { scrollTab: true, scrollPanel: true });
      });
      dayTabs.appendChild(tab);

      if (i === days.length - 1) {
        if (showFollowingNav) {
          dayTabs.appendChild(createWeekNavButton("→ 다음주", "following"));
        } else if (showPrimaryNav) {
          dayTabs.appendChild(createWeekNavButton("← 이번주", "primary"));
        }
      }

      var panel = document.createElement("div");
      panel.className = "ti-panel" + (i === scheduleState.activeIndex ? " is-active" : "");
      panel.id = "ti-panel-day-" + globalIndex;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", "ti-tab-day-" + globalIndex);
      panel.hidden = !isMobileSwipeMode() && i !== scheduleState.activeIndex;

      day.entries.forEach(function (entry, entryIndex) {
        panel.appendChild(buildRow(entry, entryIndex));
      });

      panelsWrap.appendChild(panel);
    });

    if (scheduleDom.schedTitle) {
      scheduleDom.schedTitle.textContent =
        scheduleState.weekView === "following" ? "다음주 시간표" : "이번주 시간표";
    }

    updateSwipeLayout();
  }

  function canInitSchedule() {
    var schedule = getWeekScheduleRef();
    return Boolean(schedule && schedule.length && getNormalizeEntry());
  }

  function loadWeekScheduleFromApi() {
    if (scheduleFetchStarted) {
      return Promise.resolve();
    }
    scheduleFetchStarted = true;
    var api = window.TiApi;
    if (!api || typeof api.getWeekSchedule !== "function") {
      scheduleFetchStarted = false;
      return Promise.reject(new Error("TiApi 클라이언트가 로드되지 않았습니다."));
    }
    return api.getWeekSchedule().then(function (payload) {
      if (payload && payload.anchor) {
        scheduleAnchorToday = parseAnchorIso(payload.anchor);
      }
      if (typeof window.applyWeekScheduleApiPayload === "function") {
        window.applyWeekScheduleApiPayload(payload);
      }
    });
  }

  function bootstrapWeekSchedule() {
    if (scheduleBootstrapped || !canInitSchedule()) return;
    scheduleBootstrapped = true;
    initTiWeekSchedule();
  }

  function startWeekScheduleLoading() {
    if (canInitSchedule()) {
      bootstrapWeekSchedule();
      return;
    }
    loadWeekScheduleFromApi()
      .then(function () {
        bootstrapWeekSchedule();
      })
      .catch(function (err) {
        scheduleFetchStarted = false;
        console.warn("[week-schedule] API 로드 실패:", err);
      });
  }

  function initTiWeekSchedule() {
    scheduleDom.dayTabs = document.getElementById("tiDayTabs");
    scheduleDom.panelsWrap = document.getElementById("tiSchedulePanels");
    scheduleDom.schedTitle = document.querySelector(".ti-sched-title");
    if (!scheduleDom.dayTabs || !scheduleDom.panelsWrap) return;
    if (!canInitSchedule()) return;
    if (scheduleDom.dayTabs.dataset.scheduleReady === "1") return;

    scheduleDom.dayTabs.dataset.scheduleReady = "1";
    enrichedDays = inferScheduleDates(getWeekScheduleRef(), getScheduleToday());
    enrichedDays.sort(function (a, b) {
      if (!a.date || !b.date) return 0;
      return compareDates(a.date, b.date);
    });

    var saved = getSavedScheduleState();
    if (saved && saved.dayLabel) {
      scheduleState.weekView =
        saved.weekView === "following" && hasFollowingWeekData() ? "following" : "primary";
      var savedDays = daysForActiveView();
      var savedIndex = resolveSavedScheduleIndex(saved, savedDays);
      scheduleState.activeIndex = savedIndex >= 0 ? savedIndex : defaultActiveIndex(savedDays);
    } else {
      scheduleState.weekView = "primary";
      scheduleState.activeIndex = defaultActiveIndex(daysForActiveView());
    }

    renderSchedule();
    setActiveIndex(scheduleState.activeIndex, { scrollTab: true, scrollPanel: false, skipSave: true });
    saveScheduleState();

    bindScrollSync();

    if (typeof MOBILE_MQ.addEventListener === "function") {
      MOBILE_MQ.addEventListener("change", updateSwipeLayout);
    } else if (typeof MOBILE_MQ.addListener === "function") {
      MOBILE_MQ.addListener(updateSwipeLayout);
    }
  }

  function restoreScheduleOnPageShow() {
    if (!scheduleDom.dayTabs || scheduleDom.dayTabs.dataset.scheduleReady !== "1") return;
    var saved = getSavedScheduleState();
    if (saved) applySavedScheduleState(saved);
  }

  window.addEventListener("pageshow", restoreScheduleOnPageShow);
  window.addEventListener("ti-week-schedule:data-ready", bootstrapWeekSchedule);
  window.addEventListener("ti-left-gnb:loaded", startWeekScheduleLoading);
  window.addEventListener("load", startWeekScheduleLoading);
  startWeekScheduleLoading();
  if (document.readyState === "complete") {
    window.requestAnimationFrame(startWeekScheduleLoading);
  }
})();

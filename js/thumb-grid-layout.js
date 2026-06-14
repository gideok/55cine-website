/**
 * 썸네일 그리드 행 수·캐러셀 슬라이드 — 기획전·행사·매거진 공통
 * 가용 뷰포트 높이에 비례해 행 수를 조정한다.
 */
(function (global) {
  var REF_VIEWPORT_HEIGHT = 680;
  var REF_ROWS_DESKTOP = 2;
  var MOBILE_ROWS = 2;
  var DEFAULT_MAX_ROWS = 4;

  function measureSlotHeight(options) {
    options = options || {};
    var viewportEl = options.viewportEl;
    if (!viewportEl) return 0;

    var direct = viewportEl.clientHeight;
    if (direct >= 80) return direct;

    var hostEl =
      options.hostEl ||
      viewportEl.closest(".se-right-inner") ||
      viewportEl.closest(".preview-page") ||
      viewportEl.parentElement;
    if (!hostEl) return Math.max(direct, 240);

    var viewTop = viewportEl.getBoundingClientRect().top;
    var hostBottom = hostEl.getBoundingClientRect().bottom;
    var available = hostBottom - viewTop;
    var windowLimit =
      (global.innerHeight || document.documentElement.clientHeight || 0) - viewTop - 16;
    if (windowLimit > 120) {
      available = Math.min(available, windowLimit);
    }

    var footerSel =
      options.footerSelector ||
      ".page-pager--bottom, .se-foot, .pager-foot--mobile-only";
    var footers = hostEl.querySelectorAll(footerSel);
    for (var i = 0; i < footers.length; i++) {
      var foot = footers[i];
      if (foot.hasAttribute("hidden")) continue;
      var style = global.getComputedStyle(foot);
      if (style.display === "none" || style.visibility === "hidden") continue;
      var rect = foot.getBoundingClientRect();
      if (rect.top >= viewTop - 1) {
        available -= rect.height;
        available -= parseFloat(style.marginTop) || 0;
        available -= parseFloat(style.marginBottom) || 0;
      }
    }

    var stack = viewportEl.closest(".mz-thumb-stack");
    if (stack) {
      var hint = stack.querySelector(".se-hint");
      if (hint && !hint.hidden) {
        var hintStyle = global.getComputedStyle(hint);
        if (hintStyle.display !== "none") {
          var hintRect = hint.getBoundingClientRect();
          if (hintRect.bottom <= viewTop + 2) {
            available -= hintRect.height;
            available -= parseFloat(hintStyle.marginBottom) || 0;
          }
        }
      }
    }

    return Math.max(120, available);
  }

  function computeRows(options) {
    options = options || {};
    var maxRows =
      options.maxRows != null
        ? options.maxRows
        : options.isMobile
          ? DEFAULT_MAX_ROWS
          : DEFAULT_MAX_ROWS;
    var cols = Math.max(1, options.cols || 1);
    var h = options.viewportHeight || 0;
    var w = options.viewportWidth || 0;

    if (options.useCellFit && w >= 40 && h >= 40) {
      var gapCol = options.gapCol || 0;
      var gapRow = options.gapRow || 0;
      var aspect = options.aspectRatio != null ? options.aspectRatio : 740 / 510;
      var titleReserve = options.titleReserve != null ? options.titleReserve : 56;
      var cellW = (w - gapCol * Math.max(0, cols - 1)) / cols;
      var rowH = cellW * aspect + titleReserve;
      if (rowH > 0) {
        var fitRows = Math.floor((h + gapRow) / (rowH + gapRow));
        return Math.max(1, Math.min(maxRows, fitRows));
      }
    }

    if (options.isMobile && !options.useCellFit) {
      return options.mobileRows != null ? options.mobileRows : MOBILE_ROWS;
    }

    var refH =
      options.refViewportHeight != null ? options.refViewportHeight : REF_VIEWPORT_HEIGHT;
    var refRows = options.refRows != null ? options.refRows : REF_ROWS_DESKTOP;
    if (h < 40) return refRows;

    var scaled = Math.round(refRows * (h / refH));
    return Math.max(1, Math.min(maxRows, scaled));
  }

  function computeItemsPerPage(options) {
    options = options || {};
    var cols = Math.max(1, options.cols || 1);
    if (!options.viewportHeight && options.viewportEl) {
      options.viewportHeight = measureSlotHeight({
        viewportEl: options.viewportEl,
        hostEl: options.hostEl,
        footerSelector: options.footerSelector
      });
    }
    if (!options.viewportWidth && options.viewportEl) {
      options.viewportWidth = options.viewportEl.clientWidth;
    }
    return cols * computeRows(options);
  }

  function syncSlideWidths(viewportEl, trackEl) {
    if (!viewportEl || !trackEl) return;
    var w = viewportEl.clientWidth;
    if (w <= 0) return;
    var slides = trackEl.querySelectorAll(".se-slide");
    for (var i = 0; i < slides.length; i++) {
      var slide = slides[i];
      slide.style.flex = "0 0 " + w + "px";
      slide.style.width = w + "px";
      slide.style.maxWidth = w + "px";
      slide.style.minWidth = w + "px";
    }
    trackEl.style.width = slides.length * w + "px";
  }

  global.TiThumbGridLayout = {
    REF_VIEWPORT_HEIGHT: REF_VIEWPORT_HEIGHT,
    REF_ROWS_DESKTOP: REF_ROWS_DESKTOP,
    MOBILE_ROWS: MOBILE_ROWS,
    measureSlotHeight: measureSlotHeight,
    computeRows: computeRows,
    computeItemsPerPage: computeItemsPerPage,
    syncSlideWidths: syncSlideWidths
  };
})(typeof window !== "undefined" ? window : globalThis);

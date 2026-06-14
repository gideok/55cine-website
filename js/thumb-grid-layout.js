/**
 * 썸네일 그리드 행 수 — 1920×1080 기준 반응형 (기획전·매거진 공통)
 * viewport 높이에 비례해 행 수를 조정하고, maxRows 로 과다 행(지난기사 등)을 제한한다.
 */
(function (global) {
  /** 1920×1080 에서 썸네일 뷰포트(헤더·툴바·페이지네이션 제외) 기준 높이 */
  var REF_VIEWPORT_HEIGHT = 680;
  var REF_ROWS_DESKTOP = 2;
  var MOBILE_ROWS = 2;
  var DEFAULT_MAX_ROWS_DESKTOP = 2;

  function computeRows(options) {
    options = options || {};
    if (options.isMobile) {
      return options.mobileRows != null ? options.mobileRows : MOBILE_ROWS;
    }

    var refH = options.refViewportHeight != null ? options.refViewportHeight : REF_VIEWPORT_HEIGHT;
    var refRows = options.refRows != null ? options.refRows : REF_ROWS_DESKTOP;
    var maxRows =
      options.maxRows != null ? options.maxRows : DEFAULT_MAX_ROWS_DESKTOP;
    var h = options.viewportHeight || 0;

    if (h < 40) return refRows;

    var scaled = Math.round(refRows * (h / refH));
    return Math.max(1, Math.min(maxRows, scaled));
  }

  function computeItemsPerPage(options) {
    options = options || {};
    var cols = Math.max(1, options.cols || 1);
    var rows = computeRows(options);
    return cols * rows;
  }

  global.TiThumbGridLayout = {
    REF_VIEWPORT_HEIGHT: REF_VIEWPORT_HEIGHT,
    REF_ROWS_DESKTOP: REF_ROWS_DESKTOP,
    MOBILE_ROWS: MOBILE_ROWS,
    computeRows: computeRows,
    computeItemsPerPage: computeItemsPerPage
  };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * 캐러셀 하단 se-page-dots — 최대 10개 페이지 점, 초과 시 줄임표(…)
 */
(function (global) {
  "use strict";

  var MAX_DOTS = 10;

  function buildDotSlots(total, activeIndex) {
    if (total <= MAX_DOTS) {
      var all = [];
      for (var i = 0; i < total; i++) all.push({ type: "page", index: i });
      return all;
    }

    var picked = new Set();
    picked.add(0);
    picked.add(total - 1);
    picked.add(activeIndex);

    var left = activeIndex - 1;
    var right = activeIndex + 1;
    while (picked.size < MAX_DOTS && (left >= 0 || right < total)) {
      if (left >= 0) picked.add(left--);
      if (picked.size >= MAX_DOTS) break;
      if (right < total) picked.add(right++);
    }

    var sorted = Array.from(picked).sort(function (a, b) {
      return a - b;
    });

    var slots = [];
    for (var j = 0; j < sorted.length; j++) {
      if (j > 0 && sorted[j] - sorted[j - 1] > 1) {
        slots.push({ type: "ellipsis" });
      }
      slots.push({ type: "page", index: sorted[j] });
    }
    return slots;
  }

  /**
   * @param {HTMLElement|null} container
   * @param {{ total: number, activeIndex: number, onSelect: function(number), labelPrefix?: string }} options
   */
  function render(container, options) {
    if (!container) return;

    var total = Math.max(0, options.total || 0);
    var activeIndex = Math.max(0, Math.min(total - 1, options.activeIndex || 0));
    var onSelect = options.onSelect || function () {};
    var labelPrefix = options.labelPrefix || "페이지 ";

    container.innerHTML = "";
    if (total <= 0) return;

    buildDotSlots(total, activeIndex).forEach(function (slot) {
      if (slot.type === "ellipsis") {
        var ell = document.createElement("span");
        ell.className = "se-dot-ellipsis";
        ell.setAttribute("aria-hidden", "true");
        ell.textContent = "…";
        container.appendChild(ell);
        return;
      }

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "se-dot" + (slot.index === activeIndex ? " is-active" : "");
      btn.setAttribute("aria-label", labelPrefix + (slot.index + 1));
      btn.addEventListener("click", function () {
        onSelect(slot.index);
      });
      container.appendChild(btn);
    });
  }

  global.TiCarouselDots = {
    MAX_DOTS: MAX_DOTS,
    render: render
  };
})(window);

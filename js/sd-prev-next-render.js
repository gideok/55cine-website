/**

 * 상세 하단 — 이전·다음(텍스트) + 목록으로

 * window.TiSdPrevNext.render({ listUrl, neighbors, hrefFor, titleFor, ... })

 */

(function () {

  function createChevron(variant) {
    var chevron = document.createElement("span");
    chevron.className =
      "sd-pn-chevron sd-pn-chevron--" + (variant === "lead" ? "lead" : "trail");
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = variant === "lead" ? "\u2039" : "\u203A";
    return chevron;
  }

  function buildCol(dir, item, options) {
    var col = document.createElement("div");
    col.className = "sd-pn-col sd-pn-col--" + dir;

    var inner;
    if (!item) {
      inner = document.createElement("div");
      inner.className = "sd-pn-empty";
    } else {
      inner = document.createElement("a");
      inner.className = "sd-pn-link";
      inner.href = options.hrefFor(item);
      inner.setAttribute(
        "aria-label",
        (dir === "prev" ? "이전: " : "다음: ") + options.titleFor(item)
      );
    }

    if (dir === "prev") {
      inner.appendChild(createChevron("lead"));
    }

    var label = document.createElement("span");
    label.className = "sd-pn-dir";
    label.textContent = dir === "prev" ? "이전" : "다음";
    inner.appendChild(label);

    if (item) {
      var title = document.createElement("span");
      title.className = "sd-pn-item-title";
      title.textContent = options.titleFor(item);
      inner.appendChild(title);
    } else {
      var note = document.createElement("span");
      note.className = "sd-pn-empty-note";
      note.textContent =
        dir === "prev" ? "이전글이 없습니다." : "다음글이 없습니다.";
      inner.appendChild(note);
    }

    inner.appendChild(createChevron("trail"));
    col.appendChild(inner);
    return col;
  }



  function mountPanelNav(nav, contextEl) {

    var page = contextEl && contextEl.closest ? contextEl.closest(".md-page") : null;

    if (!page) {

      if (contextEl) contextEl.appendChild(nav);

      return nav;

    }

    var existing = page.querySelector(".sd-nav--panel");

    if (existing) existing.remove();

    page.appendChild(nav);

    return nav;

  }



  window.TiSdPrevNext = {

    mountPanelNav: mountPanelNav,



    render: function (options) {

      options = options || {};

      var neighbors = options.neighbors || { prev: null, next: null };



      var wrap = document.createElement("div");

      wrap.className = options.wrapClass || "sd-inner";



      var nav = document.createElement("nav");

      nav.className = "sd-nav";

      if (options.panelNav) {

        nav.classList.add("sd-nav--panel");

      }

      nav.setAttribute("aria-label", options.navLabel || "이전·다음");



      var cols = document.createElement("div");

      cols.className = "sd-pn-cols";

      cols.setAttribute("aria-label", options.colsLabel || "이전·다음");



      cols.appendChild(buildCol("prev", neighbors.prev, options));

      cols.appendChild(buildCol("next", neighbors.next, options));

      nav.appendChild(cols);



      var back = document.createElement("a");

      back.className = "sd-back sd-back--list";

      back.href = options.listUrl || "#";

      back.textContent = options.listText || "목록으로";

      if (options.listAriaLabel) {

        back.setAttribute("aria-label", options.listAriaLabel);

      }

      nav.appendChild(back);



      if (options.returnNavOnly) {

        if (options.panelNav && options.mountContextEl) {

          mountPanelNav(nav, options.mountContextEl);

        }

        return nav;

      }



      wrap.appendChild(nav);

      return wrap;

    }

  };

})();



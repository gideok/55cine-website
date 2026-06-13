/**
 * 상세 하단 — 이전·다음(텍스트) + 목록으로
 * window.TiSdPrevNext.render({ listUrl, neighbors, hrefFor, titleFor, ... })
 */
(function () {
  function buildCol(dir, item, options) {
    var col = document.createElement("div");
    col.className = "sd-pn-col sd-pn-col--" + dir;

    if (!item) {
      var empty = document.createElement("div");
      empty.className = "sd-pn-empty";

      var emptyLabel = document.createElement("span");
      emptyLabel.className = "sd-pn-dir";
      emptyLabel.textContent = dir === "prev" ? "이전" : "다음";
      empty.appendChild(emptyLabel);

      var note = document.createElement("span");
      note.className = "sd-pn-empty-note";
      note.textContent = dir === "prev" ? "이전글이 없습니다." : "다음글이 없습니다.";
      empty.appendChild(note);

      col.appendChild(empty);
      return col;
    }

    var link = document.createElement("a");
    link.className = "sd-pn-link";
    link.href = options.hrefFor(item);
    link.setAttribute(
      "aria-label",
      (dir === "prev" ? "이전: " : "다음: ") + options.titleFor(item)
    );

    var label = document.createElement("span");
    label.className = "sd-pn-dir";
    label.textContent = dir === "prev" ? "이전" : "다음";
    link.appendChild(label);

    var title = document.createElement("span");
    title.className = "sd-pn-item-title";
    title.textContent = options.titleFor(item);
    link.appendChild(title);

    col.appendChild(link);
    return col;
  }

  window.TiSdPrevNext = {
    render: function (options) {
      options = options || {};
      var neighbors = options.neighbors || { prev: null, next: null };

      var wrap = document.createElement("div");
      wrap.className = options.wrapClass || "sd-inner";

      var nav = document.createElement("nav");
      nav.className = "sd-nav";
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
        return nav;
      }

      wrap.appendChild(nav);
      return wrap;
    }
  };
})();

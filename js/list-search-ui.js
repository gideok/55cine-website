/**
 * 목록 검색 UI — 지난 상영작(np-search) 패턴 공용
 */
(function (global) {
  var SEARCH_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.75"/>' +
    '<path d="M16 16L20.5 20.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="square"/>' +
    "</svg>";

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function getFieldText(item, field) {
    if (!item) return "";
    if (typeof field === "function") return field(item);
    return item[field];
  }

  function matchesItem(item, query, fields) {
    if (!query) return true;
    fields = fields || ["title"];
    return fields.some(function (field) {
      return normalizeText(getFieldText(item, field)).indexOf(query) !== -1;
    });
  }

  function createSearchIcon(className, size) {
    var icon = document.createElement("span");
    icon.className = className || "np-search-icon";
    icon.setAttribute("aria-hidden", "true");
    var svg = SEARCH_SVG;
    if (size === 18) {
      svg = svg.replace('width="16" height="16"', 'width="18" height="18"');
    }
    icon.innerHTML = svg;
    return icon;
  }

  function ensurePanelStructure(wrap) {
    if (!wrap) return null;
    var toggle = wrap.querySelector(".np-search-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "np-search-toggle";
      toggle.id = wrap.id ? wrap.id + "Toggle" : "npSearchToggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", wrap.id ? wrap.id + "Panel" : "npSearchPanel");
      toggle.setAttribute("aria-label", "검색 열기");
      toggle.appendChild(createSearchIcon("np-search-toggle__icon", 18));
      wrap.insertBefore(toggle, wrap.firstChild);
    }

    var panel = wrap.querySelector(".np-search-panel");
    var field = wrap.querySelector(".np-search-field");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "np-search-panel";
      panel.id = wrap.id ? wrap.id + "Panel" : "npSearchPanel";
      if (field) {
        wrap.insertBefore(panel, field);
        panel.appendChild(field);
      } else {
        wrap.appendChild(panel);
      }
    } else if (field && field.parentElement !== panel) {
      panel.appendChild(field);
    }
    return panel;
  }

  function closeMobileSearch(wrap, toggle) {
    if (!wrap) return;
    wrap.classList.remove("is-open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "검색 열기");
    }
  }

  /**
   * @param {object} options
   * @param {HTMLElement} [options.mountEl] — .np-search 컨테이너 (없으면 생성)
   * @param {HTMLElement} [options.insertBeforeEl] — mountEl 생성 시 삽입 기준
   * @param {string} [options.wrapId]
   * @param {string} [options.inputId]
   * @param {string} [options.placeholder]
   * @param {number} [options.debounceMs]
   * @param {function(string):void} options.onQueryChange
   * @param {boolean} [options.closeOnDesktopResize]
   */
  function setup(options) {
    options = options || {};
    if (options.enabled === false) return null;

    var wrap = options.mountEl;
    if (!wrap && options.wrapId) {
      wrap = document.getElementById(options.wrapId);
    }
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "np-search";
      if (options.wrapId) wrap.id = options.wrapId;
      if (options.insertBeforeEl && options.insertBeforeEl.parentNode) {
        options.insertBeforeEl.parentNode.insertBefore(wrap, options.insertBeforeEl);
      } else if (options.insertIntoEl) {
        options.insertIntoEl.appendChild(wrap);
      }
    }

    var inputId = options.inputId || (wrap.id ? wrap.id + "Input" : "npSearchInput");
    var panel = wrap.querySelector(".np-search-panel");
    var input = wrap.querySelector(".np-search-input") || document.getElementById(inputId);
    if (!input) {
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "np-search-panel";
        panel.id = wrap.id ? wrap.id + "Panel" : "npSearchPanel";
        wrap.appendChild(panel);
      }
      var field = document.createElement("label");
      field.className = "np-search-field";
      field.htmlFor = inputId;
      field.appendChild(createSearchIcon("np-search-icon"));
      input = document.createElement("input");
      input.type = "search";
      input.id = inputId;
      input.className = "np-search-input";
      input.autocomplete = "off";
      field.appendChild(input);
      panel.appendChild(field);
    }

    var placeholder = options.placeholder || "제목 검색";
    input.placeholder = placeholder;
    input.setAttribute("aria-label", placeholder);

    ensurePanelStructure(wrap);
    var toggle = wrap.querySelector(".np-search-toggle");
    if (toggle && toggle.dataset.bound !== "1") {
      toggle.dataset.bound = "1";
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = !wrap.classList.contains("is-open");
        if (open) {
          wrap.classList.add("is-open");
          toggle.setAttribute("aria-expanded", "true");
          toggle.setAttribute("aria-label", "검색 닫기");
          window.requestAnimationFrame(function () {
            input.focus();
          });
        } else {
          closeMobileSearch(wrap, toggle);
        }
      });
    }

    if (!document.documentElement.dataset.tiListSearchDismissBound) {
      document.documentElement.dataset.tiListSearchDismissBound = "1";
      function dismissOpenSearches(target) {
        document.querySelectorAll(".np-search.is-open").forEach(function (openWrap) {
          if (openWrap.contains(target)) return;
          closeMobileSearch(openWrap, openWrap.querySelector(".np-search-toggle"));
        });
      }
      document.addEventListener("click", function (e) {
        dismissOpenSearches(e.target);
      });
      document.addEventListener(
        "touchstart",
        function (e) {
          if (!e.target) return;
          dismissOpenSearches(e.target);
        },
        { passive: true }
      );
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        document.querySelectorAll(".np-search.is-open").forEach(function (openWrap) {
          closeMobileSearch(openWrap, openWrap.querySelector(".np-search-toggle"));
        });
      });
    }

    var debounceMs =
      typeof options.debounceMs === "number" && options.debounceMs >= 0
        ? options.debounceMs
        : 350;
    var debounceTimer = null;

    function emitChange() {
      if (typeof options.onQueryChange === "function") {
        options.onQueryChange(input.value);
      }
    }

    function onInput() {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (debounceMs > 0) {
        debounceTimer = window.setTimeout(emitChange, debounceMs);
      } else {
        emitChange();
      }
    }

    if (input.dataset.bound !== "1") {
      input.dataset.bound = "1";
      input.addEventListener("input", onInput);
      input.addEventListener("search", onInput);
      input.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (debounceTimer) {
          window.clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        emitChange();
      });
    }

    if (options.closeOnDesktopResize !== false && global.matchMedia) {
      var desktopMq = global.matchMedia("(min-width: 900px)");
      var onDesktop = function () {
        if (desktopMq.matches) closeMobileSearch(wrap, toggle);
      };
      if (desktopMq.addEventListener) desktopMq.addEventListener("change", onDesktop);
      else if (desktopMq.addListener) desktopMq.addListener(onDesktop);
    }

    if (options.initialQuery) {
      input.value = options.initialQuery;
    }

    return {
      wrap: wrap,
      input: input,
      getQuery: function () {
        return input.value;
      },
      setQuery: function (value) {
        input.value = value || "";
      },
      closeMobile: function () {
        closeMobileSearch(wrap, toggle);
      }
    };
  }

  global.TiListSearch = {
    normalize: normalizeText,
    matches: matchesItem,
    setup: setup
  };
})(typeof window !== "undefined" ? window : globalThis);

/**
 * contenteditable HTML 에디터
 */
(function (global) {
  var FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];
  var PASTE_ALLOWED = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, SPAN: 1, BR: 1, HR: 1 };
  var NOTICE_LINK_CLASS = "site-notice-link";

  function normalizeLinkUrl(url) {
    var raw = String(url || "").trim();
    if (!raw) return "";
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
    return "https://" + raw;
  }

  function isSafeLinkHref(href) {
    var h = String(href || "").trim();
    if (!h) return false;
    if (/^\s*javascript:/i.test(h)) return false;
    if (/^\s*data:/i.test(h)) return false;
    if (/^\s*vbscript:/i.test(h)) return false;
    return true;
  }

  function unwrapElement(el) {
    var parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  function isPasteTagAllowed(tag) {
    if (PASTE_ALLOWED[tag]) return true;
    return !!(options.linkAsButton && tag === "A");
  }

  function createHtmlEditor(container, initialHtml, options) {
    options = options || {};
    var toolbar = document.createElement("div");
    toolbar.className = "admin-editor-toolbar";

    var body = document.createElement("div");
    body.className = "admin-editor-body";
    body.contentEditable = "true";
    body.innerHTML = initialHtml || "";

    var savedRange = null;

    function saveSelection() {
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!body.contains(sel.anchorNode)) return;
      savedRange = sel.getRangeAt(0).cloneRange();
    }

    function restoreSelection() {
      if (!savedRange) return;
      var sel = global.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }

    function holdSelectionOnMouseDown(btn) {
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
    }

    function exec(cmd, val) {
      body.focus();
      restoreSelection();
      document.execCommand(cmd, false, val || null);
      saveSelection();
    }

    function getSelectionFontSizePx() {
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return 16;
      var node = sel.anchorNode;
      if (!node) return 16;
      if (node.nodeType === 3) node = node.parentElement;
      if (!node || !body.contains(node)) return 16;
      var px = parseInt(global.getComputedStyle(node).fontSize, 10);
      return Number.isNaN(px) ? 16 : px;
    }

    function nearestFontSize(px) {
      var best = FONT_SIZES[0];
      var diff = Math.abs(px - best);
      FONT_SIZES.forEach(function (size) {
        var d = Math.abs(px - size);
        if (d < diff) {
          diff = d;
          best = size;
        }
      });
      return best;
    }

    function applyColor(color) {
      body.focus();
      restoreSelection();
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      if (range.collapsed) return;

      var fragment = range.extractContents();
      var span = document.createElement("span");
      span.style.color = color;
      span.appendChild(fragment);
      range.insertNode(span);

      var newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRange = newRange.cloneRange();
    }

    function applyLink(url) {
      var href = normalizeLinkUrl(url);
      if (!href || !isSafeLinkHref(href)) return;

      body.focus();
      restoreSelection();
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      if (range.collapsed) return;

      var fragment = range.extractContents();
      var anchor = document.createElement("a");
      anchor.href = href;
      anchor.className = NOTICE_LINK_CLASS;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.appendChild(fragment);
      range.insertNode(anchor);

      var newRange = document.createRange();
      newRange.selectNodeContents(anchor);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRange = newRange.cloneRange();
    }

    function changeFontSize(delta) {
      body.focus();
      restoreSelection();
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      if (range.collapsed) return;

      var current = nearestFontSize(getSelectionFontSizePx());
      var idx = FONT_SIZES.indexOf(current);
      if (idx < 0) idx = FONT_SIZES.indexOf(16);
      var next = FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta))];

      var fragment = range.extractContents();
      var span = document.createElement("span");
      span.style.fontSize = next + "px";
      span.appendChild(fragment);
      range.insertNode(span);

      var newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRange = newRange.cloneRange();
    }

    function stripFontStyles(style, keepColor) {
      if (!style) return "";
      return style
        .split(";")
        .map(function (p) {
          return p.trim();
        })
        .filter(function (p) {
          if (!p) return false;
          var prop = p.split(":")[0].trim().toLowerCase();
          if (prop === "font-size") return true;
          if (keepColor && prop === "color") return true;
          return (
            prop !== "font-family" &&
            prop !== "font" &&
            prop !== "line-height" &&
            prop !== "letter-spacing" &&
            prop !== "background" &&
            prop !== "background-color"
          );
        })
        .join("; ");
    }

    function sanitizePasteNode(node) {
      if (node.nodeType === 3) {
        return node.cloneNode(false);
      }
      if (node.nodeType !== 1) return null;

      var tag = node.tagName;
      if (tag === "FONT") {
        var colorAttr = node.getAttribute && node.getAttribute("color");
        var wrap = document.createDocumentFragment();
        Array.prototype.forEach.call(node.childNodes, function (ch) {
          var c = sanitizePasteNode(ch);
          if (c) wrap.appendChild(c);
        });
        if (options.keepColor && colorAttr) {
          var colorSpan = document.createElement("span");
          colorSpan.style.color = colorAttr;
          while (wrap.firstChild) colorSpan.appendChild(wrap.firstChild);
          return colorSpan;
        }
        return wrap;
      }

      if (!isPasteTagAllowed(tag)) {
        var frag = document.createDocumentFragment();
        Array.prototype.forEach.call(node.childNodes, function (ch) {
          var c = sanitizePasteNode(ch);
          if (c) frag.appendChild(c);
        });
        return frag;
      }

      var el = document.createElement(tag === "SPAN" ? "span" : tag.toLowerCase());
      if (tag === "A" && options.linkAsButton) {
        var pasteHref = normalizeLinkUrl(node.getAttribute("href"));
        if (!pasteHref || !isSafeLinkHref(pasteHref)) {
          var unwrapFrag = document.createDocumentFragment();
          Array.prototype.forEach.call(node.childNodes, function (ch) {
            var c = sanitizePasteNode(ch);
            if (c) unwrapFrag.appendChild(c);
          });
          return unwrapFrag;
        }
        el.href = pasteHref;
        el.className = NOTICE_LINK_CLASS;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      }
      if (tag === "SPAN" && node.style) {
        if (node.style.fontSize) el.style.fontSize = node.style.fontSize;
        if (options.keepColor && node.style.color) el.style.color = node.style.color;
      }
      Array.prototype.forEach.call(node.childNodes, function (ch) {
        var c = sanitizePasteNode(ch);
        if (c) el.appendChild(c);
      });
      return el;
    }

    function sanitizePasteHtml(html) {
      var box = document.createElement("div");
      box.innerHTML = html;
      var frag = document.createDocumentFragment();
      Array.prototype.forEach.call(box.childNodes, function (ch) {
        var c = sanitizePasteNode(ch);
        if (c) frag.appendChild(c);
      });
      var out = document.createElement("div");
      out.appendChild(frag);
      return out.innerHTML;
    }

    function unwrapEditorFigures(box) {
      var figures = box.querySelectorAll("figure[data-ti-editor-figure]");
      Array.prototype.forEach.call(figures, function (fig) {
        var img = fig.querySelector("img");
        if (img) {
          var clone = img.cloneNode(true);
          clone.removeAttribute("data-ti-asset-key");
          fig.parentNode.replaceChild(clone, fig);
        } else {
          fig.parentNode.removeChild(fig);
        }
      });
    }

    function sanitizeOutputHtml(html) {
      var box = document.createElement("div");
      box.innerHTML = html || "";
      unwrapEditorFigures(box);

      function walk(node) {
        if (node.nodeType !== 1) return;
        var el = node;
        if (el.tagName === "FONT") {
          var parent = el.parentNode;
          var color = options.keepColor ? el.getAttribute("color") : null;
          if (color) {
            var colorSpan = document.createElement("span");
            colorSpan.style.color = color;
            while (el.firstChild) colorSpan.appendChild(el.firstChild);
            parent.replaceChild(colorSpan, el);
            walk(colorSpan);
            return;
          }
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
          return;
        }
        if (el.tagName === "A" && options.linkAsButton) {
          var linkHref = normalizeLinkUrl(el.getAttribute("href"));
          if (!linkHref || !isSafeLinkHref(linkHref)) {
            unwrapElement(el);
            return;
          }
          el.href = linkHref;
          el.className = NOTICE_LINK_CLASS;
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
          el.removeAttribute("style");
          el.removeAttribute("face");
          el.removeAttribute("data-ke-size");
          el.removeAttribute("data-ti-asset-key");
          Array.prototype.slice.call(el.attributes).forEach(function (attr) {
            if (attr.name !== "href" && attr.name !== "class" && attr.name !== "target" && attr.name !== "rel") {
              el.removeAttribute(attr.name);
            }
          });
          var linkChildren = Array.prototype.slice.call(el.childNodes);
          linkChildren.forEach(walk);
          return;
        }
        el.removeAttribute("class");
        el.removeAttribute("face");
        el.removeAttribute("data-ke-size");
        el.removeAttribute("data-ti-asset-key");
        if (el.hasAttribute("style")) {
          var cleaned = stripFontStyles(el.getAttribute("style"), options.keepColor);
          if (cleaned) el.setAttribute("style", cleaned);
          else el.removeAttribute("style");
        }
        var children = Array.prototype.slice.call(el.childNodes);
        children.forEach(walk);
      }

      Array.prototype.slice.call(box.childNodes).forEach(walk);
      return box.innerHTML;
    }

    function rangeInBody(range) {
      if (!range) return false;
      return body.contains(range.startContainer) && body.contains(range.endContainer);
    }

    function insertHtmlAtCursor(html) {
      body.focus();
      restoreSelection();
      var sel = global.getSelection();
      var range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;

      if (!rangeInBody(range)) {
        body.insertAdjacentHTML("beforeend", html);
        saveSelection();
        return;
      }

      range.deleteContents();
      var tpl = document.createElement("template");
      tpl.innerHTML = html;
      var nodes = Array.prototype.slice.call(tpl.content.childNodes);
      var last = null;
      nodes.forEach(function (node) {
        range.insertNode(node);
        last = node;
      });
      if (last) {
        range.setStartAfter(last);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRange = range.cloneRange();
      }
      saveSelection();
    }

    function insertHtmlAtPoint(clientX, clientY, html) {
      body.focus();
      var range = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(clientX, clientY);
      } else if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(clientX, clientY);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }
      if (range && body.contains(range.startContainer)) {
        var sel = global.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
          savedRange = range.cloneRange();
        }
      }
      insertHtmlAtCursor(html);
    }

    var buttons = [
      { label: "굵게", cmd: "bold" },
      { label: "기울임", cmd: "italic" },
      { label: "밑줄", cmd: "underline" }
    ];

    if (!options.linkAsButton) {
      buttons.push({ label: "링크", cmd: "createLink", prompt: "URL" });
    }

    if (options.showLists !== false) {
      buttons.push(
        { label: "목록", cmd: "insertUnorderedList" },
        { label: "번호목록", cmd: "insertOrderedList" }
      );
    }

    buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      holdSelectionOnMouseDown(btn);
      btn.addEventListener("click", function () {
        if (b.prompt) {
          var url = global.prompt(b.prompt);
          if (url) exec(b.cmd, url);
        } else {
          exec(b.cmd);
        }
      });
      toolbar.appendChild(btn);
    });

    if (options.linkAsButton) {
      var urlBtn = document.createElement("button");
      urlBtn.type = "button";
      urlBtn.textContent = "URL";
      holdSelectionOnMouseDown(urlBtn);
      urlBtn.addEventListener("click", function () {
        var url = global.prompt("연결할 URL");
        if (url) applyLink(url);
      });
      toolbar.appendChild(urlBtn);
    }

    if (options.showFontSize !== false) {
      var smallBtn = document.createElement("button");
      smallBtn.type = "button";
      smallBtn.textContent = "작게";
      holdSelectionOnMouseDown(smallBtn);
      smallBtn.addEventListener("click", function () {
        changeFontSize(-1);
      });
      toolbar.appendChild(smallBtn);

      var largeBtn = document.createElement("button");
      largeBtn.type = "button";
      largeBtn.textContent = "크게";
      holdSelectionOnMouseDown(largeBtn);
      largeBtn.addEventListener("click", function () {
        changeFontSize(1);
      });
      toolbar.appendChild(largeBtn);
    }

    if (options.showDivider) {
      var hrBtn = document.createElement("button");
      hrBtn.type = "button";
      hrBtn.textContent = "구분선";
      holdSelectionOnMouseDown(hrBtn);
      hrBtn.addEventListener("click", function () {
        insertHtmlAtCursor("<hr>");
      });
      toolbar.appendChild(hrBtn);
    }

    if (options.showColor) {
      var colorWrap = document.createElement("label");
      colorWrap.className = "admin-editor-color";
      colorWrap.title = "글자색";
      var colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = "#111111";
      colorInput.addEventListener("mousedown", function (e) {
        e.stopPropagation();
      });
      colorInput.addEventListener("input", function () {
        applyColor(colorInput.value);
      });
      colorWrap.appendChild(colorInput);
      colorWrap.appendChild(document.createTextNode(" 색상"));
      toolbar.appendChild(colorWrap);
    }

    if (options.showImageUrl !== false) {
      var imgBtn = document.createElement("button");
      imgBtn.type = "button";
      imgBtn.textContent = "이미지 URL";
      holdSelectionOnMouseDown(imgBtn);
      imgBtn.addEventListener("click", function () {
        var url = global.prompt("이미지 URL");
        if (url) exec("insertImage", url);
      });
      toolbar.appendChild(imgBtn);
    }

    body.addEventListener("keyup", saveSelection);
    body.addEventListener("mouseup", saveSelection);
    body.addEventListener("focus", saveSelection);

    body.addEventListener("paste", function (e) {
      e.preventDefault();
      body.focus();
      restoreSelection();
      var html = e.clipboardData && e.clipboardData.getData("text/html");
      var text = e.clipboardData && e.clipboardData.getData("text/plain");
      if (html) {
        insertHtmlAtCursor(sanitizePasteHtml(html));
      } else if (text) {
        document.execCommand("insertText", false, text);
        saveSelection();
      }
    });

    container.appendChild(toolbar);
    container.appendChild(body);

    return {
      getHtml: function () {
        return sanitizeOutputHtml(body.innerHTML);
      },
      setHtml: function (html) {
        body.innerHTML = html || "";
      },
      getBodyEl: function () {
        return body;
      },
      saveSelection: saveSelection,
      restoreSelection: restoreSelection,
      insertHtmlAtCursor: insertHtmlAtCursor,
      insertHtmlAtPoint: insertHtmlAtPoint
    };
  }

  global.TiHtmlEditor = { create: createHtmlEditor };
})(typeof window !== "undefined" ? window : globalThis);

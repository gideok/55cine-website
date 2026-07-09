/**
 * contenteditable HTML 에디터
 */
(function (global) {
  var FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];
  var PASTE_ALLOWED = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, SPAN: 1, BR: 1, HR: 1 };
  var HEADING_TAGS = { H2: 1, H3: 1, H4: 1 };
  var NOTICE_LINK_CLASS = "site-notice-link";
  var MAGAZINE_TEXT_BOX_CLASS = "mz-text-box";

  function isHeadingTag(tag) {
    return !!HEADING_TAGS[String(tag || "").toUpperCase()];
  }

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

  /** 빈 블록(공백·단독 br만) 여부 — Enter 한 번으로 생기는 빈 div/p 감지 */
  function isBlockEffectivelyEmpty(el) {
    if (!el || !el.childNodes || !el.childNodes.length) return true;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.textContent.replace(/[\u00a0\s]/g, "")) return false;
      if (n.nodeType === 1) {
        if (n.tagName === "BR") continue;
        if (n.tagName === "IMG" || n.tagName === "HR") return false;
        if (n.textContent.replace(/[\u00a0\s]/g, "")) return false;
      }
    }
    return true;
  }

  function ensureBlockHasBreak(el) {
    if (!isBlockEffectivelyEmpty(el)) return;
    if (el.querySelector && el.querySelector("br")) return;
    el.appendChild(document.createElement("br"));
  }

  function convertDivToParagraph(el) {
    var p = document.createElement("p");
    while (el.firstChild) p.appendChild(el.firstChild);
    el.parentNode.replaceChild(p, el);
    ensureBlockHasBreak(p);
    return p;
  }

  function ensureParagraphBreaks(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("p").forEach(function (p) {
      ensureBlockHasBreak(p);
    });
  }

  function createHtmlEditor(container, initialHtml, options) {
    options = options || {};

    function isPasteTagAllowed(tag) {
      if (PASTE_ALLOWED[tag]) return true;
      if (options.allowParagraphs && tag === "P") return true;
      if (options.linkAsButton && tag === "A") return true;
      if (options.linkInline && tag === "A") return true;
      if (options.showQuote && tag === "BLOCKQUOTE") return true;
      if (options.showTextBox && tag === "DIV") return true;
      if (options.showHeadings && isHeadingTag(tag)) return true;
      return false;
    }
    var toolbar = document.createElement("div");
    toolbar.className = "admin-editor-toolbar";

    var body = document.createElement("div");
    body.className = "admin-editor-body";
    body.contentEditable = "true";
    body.innerHTML = initialHtml || "";

    var savedRange = null;

    function placeCursorInParagraphAfter(el) {
      var p = document.createElement("p");
      p.appendChild(document.createElement("br"));
      if (el.nextSibling) el.parentNode.insertBefore(p, el.nextSibling);
      else el.parentNode.appendChild(p);
      var newRange = document.createRange();
      newRange.setStart(p, 0);
      newRange.collapse(true);
      var sel = global.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      savedRange = newRange.cloneRange();
    }

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
      if (!color) return;

      body.focus();
      restoreSelection();
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      if (range.collapsed) return;

      var fragment = range.extractContents();
      var blockTags = { P: 1, DIV: 1, BLOCKQUOTE: 1, H2: 1, H3: 1, H4: 1, LI: 1 };
      var blocks = [];

      function collectBlocks(node) {
        if (!node) return;
        if (node.nodeType === 1 && blockTags[node.tagName]) {
          blocks.push(node);
          return;
        }
        Array.prototype.forEach.call(node.childNodes || [], collectBlocks);
      }

      collectBlocks(fragment);

      if (blocks.length) {
        blocks.forEach(function (block) {
          block.style.color = color;
        });
        range.insertNode(fragment);
      } else {
        var span = document.createElement("span");
        span.style.color = color;
        span.appendChild(fragment);
        range.insertNode(span);
        range = document.createRange();
        range.selectNodeContents(span);
      }

      sel.removeAllRanges();
      sel.addRange(range);
      savedRange = range.cloneRange();
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
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      if (options.linkAsButton) anchor.className = NOTICE_LINK_CLASS;
      anchor.appendChild(fragment);
      range.insertNode(anchor);
      placeCursorInParagraphAfter(anchor);
    }

    function insertQuoteBlock() {
      body.focus();
      restoreSelection();
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) {
        insertHtmlAtCursor("<blockquote><p>인용문을 입력하세요.</p></blockquote>");
        return;
      }
      var range = sel.getRangeAt(0);
      if (!rangeInBody(range) || range.collapsed) {
        insertHtmlAtCursor("<blockquote><p>인용문을 입력하세요.</p></blockquote>");
        return;
      }

      var fragment = range.extractContents();
      var quote = document.createElement("blockquote");
      quote.appendChild(fragment);
      range.insertNode(quote);

      var newRange = document.createRange();
      newRange.selectNodeContents(quote);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRange = newRange.cloneRange();
    }

    function applyFormatBlock(tagName) {
      body.focus();
      restoreSelection();
      var tag = String(tagName || "p").toLowerCase();
      if (!document.execCommand("formatBlock", false, tag)) {
        document.execCommand("formatBlock", false, "<" + tag + ">");
      }
      saveSelection();
    }

    function sanitizeBlockElement(el, walkFn) {
      el.removeAttribute("class");
      el.removeAttribute("face");
      el.removeAttribute("data-ke-style");
      el.removeAttribute("data-ke-size");
      el.removeAttribute("data-ti-asset-key");
      if (el.hasAttribute("style")) {
        var cleaned = stripFontStyles(el.getAttribute("style"), options.keepColor);
        if (cleaned) el.setAttribute("style", cleaned);
        else el.removeAttribute("style");
      }
      var children = Array.prototype.slice.call(el.childNodes);
      children.forEach(walkFn);
    }

    function insertTextBox() {
      body.focus();
      restoreSelection();
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) {
        insertHtmlAtCursor(
          '<div class="' + MAGAZINE_TEXT_BOX_CLASS + '"><p>내용을 입력하세요.</p></div><p><br></p>'
        );
        return;
      }
      var range = sel.getRangeAt(0);
      if (!rangeInBody(range) || range.collapsed) {
        insertHtmlAtCursor(
          '<div class="' + MAGAZINE_TEXT_BOX_CLASS + '"><p>내용을 입력하세요.</p></div><p><br></p>'
        );
        return;
      }

      var fragment = range.extractContents();
      var box = document.createElement("div");
      box.className = MAGAZINE_TEXT_BOX_CLASS;
      box.appendChild(fragment);
      range.insertNode(box);
      placeCursorInParagraphAfter(box);
    }

    function configureSanitizedAnchor(el) {
      var linkHref = normalizeLinkUrl(el.getAttribute("href"));
      if (!linkHref || !isSafeLinkHref(linkHref)) return false;
      el.href = linkHref;
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
      el.removeAttribute("style");
      el.removeAttribute("face");
      el.removeAttribute("data-ke-size");
      el.removeAttribute("data-ti-asset-key");
      if (options.linkAsButton) el.className = NOTICE_LINK_CLASS;
      else el.removeAttribute("class");
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        var keep =
          attr.name === "href" ||
          attr.name === "target" ||
          attr.name === "rel" ||
          (options.linkAsButton && attr.name === "class");
        if (!keep) el.removeAttribute(attr.name);
      });
      return true;
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
            prop !== "background-color" &&
            prop !== "margin" &&
            prop !== "margin-top" &&
            prop !== "margin-right" &&
            prop !== "margin-bottom" &&
            prop !== "margin-left" &&
            prop !== "padding" &&
            prop !== "padding-top" &&
            prop !== "padding-right" &&
            prop !== "padding-bottom" &&
            prop !== "padding-left"
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

      if (tag === "DIV") {
        var divClass = node.getAttribute && node.getAttribute("class");
        if (options.showTextBox && divClass && /\bmz-text-box\b/.test(divClass)) {
          var textBox = document.createElement("div");
          textBox.className = MAGAZINE_TEXT_BOX_CLASS;
          Array.prototype.forEach.call(node.childNodes, function (ch) {
            var c = sanitizePasteNode(ch);
            if (c) textBox.appendChild(c);
          });
          return textBox;
        }
        if (options.allowParagraphs) {
          var block = document.createElement("div");
          Array.prototype.forEach.call(node.childNodes, function (ch) {
            var c = sanitizePasteNode(ch);
            if (c) block.appendChild(c);
          });
          ensureBlockHasBreak(block);
          return block;
        }
        var divFrag = document.createDocumentFragment();
        Array.prototype.forEach.call(node.childNodes, function (ch) {
          var c = sanitizePasteNode(ch);
          if (c) divFrag.appendChild(c);
        });
        return divFrag;
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
      if (tag === "A" && (options.linkAsButton || options.linkInline)) {
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
        el.target = "_blank";
        el.rel = "noopener noreferrer";
        if (options.linkAsButton) el.className = NOTICE_LINK_CLASS;
      } else if (tag === "P" && options.allowParagraphs) {
        el = document.createElement("p");
      } else if (tag === "BLOCKQUOTE" && options.showQuote) {
        el = document.createElement("blockquote");
      } else if (options.showHeadings && isHeadingTag(tag)) {
        el = document.createElement(tag.toLowerCase());
        var headingStyle = node.getAttribute && node.getAttribute("style");
        if (headingStyle) {
          var hs = stripFontStyles(headingStyle, options.keepColor);
          if (hs) el.setAttribute("style", hs);
        }
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
      var normalized = String(html || "")
        .replace(/<div(\s[^>]*)?>\s*<\/div>/gi, "<p><br></p>")
        .replace(/<div(\s[^>]*)?>\s*<br\s*\/?>\s*<\/div>/gi, "<br>");
      var box = document.createElement("div");
      box.innerHTML = normalized;
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
        if (el.tagName === "A" && (options.linkAsButton || options.linkInline)) {
          if (!configureSanitizedAnchor(el)) {
            unwrapElement(el);
            return;
          }
          var linkChildren = Array.prototype.slice.call(el.childNodes);
          linkChildren.forEach(walk);
          return;
        }
        if (el.tagName === "BLOCKQUOTE" && options.showQuote) {
          el.removeAttribute("class");
          el.removeAttribute("data-ke-style");
          el.removeAttribute("data-ke-size");
          el.removeAttribute("data-ti-asset-key");
          var quoteChildren = Array.prototype.slice.call(el.childNodes);
          quoteChildren.forEach(walk);
          return;
        }
        if (el.tagName === "DIV") {
          if (options.showTextBox && el.classList.contains(MAGAZINE_TEXT_BOX_CLASS)) {
            el.className = MAGAZINE_TEXT_BOX_CLASS;
            el.removeAttribute("style");
            el.removeAttribute("data-ke-style");
            el.removeAttribute("data-ke-size");
            el.removeAttribute("data-ti-asset-key");
            Array.prototype.slice.call(el.attributes).forEach(function (attr) {
              if (attr.name !== "class") el.removeAttribute(attr.name);
            });
            var boxChildren = Array.prototype.slice.call(el.childNodes);
            boxChildren.forEach(walk);
            return;
          }
          walk(convertDivToParagraph(el));
          return;
        }
        if (el.tagName === "P" && options.allowParagraphs) {
          sanitizeBlockElement(el, walk);
          ensureBlockHasBreak(el);
          return;
        }
        if (options.showHeadings && isHeadingTag(el.tagName)) {
          sanitizeBlockElement(el, walk);
          return;
        }
        if (el.tagName === "IMG" && options.preserveImageSize) {
          var imgSrc = el.getAttribute("src");
          var imgAlt = el.getAttribute("alt");
          var imgTemp = el.getAttribute("data-ti-temp");
          var imgStyle = el.getAttribute("style") || "";
          var widthAttr = el.getAttribute("width");
          var cleanedImgStyle = imgStyle
            .split(";")
            .map(function (part) {
              return part.trim();
            })
            .filter(function (part) {
              if (!part) return false;
              var prop = part.split(":")[0].trim().toLowerCase();
              return prop === "width" || prop === "max-width" || prop === "height" ||
                prop === "display" || prop === "margin-left" || prop === "margin-right";
            })
            .join("; ");
          var nextImg = document.createElement("img");
          if (imgSrc) nextImg.setAttribute("src", imgSrc);
          if (imgAlt != null) nextImg.setAttribute("alt", imgAlt);
          if (imgTemp) nextImg.setAttribute("data-ti-temp", imgTemp);
          if (cleanedImgStyle) nextImg.setAttribute("style", cleanedImgStyle);
          if (widthAttr && !cleanedImgStyle) nextImg.setAttribute("width", widthAttr);
          el.parentNode.replaceChild(nextImg, el);
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
      ensureParagraphBreaks(box);
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
      var last = tpl.content.lastChild;
      range.insertNode(tpl.content);
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

    if (!options.linkAsButton && !options.linkInline) {
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

    if (options.showHeadings) {
      [
        { label: "H2", tag: "h2" },
        { label: "H3", tag: "h3" },
        { label: "H4", tag: "h4" },
        { label: "본문", tag: "p" }
      ].forEach(function (h) {
        var hBtn = document.createElement("button");
        hBtn.type = "button";
        hBtn.textContent = h.label;
        hBtn.title = h.tag === "p" ? "일반 단락으로 변환" : h.tag.toUpperCase() + " 제목";
        holdSelectionOnMouseDown(hBtn);
        hBtn.addEventListener("click", function () {
          applyFormatBlock(h.tag);
        });
        toolbar.appendChild(hBtn);
      });
    }

    if (options.linkAsButton || options.linkInline) {
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

    if (options.showQuote) {
      var quoteBtn = document.createElement("button");
      quoteBtn.type = "button";
      quoteBtn.textContent = "인용";
      holdSelectionOnMouseDown(quoteBtn);
      quoteBtn.addEventListener("click", insertQuoteBlock);
      toolbar.appendChild(quoteBtn);
    }

    if (options.showTextBox) {
      var textBoxBtn = document.createElement("button");
      textBoxBtn.type = "button";
      textBoxBtn.textContent = "텍스트박스";
      holdSelectionOnMouseDown(textBoxBtn);
      textBoxBtn.addEventListener("click", insertTextBox);
      toolbar.appendChild(textBoxBtn);
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

    body.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || !e.shiftKey) return;
      e.preventDefault();
      body.focus();
      restoreSelection();
      document.execCommand("insertLineBreak");
      saveSelection();
    });

    function insertPlainTextAtCursor(text) {
      if (!text) return;
      if (options.allowParagraphs && /\r|\n/.test(text)) {
        var lines = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        var htmlParts = lines.map(function (line) {
          if (!line) return "<div><br></div>";
          return (
            "<div>" +
            line
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;") +
            "</div>"
          );
        });
        insertHtmlAtCursor(htmlParts.join(""));
        return;
      }
      document.execCommand("insertText", false, text);
      saveSelection();
    }

    body.addEventListener("paste", function (e) {
      e.preventDefault();
      body.focus();
      restoreSelection();
      var html = e.clipboardData && e.clipboardData.getData("text/html");
      var text = e.clipboardData && e.clipboardData.getData("text/plain");
      if (html) {
        insertHtmlAtCursor(sanitizePasteHtml(html));
      } else if (text) {
        insertPlainTextAtCursor(text);
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

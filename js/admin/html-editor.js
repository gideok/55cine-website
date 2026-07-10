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

  function normalizeMagazineAssetRelPath(url) {
    if (!url) return "";
    var s = String(url).trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) {
      try {
        s = new URL(s).pathname;
      } catch (e) {
        return s;
      }
    }
    while (/^\.\.\//.test(s)) {
      s = s.slice(3);
    }
    return s.replace(/^\/+/, "");
  }

  function parseStyleAttr(style) {
    var out = {};
    (style || "").split(";").forEach(function (part) {
      var idx = part.indexOf(":");
      if (idx === -1) return;
      var key = part.slice(0, idx).trim().toLowerCase();
      var val = part.slice(idx + 1).trim();
      if (key && val) out[key] = val;
    });
    return out;
  }

  function serializeStyleAttr(map) {
    return Object.keys(map)
      .filter(function (key) {
        return !!map[key];
      })
      .map(function (key) {
        return key + ": " + map[key];
      })
      .join("; ");
  }

  function removeStylePropFromAttr(style, prop) {
    var map = parseStyleAttr(style);
    delete map[prop];
    return serializeStyleAttr(map);
  }

  function isRedundantInlineSpan(el) {
    if (!el || el.nodeType !== 1 || el.tagName !== "SPAN") return false;
    if (el.attributes.length === 0) return true;
    if (el.attributes.length === 1 && el.hasAttribute("style") && !el.getAttribute("style").trim()) {
      return true;
    }
    return false;
  }

  function stripFontSizeFromSubtree(root) {
    if (!root) return;

    var styled = [];
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute("style")) {
      styled.push(root);
    }
    if (root.querySelectorAll) {
      styled = styled.concat(Array.prototype.slice.call(root.querySelectorAll("[style]")));
    }

    styled.forEach(function (el) {
      var cleaned = removeStylePropFromAttr(el.getAttribute("style"), "font-size");
      if (cleaned) el.setAttribute("style", cleaned);
      else el.removeAttribute("style");
    });

    var spans = root.querySelectorAll
      ? Array.prototype.slice.call(root.querySelectorAll("span"))
      : root.nodeType === 1 && root.tagName === "SPAN"
        ? [root]
        : [];
    spans.reverse().forEach(function (span) {
      if (isRedundantInlineSpan(span)) unwrapElement(span);
    });
  }

  function consolidateNestedSpans(root) {
    if (!root || !root.querySelectorAll) return;

    var changed = true;
    while (changed) {
      changed = false;
      var spans = Array.prototype.slice.call(root.querySelectorAll("span"));
      spans.forEach(function (span) {
        while (
          span.parentNode &&
          span.childNodes.length === 1 &&
          span.firstChild.nodeType === 1 &&
          span.firstChild.tagName === "SPAN"
        ) {
          var inner = span.firstChild;
          var merged = parseStyleAttr(span.getAttribute("style"));
          var innerMap = parseStyleAttr(inner.getAttribute("style"));
          Object.keys(innerMap).forEach(function (key) {
            merged[key] = innerMap[key];
          });
          var mergedStyle = serializeStyleAttr(merged);
          if (mergedStyle) span.setAttribute("style", mergedStyle);
          else span.removeAttribute("style");
          while (inner.firstChild) span.appendChild(inner.firstChild);
          span.removeChild(inner);
          changed = true;
        }
        if (isRedundantInlineSpan(span)) {
          unwrapElement(span);
          changed = true;
        }
      });
    }
  }

  function mergeStyleOntoElement(el, styleStr) {
    if (!el || el.nodeType !== 1 || !styleStr) return;
    var incoming = parseStyleAttr(styleStr);
    var current = parseStyleAttr(el.getAttribute("style") || "");
    ["font-size", "color", "text-align"].forEach(function (key) {
      if (incoming[key] && !current[key]) current[key] = incoming[key];
    });
    var merged = serializeStyleAttr(current);
    if (merged) el.setAttribute("style", merged);
    else el.removeAttribute("style");
  }

  function unwrapBlockWrappingSpans(root) {
    if (!root || !root.querySelectorAll) return;
    var blockTags = { P: 1, DIV: 1, BLOCKQUOTE: 1, H2: 1, H3: 1, H4: 1 };
    var spans = Array.prototype.slice.call(root.querySelectorAll("span"));
    spans.forEach(function (span) {
      var hasBlockChild = Array.prototype.some.call(span.children, function (ch) {
        return !!blockTags[ch.tagName];
      });
      if (!hasBlockChild) return;
      var style = span.getAttribute("style");
      var parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) {
        var child = span.firstChild;
        parent.insertBefore(child, span);
        if (style && child.nodeType === 1 && blockTags[child.tagName]) {
          mergeStyleOntoElement(child, style);
        }
      }
      parent.removeChild(span);
    });
  }

  function isBlankParagraph(p) {
    return isBlockEffectivelyEmpty(p);
  }

  function paragraphStyleKey(p) {
    return serializeStyleAttr(parseStyleAttr(p.getAttribute("style") || ""));
  }

  function hoistSingleSpanInParagraph(p) {
    if (!p || p.tagName !== "P") return;
    var meaningful = [];
    Array.prototype.forEach.call(p.childNodes, function (n) {
      if (n.nodeType === 3 && !n.textContent.replace(/\u00a0/g, " ").trim()) return;
      if (n.nodeType === 1 && n.tagName === "BR") return;
      meaningful.push(n);
    });
    if (meaningful.length !== 1 || meaningful[0].tagName !== "SPAN") return;
    var span = meaningful[0];
    mergeStyleOntoElement(p, span.getAttribute("style") || "");
    unwrapElement(span);
  }

  function unwrapIdenticalAdjacentSpans(p) {
    if (!p) return;
    var node = p.firstChild;
    while (node) {
      var next = node.nextSibling;
      if (
        node.nodeType === 1 &&
        node.tagName === "SPAN" &&
        node.getAttribute("style") &&
        next &&
        next.nodeType === 1 &&
        next.tagName === "BR"
      ) {
        var afterBr = next.nextSibling;
        if (
          afterBr &&
          afterBr.nodeType === 1 &&
          afterBr.tagName === "SPAN" &&
          afterBr.getAttribute("style") === node.getAttribute("style")
        ) {
          while (afterBr.firstChild) node.appendChild(afterBr.firstChild);
          p.removeChild(afterBr);
          p.removeChild(next);
          continue;
        }
      }
      node = next;
    }
    hoistSingleSpanInParagraph(p);
  }

  function mergeSoftLineParagraphs(box) {
    if (!box) return;
    var nodes = Array.prototype.slice.call(box.childNodes);
    var i = 0;
    while (i < nodes.length) {
      var current = nodes[i];
      if (!current || current.nodeType !== 1 || current.tagName !== "P" || isBlankParagraph(current)) {
        i++;
        continue;
      }
      var styleKey = paragraphStyleKey(current);
      var j = i + 1;
      while (j < nodes.length) {
        var next = nodes[j];
        if (!next || next.nodeType !== 1 || next.tagName !== "P") break;
        if (isBlankParagraph(next)) break;
        if (paragraphStyleKey(next) !== styleKey) break;
        current.appendChild(document.createElement("br"));
        while (next.firstChild) current.appendChild(next.firstChild);
        if (next.parentNode) next.parentNode.removeChild(next);
        nodes.splice(j, 1);
      }
      i = j;
    }
    Array.prototype.forEach.call(box.querySelectorAll(":scope > p"), function (p) {
      unwrapIdenticalAdjacentSpans(p);
      hoistSingleSpanInParagraph(p);
    });
  }

  function normalizeTextBoxes(root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll("." + MAGAZINE_TEXT_BOX_CLASS), function (box) {
      consolidateNestedSpans(box);
      mergeSoftLineParagraphs(box);
      consolidateNestedSpans(box);
    });
  }

  /** 빈 문단(빈 줄)에 남은 인라인 서식 제거 — 삭제 시 아랫줄로 서식이 전파되는 것 방지 */
  function cleanBlankParagraphs(root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll("p"), function (p) {
      if (!isBlockEffectivelyEmpty(p)) return;
      if (p.querySelector("img, hr, iframe, video")) return;
      p.removeAttribute("style");
      while (p.firstChild) p.removeChild(p.firstChild);
      p.appendChild(document.createElement("br"));
    });
  }

  function normalizeBodyHtmlStructure(root) {
    if (!root) return;
    consolidateNestedSpans(root);
    unwrapBlockWrappingSpans(root);
    normalizeTextBoxes(root);
    cleanBlankParagraphs(root);
    consolidateNestedSpans(root);
  }

  function stripColorFromSubtree(root) {
    if (!root) return;

    var styled = [];
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute("style")) {
      styled.push(root);
    }
    if (root.querySelectorAll) {
      styled = styled.concat(Array.prototype.slice.call(root.querySelectorAll("[style]")));
    }

    styled.forEach(function (el) {
      var cleaned = removeStylePropFromAttr(el.getAttribute("style"), "color");
      if (cleaned) el.setAttribute("style", cleaned);
      else el.removeAttribute("style");
    });

    var spans = root.querySelectorAll
      ? Array.prototype.slice.call(root.querySelectorAll("span"))
      : root.nodeType === 1 && root.tagName === "SPAN"
        ? [root]
        : [];
    spans.reverse().forEach(function (span) {
      if (isRedundantInlineSpan(span)) unwrapElement(span);
    });
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
    toolbar.addEventListener("mousedown", snapshotEditorSelection, true);

    var body = document.createElement("div");
    body.className = "admin-editor-body";
    body.contentEditable = "true";
    body.innerHTML = initialHtml || "";

    var savedRange = null;
    var blockActionRange = null;

    function rememberBlockActionRange(range) {
      if (!range) return;
      try {
        if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return;
        blockActionRange = range.cloneRange();
      } catch (e) {
        /* ignore */
      }
    }

    /** 편집기 안의 현재 선택을 blockActionRange·savedRange에 반영 */
    function snapshotEditorSelection() {
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!body.contains(sel.anchorNode)) return;
      var live = sel.getRangeAt(0);
      if (!rangeInBody(live)) return;

      rememberBlockActionRange(live);
      if (!live.collapsed) {
        savedRange = live.cloneRange();
        return;
      }
      if (!isRangeValid(savedRange) || savedRange.collapsed) {
        if (getAlignableBlockFromRange(live)) {
          savedRange = live.cloneRange();
        }
      }
    }

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

    function isRangeValid(range) {
      if (!range) return false;
      try {
        if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return false;
        range.startOffset;
        range.endOffset;
        return true;
      } catch (e) {
        return false;
      }
    }

    function saveSelection() {
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!body.contains(sel.anchorNode)) return;
      var live = sel.getRangeAt(0);
      if (live.collapsed && isRangeValid(savedRange) && !savedRange.collapsed) {
        if (getAlignableBlockFromRange(live)) rememberBlockActionRange(live);
        return;
      }
      savedRange = live.cloneRange();
      rememberBlockActionRange(live);
    }

    function applySavedRange(range) {
      if (!range) return false;
      var sel = global.getSelection();
      if (!sel) return false;
      try {
        sel.removeAllRanges();
        sel.addRange(range);
        savedRange = range.cloneRange();
        return true;
      } catch (e) {
        return false;
      }
    }

    function restoreSelection() {
      if (!isRangeValid(savedRange)) return false;
      return applySavedRange(savedRange);
    }

    function isRangeUsableForBlockOps(range) {
      if (!range || !rangeInBody(range)) return false;
      if (!range.collapsed) return true;
      return !!getAlignableBlockFromRange(range);
    }

    function captureToolbarSelection() {
      snapshotEditorSelection();
    }

    function getAlignableBlockFromRange(range) {
      var block = getAlignableBlockFromNode(range.startContainer);
      if (block) return block;
      if (!range.collapsed || range.startContainer !== body) return null;

      var offset = range.startOffset;
      if (offset < body.childNodes.length) {
        block = getAlignableBlockFromNode(body.childNodes[offset]);
        if (block) return block;
      }
      if (offset > 0) {
        block = getAlignableBlockFromNode(body.childNodes[offset - 1]);
        if (block) return block;
      }
      return null;
    }

    function rangeTouchesBlocks(range, blocks) {
      if (!range || !blocks.length) return false;
      return blocks.some(function (block) {
        try {
          return range.intersectsNode(block);
        } catch (e) {
          return block.contains(range.startContainer) || block.contains(range.endContainer);
        }
      });
    }

    function createRangeOverBlockContents(blocks) {
      if (!blocks.length) return null;
      var newRange = document.createRange();
      var first = blocks[0];
      var last = blocks[blocks.length - 1];
      newRange.setStart(first, 0);

      var lastText = null;
      var walker = document.createTreeWalker(last, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        lastText = node;
      }
      if (lastText) {
        newRange.setEnd(lastText, lastText.length);
      } else {
        newRange.setEnd(last, last.childNodes.length);
      }
      return newRange;
    }

    function finalizeSelectionAfterBlockOps(blocks, originalRange) {
      if (!blocks.length) return;

      var nextRange = null;
      if (isRangeValid(originalRange) && rangeTouchesBlocks(originalRange, blocks)) {
        nextRange = originalRange.cloneRange();
      }
      if (!nextRange) {
        nextRange = createRangeOverBlockContents(blocks);
      }
      if (!nextRange) return;

      body.focus();
      applySavedRange(nextRange);
    }

    function holdSelectionOnMouseDown(btn) {
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        captureToolbarSelection();
      });
    }

    function exec(cmd, val) {
      body.focus();
      restoreSelection();
      document.execCommand(cmd, false, val || null);
      saveSelection();
    }

    function getInlineFontSizePx(el) {
      var node = el;
      while (node && node !== body) {
        if (node.nodeType === 1 && node.hasAttribute("style")) {
          var match = node.getAttribute("style").match(/font-size:\s*(\d+(?:\.\d+)?)px/i);
          if (match) return Math.round(parseFloat(match[1]));
        }
        node = node.parentNode;
      }
      return null;
    }

    function getSelectionFontSizePx() {
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return 16;
      var node = sel.anchorNode;
      if (!node) return 16;
      if (node.nodeType === 3) node = node.parentElement;
      if (!node || !body.contains(node)) return 16;
      var inlinePx = getInlineFontSizePx(node);
      if (inlinePx) return inlinePx;
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
        stripColorFromSubtree(fragment);
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
      consolidateNestedSpans(body);
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

    function isAlignableBlockCandidate(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el.classList && el.classList.contains(MAGAZINE_TEXT_BOX_CLASS)) return false;
      if (closestByTag(el, "figure")) return false;
      if (el.querySelector("p, h2, h3, h4, div, blockquote, li")) return false;
      var tag = el.tagName;
      return tag === "P" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "BLOCKQUOTE";
    }

    function getAlignableBlockFromNode(node) {
      if (!node) return null;
      if (node.nodeType === 3) node = node.parentElement;
      while (node && node !== body) {
        if (isAlignableBlockCandidate(node)) return node;
        node = node.parentNode;
      }
      return null;
    }

    function rangeFullyInsideBlock(range, blockEl) {
      if (!range || !blockEl) return false;
      try {
        var blockRange = document.createRange();
        blockRange.selectNodeContents(blockEl);
        return (
          range.compareBoundaryPoints(Range.START_TO_START, blockRange) >= 0 &&
          range.compareBoundaryPoints(Range.END_TO_END, blockRange) <= 0
        );
      } catch (e) {
        return false;
      }
    }

    function rangeSelectsTextInBlock(range, blockEl) {
      if (!range || !blockEl || !range.intersectsNode(blockEl)) return false;
      if (isBlockEffectivelyEmpty(blockEl)) return rangeFullyInsideBlock(range, blockEl);

      var walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT, null);
      var textNode;
      while ((textNode = walker.nextNode())) {
        if (!textNode.textContent.replace(/[\u00a0\s]/g, "")) continue;
        if (!range.intersectsNode(textNode)) continue;

        var start = range.startContainer === textNode ? range.startOffset : 0;
        var end = range.endContainer === textNode ? range.endOffset : textNode.length;
        if (end > start) return true;
      }

      var media = blockEl.querySelectorAll("img, hr");
      for (var i = 0; i < media.length; i++) {
        if (range.intersectsNode(media[i])) return true;
      }
      return false;
    }

    function isRangeEndAtBlockStart(range, blockEl) {
      if (!range || !blockEl) return false;
      try {
        var endPoint = range.cloneRange();
        endPoint.collapse(false);
        var blockStart = document.createRange();
        blockStart.setStart(blockEl, 0);
        blockStart.collapse(true);
        return endPoint.compareBoundaryPoints(Range.START_TO_START, blockStart) === 0;
      } catch (e) {
        return false;
      }
    }

    function resolveAlignEndBlock(range, startBlock) {
      var endBlock = getAlignableBlockFromNode(range.endContainer) || startBlock;
      if (endBlock === startBlock) return startBlock;
      if (!rangeSelectsTextInBlock(range, endBlock) && isRangeEndAtBlockStart(range, endBlock)) {
        return startBlock;
      }
      return endBlock;
    }

    function collectAlignBlocksInRange(range) {
      if (!range || !rangeInBody(range)) return [];

      var startBlock = getAlignableBlockFromRange(range);
      if (!startBlock) return [];
      if (range.collapsed) return [startBlock];

      var endBlock = resolveAlignEndBlock(range, startBlock);
      if (startBlock === endBlock) return [startBlock];

      var blocks = [];
      var collecting = false;
      var candidates = body.querySelectorAll("p, h2, h3, h4, blockquote");
      Array.prototype.forEach.call(candidates, function (el) {
        if (!isAlignableBlockCandidate(el)) return;
        if (el === startBlock) collecting = true;
        if (!collecting) return;

        if (el === startBlock || el === endBlock) {
          blocks.push(el);
        } else if (isBlockEffectivelyEmpty(el)) {
          if (rangeFullyInsideBlock(range, el)) blocks.push(el);
        } else if (rangeSelectsTextInBlock(range, el)) {
          blocks.push(el);
        }

        if (el === endBlock) collecting = false;
      });

      return blocks.length ? blocks : [startBlock];
    }

    function rangeCoversFullBlock(range, blockEl) {
      if (!range || !blockEl) return false;
      try {
        var blockRange = document.createRange();
        blockRange.selectNodeContents(blockEl);
        return (
          range.compareBoundaryPoints(Range.START_TO_START, blockRange) <= 0 &&
          range.compareBoundaryPoints(Range.END_TO_END, blockRange) >= 0
        );
      } catch (e) {
        return false;
      }
    }

    function shouldSplitBlockForAlign(range, blockEl) {
      if (!blockEl || blockEl.tagName !== "P") return false;
      if (!blockEl.querySelector("br")) return false;
      if (rangeCoversFullBlock(range, blockEl)) return false;
      return rangeFullyInsideBlock(range, blockEl);
    }

    /** 한 <p> 안의 <br> 줄바꿈을 각각 별도 단락으로 분리 */
    function splitBlockByBrLines(blockEl) {
      if (!blockEl || !blockEl.parentNode) return [blockEl];

      var segments = [[]];
      var nodes = Array.prototype.slice.call(blockEl.childNodes);
      nodes.forEach(function (node) {
        if (node.nodeType === 1 && node.tagName === "BR") {
          if (node.parentNode) node.parentNode.removeChild(node);
          segments.push([]);
          return;
        }
        segments[segments.length - 1].push(node);
      });

      var baseStyle = removeStylePropFromAttr(blockEl.getAttribute("style") || "", "text-align");
      var parent = blockEl.parentNode;
      var insertRef = blockEl;
      var created = [];

      segments.forEach(function (segNodes) {
        var newBlock = document.createElement(blockEl.tagName);
        if (baseStyle) newBlock.setAttribute("style", baseStyle);
        if (!segNodes.length) {
          newBlock.appendChild(document.createElement("br"));
        } else {
          segNodes.forEach(function (n) {
            newBlock.appendChild(n);
          });
        }
        parent.insertBefore(newBlock, insertRef);
        created.push(newBlock);
      });

      parent.removeChild(blockEl);
      return created.length ? created : [blockEl];
    }

    function prepareBlocksForAlign(blocks, range) {
      var prepared = [];
      blocks.forEach(function (blockEl) {
        if (!shouldSplitBlockForAlign(range, blockEl)) {
          prepared.push(blockEl);
          return;
        }

        var parts = splitBlockByBrLines(blockEl);
        var matched = false;
        parts.forEach(function (part) {
          if (range.collapsed) {
            if (part.contains(range.startContainer)) {
              prepared.push(part);
              matched = true;
            }
            return;
          }
          if (rangeSelectsTextInBlock(range, part) || rangeFullyInsideBlock(range, part)) {
            prepared.push(part);
            matched = true;
          }
        });
        if (!matched && parts.length) {
          var startPart = null;
          for (var i = 0; i < parts.length; i++) {
            if (parts[i].contains(range.startContainer)) {
              startPart = parts[i];
              break;
            }
          }
          prepared.push(startPart || parts[0]);
        }
      });
      return prepared.length ? prepared : blocks;
    }

    function collectFormatBlocksInRange(range) {
      var candidates = body.querySelectorAll("p, h2, h3, h4, div, blockquote, li");
      var blocks = [];
      Array.prototype.forEach.call(candidates, function (el) {
        if (el.classList && el.classList.contains(MAGAZINE_TEXT_BOX_CLASS)) return;
        if (closestByTag(el, "figure")) return;
        if (el.querySelector("p, h2, h3, h4, div, blockquote, li")) return;
        if (range.intersectsNode(el)) blocks.push(el);
      });
      return blocks;
    }

    function closestByTag(el, tagName) {
      var t = String(tagName).toUpperCase();
      var node = el;
      while (node && node !== body) {
        if (node.nodeType === 1 && node.tagName === t) return node;
        node = node.parentNode;
      }
      return null;
    }

    /** H2·H3·H4·본문 — 블록 태그 교체 + 내부 font-size 제거로 표준 서식 강제 */
    function applyFormatBlock(tagName) {
      body.focus();
      restoreSelection();
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      if (!rangeInBody(range)) return;

      var originalRange = range.cloneRange();
      var tag = String(tagName || "p").toLowerCase();
      var blocks = collectFormatBlocksInRange(range);

      if (!blocks.length) {
        if (!document.execCommand("formatBlock", false, tag)) {
          document.execCommand("formatBlock", false, "<" + tag + ">");
        }
        sel = global.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        range = sel.getRangeAt(0);
        if (!rangeInBody(range)) return;
        originalRange = range.cloneRange();
        blocks = collectFormatBlocksInRange(range);
      }
      if (!blocks.length) return;

      var converted = blocks.map(function (blockEl) {
        var next = document.createElement(tag);
        var color = blockEl.style ? blockEl.style.color : "";
        var textAlign = blockEl.style ? blockEl.style.textAlign : "";
        while (blockEl.firstChild) next.appendChild(blockEl.firstChild);
        if (color) next.style.color = color;
        if (textAlign) next.style.textAlign = textAlign;
        blockEl.parentNode.replaceChild(next, blockEl);
        stripFontSizeFromSubtree(next);
        ensureBlockHasBreak(next);
        return next;
      });

      finalizeSelectionAfterBlockOps(converted, originalRange);
    }

    function findBlocksForAlign(range) {
      if (!range) return [];

      var candidates = body.querySelectorAll("p, h2, h3, h4, blockquote");
      var blocks = [];
      Array.prototype.forEach.call(candidates, function (el) {
        if (!isAlignableBlockCandidate(el)) return;
        try {
          if (range.intersectsNode(el)) blocks.push(el);
        } catch (e) {
          if (el.contains(range.startContainer) || el.contains(range.endContainer)) {
            blocks.push(el);
          }
        }
      });
      if (blocks.length) return blocks;

      var block = getAlignableBlockFromRange(range);
      return block ? [block] : [];
    }

    function setBlockTextAlign(blockEl, align) {
      if (!blockEl) return;
      if (!align || align === "left") {
        var cleaned = removeStylePropFromAttr(blockEl.getAttribute("style") || "", "text-align");
        if (cleaned) blockEl.setAttribute("style", cleaned);
        else blockEl.removeAttribute("style");
        return;
      }
      blockEl.style.textAlign = align;
    }

    /** 선택 블록(p·h2·h3·h4·blockquote 등)에 text-align 적용 */
    function applyBlockAlign(align) {
      body.focus();
      restoreSelection();

      var range = null;
      var sel = global.getSelection();
      if (sel && sel.rangeCount > 0) {
        var live = sel.getRangeAt(0);
        if (rangeInBody(live)) range = live.cloneRange();
      }
      if (!range && isRangeValid(blockActionRange)) range = blockActionRange.cloneRange();
      if (!range && isRangeValid(savedRange)) range = savedRange.cloneRange();
      if (!range) return;

      var originalRange = range.cloneRange();
      var blocks = findBlocksForAlign(range);
      if (!blocks.length) return;

      blocks = prepareBlocksForAlign(blocks, range);
      if (!blocks.length) return;

      blocks.forEach(function (blockEl) {
        setBlockTextAlign(blockEl, align);
      });

      finalizeSelectionAfterBlockOps(blocks, originalRange);
      rememberBlockActionRange(originalRange);
      saveSelection();
    }

    function makeToolbarAlignButton(label, align, title) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.className = "admin-editor-btn--g3";
      if (title) btn.title = title;
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        applyBlockAlign(align);
      });
      toolbar.appendChild(btn);
      return btn;
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
      stripFontSizeFromSubtree(fragment);
      var span = document.createElement("span");
      span.style.fontSize = next + "px";
      span.appendChild(fragment);
      range.insertNode(span);
      consolidateNestedSpans(body);

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
          if (prop === "text-align") return true;
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
          if (imgSrc) nextImg.setAttribute("src", normalizeMagazineAssetRelPath(imgSrc));
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
      normalizeBodyHtmlStructure(box);
      consolidateNestedSpans(box);
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

    function makeToolbarButton(label, groupClass, title, onClick) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (groupClass) btn.className = groupClass;
      if (title) btn.title = title;
      holdSelectionOnMouseDown(btn);
      btn.addEventListener("click", onClick);
      toolbar.appendChild(btn);
      return btn;
    }

    /* 1그룹 — 인라인 서식 */
    var buttons = [
      { label: "굵게", cmd: "bold", group: "admin-editor-btn--g1" },
      { label: "기울임", cmd: "italic", group: "admin-editor-btn--g1" },
      { label: "밑줄", cmd: "underline", group: "admin-editor-btn--g1" }
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
      makeToolbarButton(b.label, b.group, null, function () {
        if (b.prompt) {
          var url = global.prompt(b.prompt);
          if (url) exec(b.cmd, url);
        } else {
          exec(b.cmd);
        }
      });
    });

    /* 2그룹 — 블록 서식·글자 크기 */
    if (options.showHeadings) {
      [
        { label: "H2", tag: "h2" },
        { label: "H3", tag: "h3" },
        { label: "H4", tag: "h4" },
        { label: "본문", tag: "p" }
      ].forEach(function (h) {
        makeToolbarButton(
          h.label,
          "admin-editor-btn--g2",
          h.tag === "p" ? "일반 단락으로 변환" : h.tag.toUpperCase() + " 제목",
          function () {
            applyFormatBlock(h.tag);
          }
        );
      });
    }

    if (options.showFontSize !== false) {
      makeToolbarButton("작게", "admin-editor-btn--g2", "글자 크기 줄이기", function () {
        changeFontSize(-1);
      });
      makeToolbarButton("크게", "admin-editor-btn--g2", "글자 크기 키우기", function () {
        changeFontSize(1);
      });
    }

    /* 3그룹 — 블록 정렬 (mousedown에서 즉시 적용) */
    if (options.showBlockAlign) {
      [
        { label: "왼쪽", align: "left", title: "블록 왼쪽 정렬" },
        { label: "중앙", align: "center", title: "블록 가운데 정렬" },
        { label: "오른쪽", align: "right", title: "블록 오른쪽 정렬" }
      ].forEach(function (item) {
        makeToolbarAlignButton(item.label, item.align, item.title);
      });
    }

    if (options.linkAsButton || options.linkInline) {
      makeToolbarButton("URL", null, null, function () {
        var url = global.prompt("연결할 URL");
        if (url) applyLink(url);
      });
    }

    if (options.showDivider) {
      makeToolbarButton("구분선", null, null, function () {
        insertHtmlAtCursor("<hr>");
      });
    }

    if (options.showQuote) {
      makeToolbarButton("인용", null, null, insertQuoteBlock);
    }

    if (options.showTextBox) {
      makeToolbarButton("텍스트박스", null, null, insertTextBox);
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

    /** focus 시엔 기존 비접힘 선택을 접힌 커서로 덮어쓰지 않는다 */
    function saveSelectionOnFocus() {
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!body.contains(sel.anchorNode)) return;
      var live = sel.getRangeAt(0);
      if (live.collapsed && isRangeValid(savedRange) && !savedRange.collapsed) return;
      savedRange = live.cloneRange();
    }

    body.addEventListener("keyup", saveSelection);
    body.addEventListener("mouseup", saveSelection);
    body.addEventListener("focus", saveSelectionOnFocus);
    document.addEventListener("mouseup", saveSelection, true);
    document.addEventListener(
      "pointerdown",
      function (e) {
        if (!toolbar.contains(e.target)) return;
        snapshotEditorSelection();
      },
      true
    );
    document.addEventListener("selectionchange", function () {
      var sel = global.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!body.contains(sel.anchorNode)) return;
      var live = sel.getRangeAt(0);
      if (!live.collapsed) {
        savedRange = live.cloneRange();
        rememberBlockActionRange(live);
        return;
      }
      if (!isRangeValid(savedRange) || savedRange.collapsed) {
        if (getAlignableBlockFromRange(live)) {
          savedRange = live.cloneRange();
          rememberBlockActionRange(live);
        }
      }
    });

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
        normalizeBodyHtmlStructure(body);
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

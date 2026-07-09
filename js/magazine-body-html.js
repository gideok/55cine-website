/**
 * 매거진 본문 HTML — 상세 페이지 표시용 정규화
 */
(function (global) {
  function decodeHtmlEntitiesIfNeeded(html) {
    if (!html) return "";
    if (html.indexOf("<") !== -1 || html.indexOf(">") !== -1) return html;
    if (!/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i.test(html)) return html;
    var el = document.createElement("textarea");
    el.innerHTML = html;
    return el.value;
  }

  /** span[style] > block → block[style] (브라우저 파싱 전 문자열 보정) */
  function promoteColorSpanToBlocks(html) {
    var out = html;
    var prev;
    do {
      prev = out;
      out = out.replace(
        /<span(\s+style="([^"]*)")[^>]*>\s*<p(\s[^>]*)?>/gi,
        function (_m, _s1, styleVal, pRest) {
          var fontM = styleVal.match(/\bfont-size\s*:\s*([^;"]+)/i);
          var colorM = styleVal.match(/\bcolor\s*:\s*([^;"]+)/i);
          if (!fontM && !colorM) return _m;
          var parts = [];
          if (fontM) parts.push("font-size: " + fontM[1].trim());
          if (colorM) parts.push("color: " + colorM[1].trim());
          var merged = parts.join("; ");
          var attrs = pRest || "";
          if (/\bstyle="/i.test(attrs)) {
            return "<p" + attrs.replace(/\bstyle="([^"]*)"/i, 'style="' + merged + "; $1") + ">";
          }
          return '<p style="' + merged + '"' + attrs + ">";
        }
      );
    } while (out !== prev);
    return cleanupOrphanColorSpans(out);
  }

  function cleanupOrphanColorSpans(html) {
    return html
      .replace(/<span(\s+style="[^"]*\bcolor[^"]*")[^>]*>\s*(?=<p\b[^>]*\bstyle="[^"]*\bcolor)/gi, "")
      .replace(/(<\/p>)\s*(?:<\/span>\s*)+/gi, "$1");
  }

  function normalizeParagraphBreaks(html) {
    return html
      .replace(/<div(\s[^>]*)?>\s*<\/div>/gi, "<p><br></p>")
      .replace(/<div(\s[^>]*)?>\s*<br\s*\/?>\s*<\/div>/gi, "<br>")
      .replace(/<p(\s[^>]*)?>\s*<\/p>/gi, "<p$1><br></p>");
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

  function unwrapElement(el) {
    var parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  function isRedundantInlineSpan(el) {
    if (!el || el.nodeType !== 1 || el.tagName !== "SPAN") return false;
    if (el.attributes.length === 0) return true;
    if (el.attributes.length === 1 && el.hasAttribute("style") && !el.getAttribute("style").trim()) {
      return true;
    }
    return false;
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

  function normalizeMagazineAssetRelPath(url) {
    if (global.TiMagazineAsset && typeof global.TiMagazineAsset.normalizeRelPath === "function") {
      return global.TiMagazineAsset.normalizeRelPath(url);
    }
    if (!url) return "";
    var s = String(url).trim();
    if (/^https?:\/\//i.test(s)) {
      try {
        s = new URL(s).pathname;
      } catch (e) {
        return s;
      }
    }
    while (/^\.\.\//.test(s)) s = s.slice(3);
    return s.replace(/^\/+/, "");
  }

  function normalizeImgSrcInHtml(html) {
    return html.replace(/(<img\b[^>]*\bsrc=)(["'])([^"']+)\2/gi, function (_m, prefix, q, src) {
      return prefix + q + normalizeMagazineAssetRelPath(src) + q;
    });
  }

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

  function mergeStyleOntoElement(el, styleStr) {
    if (!el || el.nodeType !== 1 || !styleStr) return;
    var incoming = parseStyleAttr(styleStr);
    var current = parseStyleAttr(el.getAttribute("style") || "");
    ["font-size", "color"].forEach(function (key) {
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

  function mergeSoftLineParagraphs(box) {
    if (!box) return;
    var nodes = Array.prototype.slice.call(box.childNodes);
    var i = 0;
    while (i < nodes.length) {
      var current = nodes[i];
      if (!current || current.nodeType !== 1 || current.tagName !== "P" || isBlockEffectivelyEmpty(current)) {
        i++;
        continue;
      }
      var styleKey = serializeStyleAttr(parseStyleAttr(current.getAttribute("style") || ""));
      var j = i + 1;
      while (j < nodes.length) {
        var next = nodes[j];
        if (!next || next.nodeType !== 1 || next.tagName !== "P") break;
        if (isBlockEffectivelyEmpty(next)) break;
        if (serializeStyleAttr(parseStyleAttr(next.getAttribute("style") || "")) !== styleKey) break;
        current.appendChild(document.createElement("br"));
        while (next.firstChild) current.appendChild(next.firstChild);
        if (next.parentNode) next.parentNode.removeChild(next);
        nodes.splice(j, 1);
      }
      i = j;
    }
    Array.prototype.forEach.call(box.querySelectorAll(":scope > p"), function (p) {
      unwrapIdenticalAdjacentSpansInParagraph(p);
      hoistSingleSpanInParagraph(p);
    });
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

  function unwrapIdenticalAdjacentSpansInParagraph(p) {
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

  function normalizeTextBoxes(root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll(".mz-text-box"), function (box) {
      consolidateNestedSpans(box);
      mergeSoftLineParagraphs(box);
      consolidateNestedSpans(box);
    });
  }

  /** 빈 문단의 잔여 인라인 서식 제거 — 빈 줄 간격 통일 */
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

  function normalizeBodyHtmlDom(html) {
    if (!html || (html.indexOf("<span") === -1 && html.indexOf("<img") === -1 && html.indexOf("<p") === -1)) {
      return html;
    }
    var box = document.createElement("div");
    box.innerHTML = html;
    consolidateNestedSpans(box);
    unwrapBlockWrappingSpans(box);
    normalizeTextBoxes(box);
    cleanBlankParagraphs(box);
    consolidateNestedSpans(box);
    return box.innerHTML;
  }

  function consolidateNestedSpansInHtml(html) {
    return normalizeBodyHtmlDom(html);
  }

  function prepareMagazineBodyHtml(html) {
    var out = decodeHtmlEntitiesIfNeeded(html || "")
      .replace(/\r\n/g, "\n")
      .replace(/\s+onerror="[^"]*"/gi, "")
      .replace(/\s+srcset="[^"]*"/gi, "");
    out = normalizeParagraphBreaks(out);
    out = normalizeImgSrcInHtml(out);
    out = consolidateNestedSpansInHtml(out);
    return cleanupOrphanColorSpans(promoteColorSpanToBlocks(out));
  }

  global.TiMagazineBodyHtml = {
    prepare: prepareMagazineBodyHtml,
    promoteColorSpanToBlocks: promoteColorSpanToBlocks,
    consolidateNestedSpansInHtml: consolidateNestedSpansInHtml,
    normalizeImgSrcInHtml: normalizeImgSrcInHtml
  };
})(typeof window !== "undefined" ? window : globalThis);

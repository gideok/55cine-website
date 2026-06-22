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

  /** span[style=color] > block → block[style=color] (브라우저 파싱 전 문자열 보정) */
  function promoteColorSpanToBlocks(html) {
    var out = html;
    var prev;
    do {
      prev = out;
      out = out.replace(
        /<span(\s+style="([^"]*)")[^>]*>\s*<p(\s[^>]*)?>/gi,
        function (_m, _s1, styleVal, pRest) {
          var colorM = styleVal.match(/\bcolor\s*:\s*([^;"]+)/i);
          if (!colorM) return _m;
          var color = colorM[1].trim();
          var attrs = pRest || "";
          if (/\bstyle="/i.test(attrs)) {
            if (/\bcolor\s*:/i.test(attrs)) return "<p" + attrs + ">";
            return "<p" + attrs.replace(/\bstyle="([^"]*)"/i, 'style="color: ' + color + "; $1") + ">";
          }
          return '<p style="color: ' + color + '"' + attrs + ">";
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

  function prepareMagazineBodyHtml(html) {
    return cleanupOrphanColorSpans(
      promoteColorSpanToBlocks(
        normalizeParagraphBreaks(
          decodeHtmlEntitiesIfNeeded(html || "")
            .replace(/\r\n/g, "\n")
            .replace(/\.\.\/\.\.\/images\//g, "images/")
            .replace(/\.\.\/images\//g, "images/")
            .replace(/\s+onerror="[^"]*"/gi, "")
            .replace(/\s+srcset="[^"]*"/gi, "")
        )
      )
    );
  }

  global.TiMagazineBodyHtml = {
    prepare: prepareMagazineBodyHtml,
    promoteColorSpanToBlocks: promoteColorSpanToBlocks
  };
})(typeof window !== "undefined" ? window : globalThis);

export const MAGAZINE_LIST_EXCERPT_MAX = 160;
export const MAGAZINE_TEXT_BOX_CLASS = "mz-text-box";

function isSafeMagazineHref(href: string | null | undefined): boolean {
  const h = String(href || "").trim();
  if (!h) return false;
  if (/^\s*javascript:/i.test(h)) return false;
  if (/^\s*data:/i.test(h)) return false;
  if (/^\s*vbscript:/i.test(h)) return false;
  return true;
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquo: "\u2018",
  rsquo: "\u2019",
  sbquo: "\u201A",
  bdquo: "\u201E",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  middot: "\u00B7"
};

export function decodeHtmlEntities(text: string): string {
  let out = text;
  out = out.replace(/&([a-z][a-z0-9]+);/gi, (m, name: string) => {
    const decoded = NAMED_ENTITIES[name.toLowerCase()];
    return decoded !== undefined ? decoded : m;
  });
  out = out.replace(/&#(\d+);/g, (m, dec: string) => {
    const n = Number(dec);
    return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
  });
  out = out.replace(/&#x([0-9a-f]+);/gi, (m, hex: string) => {
    const n = parseInt(hex, 16);
    return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
  });
  return out;
}

export function decodePlainTextField(text: string | null | undefined): string {
  if (!text) return "";
  return decodeHtmlEntities(String(text).trim());
}

export function stripHtmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<\/div>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  return text.replace(/\s+/g, " ").trim();
}

export function excerptFromBodyHtml(
  bodyHtml: string | null | undefined,
  maxLen = MAGAZINE_LIST_EXCERPT_MAX
): string {
  const text = stripHtmlToPlainText(bodyHtml);
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

const STRIP_STYLE_PROPS = new Set([
  "font-family",
  "font",
  "face",
  "line-height",
  "letter-spacing",
  "background",
  "background-color",
  "background-image",
  "font-weight",
  "font-style",
  "text-decoration",
  "margin",
  "padding",
  "width",
  "height"
]);

function promoteColorSpanToBlocks(html: string): string {
  let out = html;
  let prev: string;
  do {
    prev = out;
    out = out.replace(
      /<span(\s+style="([^"]*)")[^>]*>\s*<p(\s[^>]*)?>/gi,
      (_m, _s1: string, styleVal: string, pRest?: string) => {
        const fontM = styleVal.match(/\bfont-size\s*:\s*([^;"]+)/i);
        const colorM = styleVal.match(/\bcolor\s*:\s*([^;"]+)/i);
        const alignM = styleVal.match(/\btext-align\s*:\s*([^;"]+)/i);
        if (!fontM && !colorM && !alignM) return _m;
        const parts: string[] = [];
        if (fontM) parts.push(`font-size: ${fontM[1].trim()}`);
        if (colorM) parts.push(`color: ${colorM[1].trim()}`);
        if (alignM) parts.push(`text-align: ${alignM[1].trim()}`);
        const merged = parts.join("; ");
        const attrs = pRest || "";
        if (/\bstyle="/i.test(attrs)) {
          return `<p${attrs.replace(/\bstyle="([^"]*)"/i, `style="${merged}; $1`)}>`;
        }
        return `<p style="${merged}"${attrs}>`;
      }
    );
  } while (out !== prev);
  return cleanupOrphanColorSpans(out);
}

function cleanupOrphanColorSpans(html: string): string {
  return html
    .replace(/<span(\s+style="[^"]*\bcolor[^"]*")[^>]*>\s*(?=<p\b[^>]*\bstyle="[^"]*\bcolor)/gi, "")
    .replace(/(<\/p>)\s*(?:<\/span>\s*)+/gi, "$1");
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function normalizeMagazineAssetRelPath(src: string): string {
  let s = String(src || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      return s;
    }
  }
  while (/^\.\.\//.test(s)) s = s.slice(3);
  return s.replace(/^\/+/, "");
}

function convertFontColorToSpan(html: string): string {
  let out = html.replace(/<font\b([^>]*)>/gi, (_m, attrs: string) => {
    const colorAttr = attrs.match(/\bcolor=(["'])([^"']*)\1/i);
    const styleAttr = attrs.match(/\bstyle=(["'])([\s\S]*?)\1/i);
    let color = colorAttr?.[2]?.trim();
    if (!color && styleAttr) {
      const cm = styleAttr[2].match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      if (cm) color = cm[1].trim();
    }
    if (color) return `<span style="color: ${color}">`;
    return "";
  });
  out = out.replace(/<\/font>/gi, "</span>");
  return out;
}

function cleanStyleAttr(style: string): string {
  const parts = style
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const prop = p.split(":")[0]?.trim().toLowerCase() ?? "";
      if (prop === "font-size" || prop === "color" || prop === "text-align") return true;
      return !STRIP_STYLE_PROPS.has(prop);
    });
  return parts.join("; ");
}

const IMG_STYLE_PROPS = new Set([
  "width",
  "max-width",
  "height",
  "display",
  "margin-left",
  "margin-right"
]);

function cleanImgStyleAttr(style: string): string {
  const parts = style
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const prop = p.split(":")[0]?.trim().toLowerCase() ?? "";
      return IMG_STYLE_PROPS.has(prop);
    });
  return parts.join("; ");
}

const IMG_PLACEHOLDER_PREFIX = "\x00TI_IMG_";

function extractImgTags(html: string): { html: string; imgs: string[] } {
  const imgs: string[] = [];
  const withoutImgs = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const idx = imgs.length;
    imgs.push(tag);
    return `${IMG_PLACEHOLDER_PREFIX}${idx}\x00`;
  });
  return { html: withoutImgs, imgs };
}

function restoreImgTags(html: string, imgs: string[]): string {
  return html.replace(/\x00TI_IMG_(\d+)\x00/g, (_m, idx: string) => {
    const raw = imgs[Number(idx)];
    return raw ? sanitizeImgTag(raw) : "";
  });
}

function sanitizeImgTag(tag: string): string {
  return tag.replace(/<img\b([^>]*)>/gi, (_m, attrs: string) => {
    let out = attrs
      .replace(/\sdata-ti-asset-key=(["'])[^"']*\1/gi, "")
      .replace(/\son\w+=(["'])[^"']*\1/gi, "");

    const srcMatch = out.match(/\bsrc=(["'])([^"']*)\1/i);
    if (srcMatch) {
      const norm = normalizeMagazineAssetRelPath(srcMatch[2]);
      out = out.replace(srcMatch[0], ` src=${srcMatch[1]}${norm}${srcMatch[1]}`);
    }

    const styleMatch = out.match(/\bstyle=(["'])([\s\S]*?)\1/i);
    if (styleMatch) {
      const cleaned = cleanImgStyleAttr(styleMatch[2]);
      out = cleaned
        ? out.replace(styleMatch[0], ` style=${styleMatch[1]}${cleaned}${styleMatch[1]}`)
        : out.replace(styleMatch[0], "");
    }

    return `<img${out}>`;
  });
}

function sanitizeMagazineLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs: string, inner: string) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*(["'])([\s\S]*?)\1/i);
    if (!hrefMatch || !isSafeMagazineHref(hrefMatch[2])) return inner;
    const href = hrefMatch[2].trim();
    return `<a href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
  });
}

function preserveMagazineClasses(html: string): string {
  return html.replace(/\sclass=(["'])([^"']*)\1/gi, (_m, q: string, cls: string) => {
    if (/\bmz-text-box\b/i.test(cls)) return ` class=${q}${MAGAZINE_TEXT_BOX_CLASS}${q}`;
    return "";
  });
}

function normalizeParagraphBreaks(html: string): string {
  return html
    .replace(/<div(\s[^>]*)?>\s*<\/div>/gi, "<p><br></p>")
    .replace(/<div(\s[^>]*)?>\s*<br\s*\/?>\s*<\/div>/gi, "<br>")
    .replace(/<p(\s[^>]*)?>\s*<\/p>/gi, "<p$1><br></p>");
}

/** 저장용: font-size·color 유지, 인용·텍스트박스·링크·구분선 보존 */
export function sanitizeMagazineBodyHtml(html: string | null | undefined): string | null {
  if (!html) return null;

  let out = String(html);
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/on\w+=(["'])[^"']*\1/gi, "");
  out = convertFontColorToSpan(out);
  out = out.replace(/<\/?font\b[^>]*>/gi, "");

  const { html: withoutImgs, imgs } = extractImgTags(out);
  out = withoutImgs;

  out = out.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (_m, q: string, style: string) => {
    const cleaned = cleanStyleAttr(style);
    return cleaned ? ` style=${q}${cleaned}${q}` : "";
  });

  out = out.replace(/\sface=(["'])[^"']*\1/gi, "");
  out = out.replace(/\sdata-ke-size=(["'])[^"']*\1/gi, "");
  out = out.replace(/\sdata-ke-style=(["'])[^"']*\1/gi, "");

  out = preserveMagazineClasses(out);
  out = normalizeParagraphBreaks(out);
  out = promoteColorSpanToBlocks(out);
  out = cleanupOrphanColorSpans(out);
  out = sanitizeMagazineLinks(out);
  out = restoreImgTags(out, imgs);

  return out.trim() || null;
}

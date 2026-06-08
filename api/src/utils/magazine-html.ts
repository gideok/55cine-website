export const MAGAZINE_LIST_EXCERPT_MAX = 160;

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
  "color",
  "background",
  "background-color",
  "background-image",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "margin",
  "padding",
  "width",
  "height"
]);

function cleanStyleAttr(style: string, keepFontSize: boolean): string {
  const parts = style
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const prop = p.split(":")[0]?.trim().toLowerCase() ?? "";
      if (keepFontSize && prop === "font-size") return true;
      return !STRIP_STYLE_PROPS.has(prop);
    });
  return parts.join("; ");
}

/** 저장용: font-family 등 폰트·레이아웃 인라인 스타일 제거 (font-size 만 유지) */
export function sanitizeMagazineBodyHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  let out = html.replace(/<\/?font\b[^>]*>/gi, "");

  out = out.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (_m, q: string, style: string) => {
    const cleaned = cleanStyleAttr(style, true);
    return cleaned ? ` style=${q}${cleaned}${q}` : "";
  });

  out = out.replace(/\sface=(["'])[^"']*\1/gi, "");
  out = out.replace(/\sclass=(["'])[^"']*\1/gi, "");
  out = out.replace(/\sdata-ke-size=(["'])[^"']*\1/gi, "");

  return out;
}

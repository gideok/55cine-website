const ALLOWED_STYLE_PROPS = new Set(["font-size", "color"]);
export const NOTICE_LINK_CLASS = "site-notice-link";

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function isSafeNoticeHref(href: string | null | undefined): boolean {
  const h = String(href || "").trim();
  if (!h) return false;
  if (/^\s*javascript:/i.test(h)) return false;
  if (/^\s*data:/i.test(h)) return false;
  if (/^\s*vbscript:/i.test(h)) return false;
  return true;
}

function sanitizeNoticeLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs: string, inner: string) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*(["'])([\s\S]*?)\1/i);
    if (!hrefMatch || !isSafeNoticeHref(hrefMatch[2])) return inner;
    const href = hrefMatch[2].trim();
    return `<a class="${NOTICE_LINK_CLASS}" href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
  });
}

function cleanNoticeStyle(style: string): string {
  const parts = style
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const prop = p.split(":")[0]?.trim().toLowerCase() ?? "";
      return ALLOWED_STYLE_PROPS.has(prop);
    });
  return parts.join("; ");
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

/** 공지 본문 저장용 — 구분선(hr), 굵게, 글자크기·색상만 style 허용 */
export function sanitizeNoticeBodyHtml(html: string | null | undefined): string | null {
  if (!html) return null;

  let out = String(html);
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/on\w+=(["'])[^"']*\1/gi, "");
  out = convertFontColorToSpan(out);
  out = out.replace(/<\/?font\b[^>]*>/gi, "");

  out = out.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (_m, q: string, style: string) => {
    const cleaned = cleanNoticeStyle(style);
    return cleaned ? ` style=${q}${cleaned}${q}` : "";
  });

  out = out.replace(/\sclass=(["'])[^"']*\1/gi, "");
  out = out.replace(/\sface=(["'])[^"']*\1/gi, "");
  out = out.replace(/\sdata-ke-size=(["'])[^"']*\1/gi, "");

  out = sanitizeNoticeLinks(out);

  return out.trim() || null;
}

export type NoticeContentWidth = 100 | 50 | 30;

export function noticeLayoutPercents(width: NoticeContentWidth): {
  contentPct: number;
  marginPct: number;
} {
  const marginPct = 5 * (width / 100);
  const contentPct = width - marginPct * 2;
  return { contentPct, marginPct };
}

const ALLOWED_STYLE_PROPS = new Set(["font-size", "color"]);

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

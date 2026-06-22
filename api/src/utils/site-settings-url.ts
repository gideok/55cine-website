export function normalizeSiteLinkUrl(url: string | null | undefined): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  if (/^\s*(javascript|data|vbscript):/i.test(raw)) return null;
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  return `https://${raw}`;
}

export function normalizeDocumentPath(path: string | null | undefined): string | null {
  const raw = String(path || "").trim().replace(/\\/g, "/");
  if (!raw) return null;
  if (raw.includes("..")) return null;
  if (!/^documents\//i.test(raw)) return null;
  return raw;
}

export function isSafeSiteLinkUrl(url: string | null | undefined): boolean {
  return normalizeSiteLinkUrl(url) !== null;
}

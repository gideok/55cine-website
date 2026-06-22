import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import { saveUploadedFile } from "./upload.service.js";

const DOCUMENT_TEMP_PREFIX = "documents/_tmp/";
export const DONATION_DOC_PATH = "documents/donation-disclosure.pdf";

const ALLOWED_DOC_EXT = new Set([".pdf"]);

function absFromRel(rel: string): string {
  return path.join(config.repoRoot, rel.replace(/\//g, path.sep));
}

function normalizeRel(rel: string): string {
  return rel.trim().replace(/\\/g, "/");
}

function extFromFilename(filename?: string): string {
  const ext = path.extname(filename || "").toLowerCase();
  if (!ext || !ALLOWED_DOC_EXT.has(ext)) return ".pdf";
  return ext;
}

export function isSiteDocumentTempPath(rel: string): boolean {
  return normalizeRel(rel).startsWith(DOCUMENT_TEMP_PREFIX);
}

async function moveFile(srcRel: string, destRel: string): Promise<void> {
  const srcAbs = absFromRel(srcRel);
  const destAbs = absFromRel(destRel);
  if (!fs.existsSync(srcAbs)) throw new Error(`임시 파일 없음: ${srcRel}`);
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  try {
    await fs.promises.rename(srcAbs, destAbs);
  } catch {
    await fs.promises.copyFile(srcAbs, destAbs);
    await fs.promises.unlink(srcAbs);
  }
}

export async function saveSiteDocumentTempFile(
  buffer: Buffer,
  originalFilename?: string
): Promise<{ path: string; tempId: string }> {
  const tempId = randomUUID();
  const ext = extFromFilename(originalFilename);
  const rel = `${DOCUMENT_TEMP_PREFIX}${tempId}${ext}`;
  const saved = await saveUploadedFile(buffer, rel);
  return { path: saved.path, tempId };
}

export async function finalizeDonationDocument(opts: {
  donationDocTempPath?: string | null;
  removeDonationDoc?: boolean;
  existingPath?: string | null;
}): Promise<string | null> {
  if (opts.removeDonationDoc) return null;
  if (opts.donationDocTempPath && isSiteDocumentTempPath(opts.donationDocTempPath)) {
    const ext = extFromFilename(opts.donationDocTempPath);
    const dest = DONATION_DOC_PATH.replace(/\.pdf$/i, ext);
    await moveFile(opts.donationDocTempPath, dest);
    return dest;
  }
  return opts.existingPath?.trim() || null;
}

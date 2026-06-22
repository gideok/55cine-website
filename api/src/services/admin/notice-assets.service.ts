import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import { saveUploadedFile } from "./upload.service.js";

const NOTICE_TEMP_PREFIX = "images/notice/_tmp/";
const NOTICE_IMG_DIR = "images/notice";

function absFromRel(rel: string): string {
  return path.join(config.repoRoot, rel.replace(/\//g, path.sep));
}

function normalizeRel(rel: string): string {
  return rel.trim().replace(/\\/g, "/");
}

function extFromPath(rel: string): string {
  const ext = path.extname(rel).toLowerCase();
  if (!ext || ext === ".jpeg") return ".jpg";
  return ext;
}

export function isNoticeTempPath(rel: string): boolean {
  return normalizeRel(rel).startsWith(NOTICE_TEMP_PREFIX);
}

function mainImagePathForSeq(seq: number, ext = ".jpg"): string {
  return `${NOTICE_IMG_DIR}/wn_${seq}_main${ext}`;
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

export async function saveNoticeTempFile(
  buffer: Buffer,
  originalFilename?: string
): Promise<{ path: string; tempId: string }> {
  const tempId = randomUUID();
  const ext = extFromPath(originalFilename || "");
  const rel = `${NOTICE_TEMP_PREFIX}${tempId}${ext}`;
  const saved = await saveUploadedFile(buffer, rel);
  return { path: saved.path, tempId };
}

export async function finalizeNoticeMainImage(opts: {
  seq: number;
  mainImageTempPath?: string | null;
  removeMainImage?: boolean;
  existingMain?: string | null;
}): Promise<string | null> {
  if (opts.removeMainImage) return null;
  if (opts.mainImageTempPath && isNoticeTempPath(opts.mainImageTempPath)) {
    const ext = extFromPath(opts.mainImageTempPath);
    const dest = mainImagePathForSeq(opts.seq, ext);
    await moveFile(opts.mainImageTempPath, dest);
    return dest;
  }
  return opts.existingMain?.trim() || null;
}

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import { resolveUploadPath, saveUploadedFile } from "./upload.service.js";

const SP_REL_DIR = "images/special/sp";
const SPECIAL_TEMP_PREFIX = "images/special/_tmp/";

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

export function isSpecialTempPath(rel: string): boolean {
  return normalizeRel(rel).startsWith(SPECIAL_TEMP_PREFIX);
}

function isSpSeqAsset(rel: string, seq: number): boolean {
  const normalized = normalizeRel(rel);
  const name = path.posix.basename(normalized);
  return name.startsWith(`sp_${seq}_`);
}

function mainImagePathForSeq(seq: number, ext = ".jpg"): string {
  return `images/special/sp/sp_${seq}_main${ext}`;
}

function itemImagePathForSeq(specialSeq: number, itemSeq: number, ext = ".jpg"): string {
  return `images/special/sp/sp_${specialSeq}_${itemSeq}${ext}`;
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

export async function saveSpecialTempFile(
  buffer: Buffer,
  originalFilename?: string
): Promise<{ path: string; tempId: string }> {
  const tempId = randomUUID();
  const rel = resolveUploadPath("special-temp", { tempId, originalFilename });
  const saved = await saveUploadedFile(buffer, rel);
  return { path: saved.path, tempId };
}

export async function finalizeSpecialMainImage(opts: {
  seq: number;
  mainImageTempPath?: string | null;
  removeMainImage?: boolean;
  existingMain?: string | null;
}): Promise<string | null> {
  if (opts.removeMainImage) return null;
  if (opts.mainImageTempPath && isSpecialTempPath(opts.mainImageTempPath)) {
    const ext = extFromPath(opts.mainImageTempPath);
    const dest = mainImagePathForSeq(opts.seq, ext);
    await moveFile(opts.mainImageTempPath, dest);
    return dest;
  }
  return opts.existingMain?.trim() || null;
}

export async function finalizeSpecialItemImage(opts: {
  specialSeq: number;
  itemSeq: number;
  imageTempPath?: string | null;
  removeImage?: boolean;
  existingImage?: string | null;
}): Promise<string | null> {
  if (opts.removeImage) return null;
  if (opts.imageTempPath && isSpecialTempPath(opts.imageTempPath)) {
    const ext = extFromPath(opts.imageTempPath);
    const dest = itemImagePathForSeq(opts.specialSeq, opts.itemSeq, ext);
    await moveFile(opts.imageTempPath, dest);
    return dest;
  }
  return opts.existingImage?.trim() || null;
}

function collectSpSeqPaths(seq: number, dbPaths: string[]): Set<string> {
  const out = new Set<string>();
  const prefix = `sp_${seq}_`;

  for (const raw of dbPaths) {
    if (!raw) continue;
    const rel = normalizeRel(raw);
    if (isSpSeqAsset(rel, seq)) out.add(rel);
  }

  const spDirAbs = absFromRel(SP_REL_DIR);
  if (!fs.existsSync(spDirAbs)) return out;

  for (const file of fs.readdirSync(spDirAbs)) {
    if (file.startsWith(prefix)) {
      out.add(`${SP_REL_DIR}/${file}`);
    }
  }

  return out;
}

export async function deleteSpecialSpFiles(seq: number, dbPaths: string[]): Promise<void> {
  const paths = collectSpSeqPaths(seq, dbPaths);

  await Promise.all(
    [...paths].map(async (rel) => {
      const abs = absFromRel(rel);
      try {
        await fs.promises.unlink(abs);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") throw err;
      }
    })
  );
}

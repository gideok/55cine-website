import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { config } from "../../config.js";
import { resolveUploadPath, saveUploadedFile } from "./upload.service.js";

export const MAGAZINE_THUMB_WIDTH = 456;
export const MAGAZINE_THUMB_HEIGHT = 346;

const TEMP_PREFIX = "images/magazine/_tmp/";

export function isMagazineTempPath(rel: string): boolean {
  const n = rel.replace(/\\/g, "/");
  return n.startsWith(TEMP_PREFIX);
}

export async function saveMagazineTempFile(
  buffer: Buffer,
  originalFilename?: string
): Promise<{ path: string; tempId: string }> {
  const tempId = randomUUID();
  const rel = resolveUploadPath("magazine-temp", { tempId, originalFilename });
  const saved = await saveUploadedFile(buffer, rel);
  return { path: saved.path, tempId };
}

function absFromRel(rel: string): string {
  return path.join(config.repoRoot, rel.replace(/\//g, path.sep));
}

function extFromPath(rel: string): string {
  const ext = path.extname(rel).toLowerCase();
  if (!ext || ext === ".jpeg") return ".jpg";
  return ext;
}

export function coverPathForSeq(seq: number, ext = ".jpg"): string {
  return `images/magazine/body/wm_${seq}_cover${ext}`;
}

export function thumbPathForSeq(seq: number): string {
  return `images/magazine/body/wm_${seq}_thumb.jpg`;
}

export function bodyImagePathForSeq(seq: number, index: number, ext: string): string {
  return resolveUploadPath("magazine-body", {
    magazineSeq: seq,
    imageIndex: index,
    originalFilename: `img${ext}`
  });
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

async function writeThumbnailFromCover(coverRel: string, thumbRel: string): Promise<void> {
  const coverAbs = absFromRel(coverRel);
  const thumbAbs = absFromRel(thumbRel);
  fs.mkdirSync(path.dirname(thumbAbs), { recursive: true });
  await sharp(coverAbs)
    .resize(MAGAZINE_THUMB_WIDTH, MAGAZINE_THUMB_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(thumbAbs);
}

function maxBodyImageIndex(seq: number, html: string): number {
  const re = new RegExp(`wm_${seq}_(\\d+)`, "gi");
  let max = 0;
  for (const m of html.matchAll(re)) {
    const n = Number(m[1]);
    if (n > max) max = n;
  }
  return max;
}

export async function finalizeMagazineBodyHtml(
  seq: number,
  bodyHtml: string | null | undefined
): Promise<string | null> {
  if (!bodyHtml) return null;

  let html = bodyHtml;
  let nextIndex = maxBodyImageIndex(seq, html) + 1;

  const imgRe = /<img\b([^>]*?)data-ti-temp=["']([^"']+)["']([^>]*)>/gi;
  const replacements: Array<{ from: string; to: string }> = [];
  const finalizedTemps = new Map<string, string>();

  for (const match of html.matchAll(imgRe)) {
    const full = match[0];
    const tempPath = match[2].replace(/\\/g, "/");
    if (!isMagazineTempPath(tempPath)) continue;

    let finalPath = finalizedTemps.get(tempPath);
    if (!finalPath) {
      const ext = extFromPath(tempPath);
      finalPath = bodyImagePathForSeq(seq, nextIndex, ext);
      await moveFile(tempPath, finalPath);
      finalizedTemps.set(tempPath, finalPath);
      nextIndex += 1;
    }

    let attrs = `${match[1]}${match[3]}`.replace(/\sdata-ti-temp=["'][^"']*["']/i, "");
    attrs = attrs.replace(/\ssrc=["'][^"']*["']/i, "");
    const to = `<img${attrs} src="${finalPath}" alt="">`;
    replacements.push({ from: full, to });
  }

  for (const { from, to } of replacements) {
    html = html.split(from).join(to);
  }

  return html;
}

export async function finalizeMagazineCover(opts: {
  seq: number;
  coverTempPath?: string | null;
  removeCover?: boolean;
  existingCover?: string | null;
}): Promise<{ imgCover: string | null; imgThumb: string | null }> {
  const { seq, coverTempPath, removeCover, existingCover } = opts;

  if (removeCover) {
    return { imgCover: null, imgThumb: null };
  }

  if (coverTempPath && isMagazineTempPath(coverTempPath)) {
    const ext = extFromPath(coverTempPath);
    const coverRel = coverPathForSeq(seq, ext);
    const thumbRel = thumbPathForSeq(seq);
    await moveFile(coverTempPath, coverRel);
    await writeThumbnailFromCover(coverRel, thumbRel);
    return { imgCover: coverRel, imgThumb: thumbRel };
  }

  if (existingCover) {
    const coverRel = existingCover.replace(/\\/g, "/");
    const coverAbs = absFromRel(coverRel);
    if (fs.existsSync(coverAbs)) {
      const thumbRel = thumbPathForSeq(seq);
      await writeThumbnailFromCover(coverRel, thumbRel);
      return { imgCover: coverRel, imgThumb: thumbRel };
    }
  }

  return { imgCover: existingCover ?? null, imgThumb: null };
}

export function bodyHtmlHasPendingTemps(html: string | null | undefined): boolean {
  return !!html && /data-ti-temp=/i.test(html);
}

export async function applyMagazineAssets(
  seq: number,
  opts: {
    bodyHtml?: string | null;
    coverTempPath?: string | null;
    removeCover?: boolean;
    existingCover?: string | null;
    existingThumb?: string | null;
  }
): Promise<{
  bodyHtml?: string | null;
  imgCover?: string | null;
  imgThumb?: string | null;
}> {
  const out: { bodyHtml?: string | null; imgCover?: string | null; imgThumb?: string | null } = {};

  if (opts.bodyHtml !== undefined && bodyHtmlHasPendingTemps(opts.bodyHtml)) {
    out.bodyHtml = await finalizeMagazineBodyHtml(seq, opts.bodyHtml);
  }

  const touchCover = !!opts.coverTempPath || !!opts.removeCover;
  if (touchCover) {
    const cover = await finalizeMagazineCover({
      seq,
      coverTempPath: opts.coverTempPath,
      removeCover: opts.removeCover,
      existingCover: opts.existingCover ?? null
    });
    out.imgCover = cover.imgCover;
    out.imgThumb = cover.imgThumb;
  }

  return out;
}

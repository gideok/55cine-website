import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { config } from "../../config.js";
import { resolveUploadPath, saveUploadedFile } from "./upload.service.js";

export const PROGRAM_THUMB_SIZE = 40;

function absFromRel(rel: string): string {
  return path.join(config.repoRoot, rel.replace(/\//g, path.sep));
}

export function thumbPathFromPoster(posterRel: string): string {
  const base = path.basename(posterRel);
  if (!/^wp_/i.test(base)) {
    throw new Error(`잘못된 포스터 경로: ${posterRel}`);
  }
  return `images/movies/wp/thumb_${base.replace(/\.(jpe?g|png|webp)$/i, ".jpg")}`;
}

async function writeProgramThumbnail(posterRel: string, thumbRel: string): Promise<void> {
  const posterAbs = absFromRel(posterRel);
  const thumbAbs = absFromRel(thumbRel);
  fs.mkdirSync(path.dirname(thumbAbs), { recursive: true });
  await sharp(posterAbs)
    .resize(PROGRAM_THUMB_SIZE, PROGRAM_THUMB_SIZE, { fit: "cover", position: "centre" })
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(thumbAbs);
}

export async function finalizeProgramPosterUpload(
  buffer: Buffer,
  programSeq: number,
  originalFilename?: string
): Promise<{ path: string; thumbPath: string }> {
  const relPath = resolveUploadPath("program", { programSeq, originalFilename });
  const saved = await saveUploadedFile(buffer, relPath);
  const thumbRel = thumbPathFromPoster(saved.path);
  await writeProgramThumbnail(saved.path, thumbRel);
  return { path: saved.path, thumbPath: thumbRel };
}

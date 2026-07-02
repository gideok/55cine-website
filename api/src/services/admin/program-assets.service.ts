import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { config } from "../../config.js";
import { resolveUploadPath, saveUploadedFile } from "./upload.service.js";

export const PROGRAM_THUMB_SIZE = 40;

function isWindowsReplaceLockError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: unknown }).code || "") : "";
  const msg = "message" in err ? String((err as { message?: unknown }).message || "") : "";
  return (
    code === "EPERM" ||
    code === "EBUSY" ||
    code === "EACCES" ||
    code === "UNKNOWN" ||
    /operation not permitted|access is denied|resource busy|unknown error/i.test(msg)
  );
}

function withVersionSuffix(relPath: string): string {
  const normalized = String(relPath || "").replace(/\\/g, "/");
  const ext = path.extname(normalized);
  const base = ext ? normalized.slice(0, -ext.length) : normalized;
  return `${base}_u${Date.now()}${ext || ".jpg"}`;
}

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
  let saved;
  try {
    saved = await saveUploadedFile(buffer, relPath);
  } catch (err) {
    // Windows에서 기존 이미지 파일 잠금(미리보기/정적서버 핸들) 시 대체 파일명으로 저장
    if (!isWindowsReplaceLockError(err)) throw err;
    const fallbackRel = withVersionSuffix(relPath);
    saved = await saveUploadedFile(buffer, fallbackRel);
  }
  const thumbRel = thumbPathFromPoster(saved.path);
  await writeProgramThumbnail(saved.path, thumbRel);
  return { path: saved.path, thumbPath: thumbRel };
}

function guessImageExt(contentType: string | null, url: string): string {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  const m = url.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i);
  if (m) return m[1].toLowerCase() === "jpeg" ? ".jpg" : `.${m[1].toLowerCase()}`;
  return ".jpg";
}

export async function finalizeProgramPosterFromUrl(
  imageUrl: string,
  programSeq: number
): Promise<{ path: string; thumbPath: string }> {
  const url = String(imageUrl || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("포스터 URL이 올바르지 않습니다.");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`포스터 다운로드 실패 (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = guessImageExt(res.headers.get("content-type"), url);
  return finalizeProgramPosterUpload(buffer, programSeq, `kmdb_poster${ext}`);
}

import fs from "node:fs";
import path from "node:path";
import { config } from "../../config.js";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

export type UploadCategory =
  | "special-main"
  | "special-item"
  | "special-temp"
  | "magazine-body"
  | "magazine-cover"
  | "magazine-thumb"
  | "magazine-temp"
  | "program"
  | "notice-temp"
  | "notice-main";

export function resolveUploadPath(
  category: UploadCategory,
  opts: {
    specialSeq?: number;
    itemSeq?: number;
    magazineSeq?: number;
    imageIndex?: number;
    tempId?: string;
    programSeq?: number;
    noticeSeq?: number;
    originalFilename?: string;
  }
): string {
  const ext = normalizeExt(opts.originalFilename);
  switch (category) {
    case "special-main":
      if (!opts.specialSeq) throw new Error("specialSeq 필요");
      return `images/special/sp/sp_${opts.specialSeq}_main${ext}`;
    case "special-item":
      if (!opts.specialSeq || opts.itemSeq == null) throw new Error("specialSeq, itemSeq 필요");
      return `images/special/sp/sp_${opts.specialSeq}_${opts.itemSeq}${ext}`;
    case "special-temp":
      if (!opts.tempId) throw new Error("tempId 필요");
      return `images/special/_tmp/${opts.tempId}${ext}`;
    case "magazine-body":
      if (!opts.magazineSeq || opts.imageIndex == null) throw new Error("magazineSeq, imageIndex 필요");
      return `images/magazine/body/wm_${opts.magazineSeq}_${opts.imageIndex}${ext}`;
    case "magazine-cover":
      if (!opts.magazineSeq) throw new Error("magazineSeq 필요");
      return `images/magazine/body/wm_${opts.magazineSeq}_cover${ext}`;
    case "magazine-thumb":
      if (!opts.magazineSeq) throw new Error("magazineSeq 필요");
      return `images/magazine/body/wm_${opts.magazineSeq}_thumb${ext}`;
    case "magazine-temp":
      if (!opts.tempId) throw new Error("tempId 필요");
      return `images/magazine/_tmp/${opts.tempId}${ext}`;
    case "program":
      if (!opts.programSeq) throw new Error("programSeq 필요");
      return `images/movies/wp/wp_${opts.programSeq}_1${ext}`;
    case "notice-temp":
      if (!opts.tempId) throw new Error("tempId 필요");
      return `images/notice/_tmp/${opts.tempId}${ext}`;
    case "notice-main":
      if (!opts.noticeSeq) throw new Error("noticeSeq 필요");
      return `images/notice/wn_${opts.noticeSeq}_main${ext}`;
    default:
      throw new Error(`Unknown category: ${category}`);
  }
}

function normalizeExt(filename?: string): string {
  const ext = path.extname(filename || "").toLowerCase();
  if (!ext || !ALLOWED_EXT.has(ext)) return ".jpg";
  return ext === ".jpeg" ? ".jpg" : ext;
}

export async function saveUploadedFile(
  buffer: Buffer,
  relativePath: string
): Promise<{ path: string; absolutePath: string }> {
  const rel = relativePath.replace(/\\/g, "/");
  const abs = path.join(config.repoRoot, rel.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, buffer);
  return { path: rel, absolutePath: abs };
}

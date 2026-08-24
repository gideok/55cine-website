"""릴리스 tarball 패키징 공통 로직."""
from __future__ import annotations

import tarfile
from pathlib import Path

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "documents",
    "tmp",
    ".claude",
    "deploy/.cache",
    "release",
}
EXCLUDE_FILES = {
    ".env",
    ".env.local",
    # 운영 서버 이벤트 상태(당첨자 수·로그) — 로컬 파일로 덮어쓰지 않음
    "data/cat-treasure-event.json",
}


def should_skip(rel: str, *, exclude_images: bool = False) -> bool:
    if exclude_images and (rel == "images" or rel.startswith("images/")):
        return True
    parts = Path(rel).parts
    if parts and parts[0] in EXCLUDE_DIRS:
        return True
    if "node_modules" in parts:
        return True
    if rel in EXCLUDE_FILES:
        return True
    if rel.endswith(".log"):
        return True
    if "/.cache" in rel or rel.startswith("api/.tmp"):
        return True
    return False


def build_tarball(root: Path, tar_path: Path, *, exclude_images: bool = False) -> float:
    """tar.gz 생성. 반환: MB 크기."""
    label = "no-images" if exclude_images else "full"
    print(f"[pack:{label}] {root} -> {tar_path}")
    with tarfile.open(tar_path, "w:gz") as tf:
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if should_skip(rel, exclude_images=exclude_images):
                continue
            tf.add(path, arcname=rel)
    size_mb = tar_path.stat().st_size / (1024 * 1024)
    print(f"[pack:{label}] done ({size_mb:.1f} MB)")
    return size_mb

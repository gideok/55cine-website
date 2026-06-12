#!/usr/bin/env python3
"""CI·로컬 공용 릴리스 tarball 생성."""
from __future__ import annotations

import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "release"
OUT_FILE = OUT_DIR / "55cine-deploy.tar.gz"

EXCLUDE_DIRS = {".git", "node_modules", "documents", "tmp", ".claude", "release"}
EXCLUDE_FILES = {".env", ".env.local"}


def should_skip(rel: str) -> bool:
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


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with tarfile.open(OUT_FILE, "w:gz") as tf:
        for path in ROOT.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(ROOT).as_posix()
            if should_skip(rel):
                continue
            tf.add(path, arcname=rel)
    mb = OUT_FILE.stat().st_size / (1024 * 1024)
    print(f"created {OUT_FILE} ({mb:.1f} MB)")


if __name__ == "__main__":
    main()

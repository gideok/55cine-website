#!/usr/bin/env python3
"""CI·로컬 공용 릴리스 tarball 생성."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "release"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack_lib import build_tarball  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="55cine 릴리스 tarball 생성")
    parser.add_argument(
        "--no-images",
        action="store_true",
        help="images/ 폴더 제외 (HTML/CSS/JS/API만)",
    )
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_name = "55cine-deploy-no-images.tar.gz" if args.no_images else "55cine-deploy.tar.gz"
    out_file = OUT_DIR / out_name
    build_tarball(ROOT, out_file, exclude_images=args.no_images)
    print(f"created {out_file}")


if __name__ == "__main__":
    main()

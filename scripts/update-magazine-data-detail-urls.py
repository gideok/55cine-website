#!/usr/bin/env python3
"""data/*.js 목록의 detailUrl을 article-detail.html?id= 형식으로 갱신."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

UPDATES = [
    (
        ROOT / "data" / "gv-moment-data.js",
        "gm",
        "magazine/gv-moment/article-detail.html?id=",
    ),
    (
        ROOT / "data" / "magazine-serial-data.js",
        "sr",
        "magazine/serial/article-detail.html?id=",
    ),
]


def patch_file(path: Path, prefix: str, url_base: str) -> None:
    text = path.read_text(encoding="utf-8")
    blocks = re.split(r"(\n  \{)", text)
    out = [blocks[0]]
    for i in range(1, len(blocks), 2):
        sep = blocks[i]
        block = blocks[i + 1] if i + 1 < len(blocks) else ""
        id_m = re.search(r'"id":\s*(\d+)', block)
        if id_m:
            n = int(id_m.group(1))
            slug = f"{prefix}{n:03d}"
            block = re.sub(
                r'"detailUrl":\s*"[^"]*"',
                f'"detailUrl": "{url_base}{slug}"',
                block,
                count=1,
            )
        out.append(sep + block)
    path.write_text("".join(out), encoding="utf-8")
    print("updated", path.relative_to(ROOT))


def main() -> None:
    for path, prefix, url_base in UPDATES:
        patch_file(path, prefix, url_base)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""HTML <link> 경로 수정 및 CSS 번들 삽입."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", "test", ".claude", "node_modules"}


def depth_to_css_prefix(html_path: Path) -> str:
    rel = html_path.parent.relative_to(ROOT)
    if str(rel) == ".":
        return "css/"
    n = len(rel.parts)
    return ("../" * n) + "css/"


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    text = text.replace('href="../components/site-common.css"', 'href="components/site-common.css"')

    prefix = depth_to_css_prefix(path)
    base = prefix + "base/utilities.css"
    head = prefix + "components/section-page-head.css"
    sd = prefix + "components/sd-prev-next-magazine.css"

    # utilities: 오오극장 5페이지
    theater_pages = {
        "theater-info.html",
        "viewing-guide.html",
        "membership.html",
        "daegwan.html",
        "osinneun-gil.html",
    }
    if path.name in theater_pages and base not in text:
        text = text.replace(
            f'<link rel="stylesheet" href="{prefix}site-footer.css" />',
            f'<link rel="stylesheet" href="{prefix}site-footer.css" />\n'
            f'  <link rel="stylesheet" href="{base}" />',
            1,
        )

    # section-page-head: site-common + subnav 페이지
    subnav_pages = theater_pages | {
        "magazine-preview.html",
        "magazine-past-articles.html",
        "magazine-serial.html",
        "gv-moment.html",
    }
    if path.name in subnav_pages and head not in text:
        needle = 'href="components/site-common.css"'
        if needle in text:
            text = text.replace(
                f'<link rel="stylesheet" href="{needle[6:-1]}" />',
                f'<link rel="stylesheet" href="components/site-common.css" />\n'
                f'  <link rel="stylesheet" href="{head}" />',
                1,
            )

    # sd-prev-next: 매거진 상세
    if "article-detail.html" in path.name and sd not in text:
        text = text.replace(
            f'<link rel="stylesheet" href="{prefix}detail.css" />',
            f'<link rel="stylesheet" href="{prefix}detail.css" />\n'
            f'  <link rel="stylesheet" href="{sd}" />',
            1,
        )

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for p in ROOT.rglob("*.html"):
        if any(part in SKIP for part in p.parts):
            continue
        if patch_file(p):
            print("patched", p.relative_to(ROOT))
            changed += 1
    print("done", changed, "files")


if __name__ == "__main__":
    main()

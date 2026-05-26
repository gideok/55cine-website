#!/usr/bin/env python3
"""shell·now-playing 분할 후 HTML <link> 보강."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", "test", ".claude", "node_modules"}


def css_prefix(html_path: Path) -> str:
    rel = html_path.parent.relative_to(ROOT)
    if str(rel) == ".":
        return "css/"
    return ("../" * len(rel.parts)) + "css/"


def insert_after(text: str, needle: str, insert: str) -> str:
    if insert.strip() in text:
        return text
    idx = text.find(needle)
    if idx == -1:
        return text
    end = idx + len(needle)
    return text[:end] + insert + text[end:]


def patch(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text
    p = css_prefix(path)

    shell = f'<link rel="stylesheet" href="{p}shell.css" />'
    shell_extra = (
        f'\n  <link rel="stylesheet" href="{p}components/shell-mobile-menu.css" />'
        f'\n  <link rel="stylesheet" href="{p}components/shell-scroll-top.css" />'
    )
    text = insert_after(text, shell, shell_extra)

    np = f'<link rel="stylesheet" href="{p}now-playing.css" />'
    np_extra = (
        f'\n  <link rel="stylesheet" href="{p}components/np-movie-grid.css" />'
        f'\n  <link rel="stylesheet" href="{p}components/np-search-toolbar.css" />'
    )
    text = insert_after(text, np, np_extra)

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    n = 0
    for html in ROOT.rglob("*.html"):
        if any(part in SKIP for part in html.parts):
            continue
        if patch(html):
            print("patched", html.relative_to(ROOT))
            n += 1
    print("done", n)


if __name__ == "__main__":
    main()

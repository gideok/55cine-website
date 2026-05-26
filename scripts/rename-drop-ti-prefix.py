#!/usr/bin/env python3
"""css/js/partials/special 내 ti- 접두어 파일명 제거 및 참조 갱신."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", ".claude", "node_modules", "test"}

RENAME_ROOTS = [
    ROOT / "css",
    ROOT / "js",
    ROOT / "partials",
    ROOT / "special",
]

TEXT_GLOBS = ("*.html", "*.js", "*.css", "*.md", "*.py", "*.mjs")


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    return bool(parts & SKIP_DIRS)


def collect_ti_files() -> list[Path]:
    files: list[Path] = []
    for base in RENAME_ROOTS:
        if not base.is_dir():
            continue
        for p in base.rglob("ti-*"):
            if p.is_file() and not should_skip(p):
                files.append(p)
    return sorted(files, key=lambda p: len(p.name), reverse=True)


def new_name(path: Path) -> Path:
    return path.with_name(path.name[3:])  # strip "ti-"


def git_mv(src: Path, dst: Path) -> None:
    if dst.exists():
        raise SystemExit(f"target exists: {dst}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "mv", str(src), str(dst)], cwd=ROOT, check=True)


def iter_text_files():
    for p in ROOT.rglob("*"):
        if not p.is_file() or should_skip(p):
            continue
        if p.suffix.lower() in {".html", ".js", ".css", ".md", ".py", ".mjs"}:
            yield p


def main() -> None:
    ti_files = collect_ti_files()
    pairs = [(p, new_name(p)) for p in ti_files]
    print(f"rename {len(pairs)} files")
    for src, dst in pairs:
        print(f"  {src.relative_to(ROOT)} -> {dst.relative_to(ROOT)}")
        git_mv(src, dst)

    # longest names first to avoid partial replacement issues
    replacements: list[tuple[str, str]] = []
    for src, dst in sorted(pairs, key=lambda x: len(x[0].name), reverse=True):
        old = src.name
        new = dst.name
        replacements.append((old, new))
        # path variants
        old_posix = src.as_posix().replace(str(ROOT.as_posix()) + "/", "")
        new_posix = dst.as_posix().replace(str(ROOT.as_posix()) + "/", "")
        if old_posix != old:
            replacements.append((old_posix.replace("\\", "/"), new_posix.replace("\\", "/")))

    changed = 0
    for path in iter_text_files():
        if path == Path(__file__).resolve():
            continue
        text = path.read_text(encoding="utf-8")
        original = text
        for old, new in replacements:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
            print(f"updated {path.relative_to(ROOT)}")

    print(f"done: {len(pairs)} renames, {changed} text files")


if __name__ == "__main__":
    main()

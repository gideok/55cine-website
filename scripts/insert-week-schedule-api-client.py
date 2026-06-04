#!/usr/bin/env python3
"""week-schedule-data.js 앞에 js/api/client.js 스크립트 태그 삽입"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = 'src="js/api/client.js"'
INSERT = '  <script src="{rel}js/api/client.js"></script>\n'


def rel_prefix(html_path: Path) -> str:
    depth = len(html_path.relative_to(ROOT).parts) - 1
    return "../" * depth if depth else ""


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if MARKER in text or "js/api/client.js" in text:
        return False
    needle = '<script src="'
    targets = (
        'data/week-schedule-data.js',
        "../data/week-schedule-data.js",
        "../../data/week-schedule-data.js",
    )
    for target in targets:
        tag = f'<script src="{target}"></script>'
        if tag not in text:
            continue
        rel = rel_prefix(path)
        insertion = INSERT.format(rel=rel)
        text = text.replace(tag, insertion + tag, 1)
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = []
    for path in sorted(ROOT.rglob("*.html")):
        if "node_modules" in path.parts:
            continue
        content = path.read_text(encoding="utf-8")
        if "week-schedule-data.js" not in content:
            continue
        if patch_file(path):
            changed.append(path.relative_to(ROOT))
    print(f"Updated {len(changed)} files")
    for p in changed:
        print(" -", p)


if __name__ == "__main__":
    main()

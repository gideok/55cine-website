#!/usr/bin/env python3
"""Phase 3: movie-detail CSS 분리·slug URL 단일화·HTML/data 갱신."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", "test", ".claude", "node_modules", "mcps"}

OLD_CSS = '<link rel="stylesheet" href="../../css/movie-detail-test.css" />'
NEW_CSS = (
    '  <link rel="stylesheet" href="../../css/components/movie-detail-panel.css" />\n'
    "  <link rel=\"stylesheet\" href=\"../../css/components/movie-detail-theme.css\" />"
)
OLD_CSS_EX = '<link rel="stylesheet" href="../../css/movie-detail-test.css" />'
# exhibition/event use same href depth


def query_detail_url(slug: str) -> str:
    return f"movies/now-playing/movie-detail.html?slug={slug}"


def patch_html(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text
    text = text.replace("ti-md-test-wrap", "ti-md-theme")
    if "movie-detail-test.css" in text:
        text = text.replace(OLD_CSS, NEW_CSS)
        text = text.replace(
            '<link rel="stylesheet" href="../../css/movie-detail-test.css" />',
            NEW_CSS,
        )
    if path.name == "now-playing.html" and 'detailUrlMode: "seo"' in text:
        text = text.replace('detailUrlMode: "seo"', 'detailUrlMode: "query"')
    if orig != text:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def strip_list_detail_urls(data: dict) -> bool:
    changed = False
    for m in data.get("movies", []):
        if "detailUrl" in m:
            del m["detailUrl"]
            changed = True
    return changed


def patch_js_detail_urls(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text

    def repl(m: re.Match[str]) -> str:
        slug = m.group(1)
        return f'detailUrl: "{query_detail_url(slug)}"'

    text = re.sub(
        r'detailUrl:\s*"movies/now-playing/([a-z0-9-]+)\.html"',
        repl,
        text,
    )
    text = re.sub(
        r'"detailUrl":\s*"movies/now-playing/([a-z0-9-]+)\.html"',
        lambda m: f'"detailUrl": "{query_detail_url(m.group(1))}"',
        text,
    )
    if orig != text:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    md_test = ROOT / "css/movie-detail-test.css"
    if md_test.exists():
        md_test.unlink()
        print("deleted css/movie-detail-test.css")

    np_md = ROOT / "css/now-playing-movie-detail.css"
    t = np_md.read_text(encoding="utf-8")
    t2 = t.replace("ti-md-test-wrap", "ti-md-theme")
    if t2 != t:
        np_md.write_text(t2, encoding="utf-8")
        print("updated now-playing-movie-detail.css")

    ex_css = ROOT / "special/exhibition/css/exhibition-detail.css"
    t = ex_css.read_text(encoding="utf-8")
    t2 = t.replace("ti-md-test-wrap", "ti-md-theme")
    if t2 != t:
        ex_css.write_text(t2, encoding="utf-8")

    n_html = 0
    for html in ROOT.rglob("*.html"):
        if any(p in SKIP for p in html.parts):
            continue
        if patch_html(html):
            n_html += 1

    # 기획전·행사: movie-detail-theme 미사용 — dead link 제거
    for rel in (
        "special/exhibition/exhibition_detail.html",
        "special/event/event_detail.html",
    ):
        p = ROOT / rel
        text = p.read_text(encoding="utf-8")
        new = text.replace(
            '  <link rel="stylesheet" href="../../css/movie-detail-test.css" />\n', ""
        ).replace(
            '  <link rel="stylesheet" href="../../css/components/movie-detail-panel.css" />\n'
            '  <link rel="stylesheet" href="../../css/components/movie-detail-theme.css" />\n',
            "",
        )
        if new != text:
            p.write_text(new, encoding="utf-8")
            n_html += 1
            print("trimmed unused movie-detail CSS from", rel)

    for rel in (
        "movies/now-playing/data/now-playing-list.json",
        "movies/now-playing/data/upcoming-list.json",
        "movies/now-playing/data/past-list.json",
    ):
        p = ROOT / rel
        if not p.exists():
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        if strip_list_detail_urls(data):
            p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print("stripped detailUrl from", rel)

    for rel in ("data/week-schedule-data.js", "data/now-playing-data.js"):
        p = ROOT / rel
        if p.exists() and patch_js_detail_urls(p):
            print("updated", rel)

    # generate script reference
    gen = ROOT / "scripts/generate-now-playing-movie-tests.mjs"
    if gen.exists():
        t = gen.read_text(encoding="utf-8")
        t2 = (
            t.replace("ti-md-test-wrap", "ti-md-theme")
            .replace("movie-detail-test.css", "components/movie-detail-panel.css")
        )
        if "movie-detail-theme.css" not in t2:
            t2 = t2.replace(
                "components/movie-detail-panel.css",
                "components/movie-detail-panel.css' />\n  <link rel=\"stylesheet\" href=\"../../css/components/movie-detail-theme.css",
                1,
            )
        if t2 != t:
            gen.write_text(t2, encoding="utf-8")
            print("updated generate-now-playing-movie-tests.mjs")

    print("patched", n_html, "html files")


if __name__ == "__main__":
    main()

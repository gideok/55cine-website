#!/usr/bin/env python3
"""Move test/ layout to site root, strip test-/test-ti- prefixes, update references."""
from __future__ import annotations

import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST = ROOT / "test"

HTML_RENAMES = {
    "test-intro.html": "index.html",
    "now-playing-test.html": "now-playing.html",
    "past-playing-test.html": "past-playing.html",
    "upcoming-playing-test.html": "upcoming-playing.html",
    "special-exhibition-test.html": "special-exhibition.html",
    "special-event-test.html": "special-event.html",
    "magazine-preview-test.html": "magazine-preview.html",
    "magazine-serial-test.html": "magazine-serial.html",
    "gv-moment-test.html": "gv-moment.html",
    "magazine-past-articles-test.html": "magazine-past-articles.html",
}

LEGACY_REMOVE = [
    "index.html",
    "movie-detail.html",
    "movie-detail-type2.html",
    "now-playing.html",
    "gv-moment.html",
    "magazine-preview.html",
    "magazine-serial.html",
    "special-exhibition.html",
    "theater-info.html",
    "viewing-guide.html",
    "membership.html",
    "daegwan.html",
    "osinneun-gil.html",
    "membership_old.html",
    "theater-info_old.html",
    "css/index.css",
]

TEXT_EXT = {".html", ".js", ".css", ".mjs", ".json", ".md"}


def strip_prefix_name(name: str) -> str:
    if name.startswith("test-ti-"):
        return name[len("test-ti-") :]
    if name.startswith("test-"):
        return name[len("test-") :]
    return name


def replace_content(text: str) -> str:
    pairs = [
        ("test-ti-", "ti-"),
        ("TEST_TI_", "TI_"),
        ("__TI_TEST_ROOT__", "__TI_SITE_ROOT__"),
        ("test-intro.html", "index.html"),
        ("now-playing-test.html", "now-playing.html"),
        ("past-playing-test.html", "past-playing.html"),
        ("upcoming-playing-test.html", "upcoming-playing.html"),
        ("special-exhibition-test.html", "special-exhibition.html"),
        ("special-event-test.html", "special-event.html"),
        ("magazine-preview-test.html", "magazine-preview.html"),
        ("magazine-serial-test.html", "magazine-serial.html"),
        ("gv-moment-test.html", "gv-moment.html"),
        ("magazine-past-articles-test.html", "magazine-past-articles.html"),
        ("movie-detail-test.html", "movies/now-playing/movie-detail.html"),
        ('href="test/', 'href="'),
        ("'/test/", "'/"),
        ('"/test/', '"/'),
        ("../test/", "../"),
        ("../../test/", "../../"),
        ("../../../test/", "../../../"),
        ("test/special/", "special/"),
        ("test/movies/", "movies/"),
        ("test/magazine/", "magazine/"),
        ("test/partials/", "partials/"),
        ("test/css/", "css/"),
        ("test/js/", "js/"),
        ("test/scripts/", "scripts/"),
    ]
    for old, new in pairs:
        text = text.replace(old, new)
    # paths like movies/now-playing/data from test depth
    text = re.sub(
        r'window\.TI_ASSET_BASE\s*=\s*["\']\.\./["\']',
        'window.TI_ASSET_BASE = ""',
        text,
    )
    text = re.sub(
        r'data-ti-asset-base="\.\./"',
        'data-ti-asset-base=""',
        text,
        flags=re.I,
    )
    text = text.replace(
        "movie-detail.html",
        "movies/now-playing/movie-detail.html",
    )
    text = text.replace(
        "movie-detail-type2.html",
        "movies/now-playing/movie-detail.html",
    )
    return text


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def copy_tree(src: Path, dst: Path, rename_file=None) -> None:
    if not src.exists():
        return
    for root, dirs, files in os.walk(src):
        rel = Path(root).relative_to(src)
        out_dir = dst / rel
        out_dir.mkdir(parents=True, exist_ok=True)
        for f in files:
            s = Path(root) / f
            name = rename_file(f) if rename_file else f
            d = out_dir / name
            if s.suffix.lower() in TEXT_EXT:
                write_text(d, replace_content(s.read_text(encoding="utf-8", errors="replace")))
            else:
                shutil.copy2(s, d)


def move_test_html_to_root() -> None:
    for src_name, dst_name in HTML_RENAMES.items():
        src = TEST / src_name
        if not src.exists():
            continue
        content = replace_content(src.read_text(encoding="utf-8", errors="replace"))
        content = content.replace(
            'name="ti-nav-current" content="test-intro.html"',
            'name="ti-nav-current" content="index.html"',
        )
        for old in HTML_RENAMES:
            if old == "test-intro.html":
                continue
            content = content.replace(
                f'name="ti-nav-current" content="{old}"',
                f'name="ti-nav-current" content="{HTML_RENAMES[old]}"',
            )
        write_text(ROOT / dst_name, content)

    for name in [
        "theater-info.html",
        "viewing-guide.html",
        "membership.html",
        "daegwan.html",
        "osinneun-gil.html",
    ]:
        src = TEST / name
        if src.exists():
            write_text(
                ROOT / name,
                replace_content(src.read_text(encoding="utf-8", errors="replace")),
            )


def main() -> None:
    if not TEST.exists():
        print("test/ not found, skip")
        return

    for rel in LEGACY_REMOVE:
        p = ROOT / rel
        if p.is_file():
            p.unlink()
            print("removed legacy", rel)

    copy_tree(TEST / "css", ROOT / "css", strip_prefix_name)
    copy_tree(TEST / "js", ROOT / "js", strip_prefix_name)
    copy_tree(TEST / "partials", ROOT / "partials")
    copy_tree(TEST / "scripts", ROOT / "scripts", strip_prefix_name)
    copy_tree(TEST / "magazine", ROOT / "magazine")
    copy_tree(TEST / "movies", ROOT / "movies")
    copy_tree(TEST / "special", ROOT / "special")

    move_test_html_to_root()

    # ti-left-gnb home link
    gnb = ROOT / "partials" / "ti-left-gnb.html"
    if gnb.exists():
        t = gnb.read_text(encoding="utf-8")
        t = t.replace("__TI_SITE_ROOT__test-intro.html", "__TI_SITE_ROOT__index.html")
        t = t.replace("__TI_SITE_ROOT__index.html", "__TI_SITE_ROOT__index.html")
        write_text(gnb, t)

    # week-schedule movie detail fallbacks
    wsd = ROOT / "data" / "week-schedule-data.js"
    if wsd.exists():
        write_text(wsd, replace_content(wsd.read_text(encoding="utf-8", errors="replace")))

    spd = ROOT / "data" / "special-program-data.js"
    if spd.exists():
        write_text(spd, replace_content(spd.read_text(encoding="utf-8", errors="replace")))

    epd = ROOT / "data" / "event-program-data.js"
    if epd.exists():
        write_text(epd, replace_content(epd.read_text(encoding="utf-8", errors="replace")))

    # left-gnb include path logic (no /test/)
    inc = ROOT / "js" / "ti-left-gnb-include.js"
    if inc.exists():
        t = inc.read_text(encoding="utf-8")
        t = t.replace(
            """  function computePathPrefixes() {
    var path = (location.pathname || "").replace(/\\\\/g, "/");
    var lower = path.toLowerCase();
    var needle = "/test/";
    var i = lower.indexOf(needle);
    if (i === -1) {
      return { testRoot: "", siteRoot: "../" };
    }
    var rest = path.slice(i + needle.length);
    var segments = rest.split("/").filter(Boolean);
    var depth = Math.max(0, segments.length - 1);
    var testRoot = depth > 0 ? new Array(depth).fill("..").join("/") + "/" : "";
    var siteDepth = depth + 1;
    var siteRoot = new Array(siteDepth).fill("..").join("/") + "/";
    return { testRoot: testRoot, siteRoot: siteRoot };
  }""",
            """  function computePathPrefixes() {
    var path = (location.pathname || "").replace(/\\\\/g, "/");
    var segments = path.split("/").filter(Boolean);
    var depth = segments.length;
    if (depth && /\\.html?$/i.test(segments[depth - 1])) {
      depth = Math.max(0, depth - 1);
    }
    var siteRoot = depth > 0 ? new Array(depth).fill("..").join("/") + "/" : "";
    return { testRoot: siteRoot, siteRoot: siteRoot };
  }""",
        )
        t = t.replace("test/partials/", "partials/")
        t = t.replace("test-ti-", "ti-")
        write_text(inc, t)

    print("refactor complete")


if __name__ == "__main__":
    main()

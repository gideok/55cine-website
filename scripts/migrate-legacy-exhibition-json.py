#!/usr/bin/env python3
"""
special/exhibition/special-detail-NN.html → special/exhibition/data/exhibition-e000NNN.json
program id N maps to exhibition id e000NNN (zero-padded 6 digits).

id=3 (11주년 특별전): 기존 exhibition-e000001.json 의 films 스키마를 e000003 으로 이전.
"""
from __future__ import annotations

import html as html_lib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXH_DIR = ROOT / "special" / "exhibition"
DATA_DIR = EXH_DIR / "data"
BOOKING_URL = (
    "https://www.dtryx.com/cinema/main.do?"
    "cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059"
)


def decode_entities(text: str) -> str:
    return html_lib.unescape(text or "")


def strip_tags(fragment: str) -> str:
    return re.sub(r"<[^>]+>", "", fragment or "").strip()


def exhibition_id(n: int) -> str:
    return f"e{n:06d}"


def parse_special_detail(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")

    title_m = re.search(
        r'<h1[^>]*class="detail-title"[^>]*>([\s\S]*?)</h1>', raw, re.I
    )
    title = decode_entities(strip_tags(title_m.group(1) if title_m else ""))

    meta_m = re.search(r'<p class="detail-meta">([\s\S]*?)</p>', raw, re.I)
    meta = decode_entities(strip_tags(meta_m.group(1) if meta_m else ""))

    img_m = re.search(
        r'<figure class="detail-cover"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"',
        raw,
        re.I,
    )
    image_src = img_m.group(1) if img_m else ""
    image = re.sub(r"^\.\./\.\./", "", image_src).lstrip("/")

    body_m = re.search(r'<section class="detail-body">([\s\S]*?)</section>', raw, re.I)
    body_html = body_m.group(1) if body_m else ""
    paragraphs = re.findall(r"<p[^>]*>([\s\S]*?)</p>", body_html, re.I)
    intro_parts = []
    for p in paragraphs:
        text = decode_entities(strip_tags(p))
        if text and text != "관련":
            intro_parts.append(text)
    introduction = "\n\n".join(intro_parts)

    return {
        "title": title,
        "meta": meta,
        "image": image,
        "introduction": introduction,
    }


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    films_donor = DATA_DIR / "exhibition-e000001.json"
    films_payload = None
    if films_donor.is_file():
        films_payload = json.loads(films_donor.read_text(encoding="utf-8"))
        if films_payload.get("films"):
            print("preserve films from", films_donor.name, "→ e000003")

    for n in range(1, 25):
        eid = exhibition_id(n)
        legacy = EXH_DIR / f"special-detail-{n:02d}.html"
        out = DATA_DIR / f"exhibition-{eid}.json"

        if n == 3 and films_payload and films_payload.get("films"):
            parsed = parse_special_detail(legacy) if legacy.is_file() else {}
            payload = {
                "id": eid,
                "title": parsed.get("title") or films_payload.get("title", ""),
                "image": "images/special/exhibition/special_exhibition_thumb_03.png",
                "introduction": parsed.get("introduction")
                or films_payload.get("introduction", ""),
                "bookingUrl": films_payload.get("bookingUrl", BOOKING_URL),
                "films": films_payload["films"],
            }
            write_json(out, payload)
            print("wrote", out.name, "(with films)")
            continue

        if not legacy.is_file():
            print("skip missing", legacy.name)
            continue

        parsed = parse_special_detail(legacy)
        payload = {
            "id": eid,
            "title": parsed["title"],
            "image": parsed["image"] or f"images/special/exhibition/special_exhibition_thumb_{n:02d}.png",
            "introduction": parsed["introduction"],
            "bookingUrl": BOOKING_URL,
            "films": [],
        }
        write_json(out, payload)
        print("wrote", out.name)

    update_special_program_data_js()


def update_special_program_data_js() -> None:
    data_js = ROOT / "data" / "special-program-data.js"
    text = data_js.read_text(encoding="utf-8")
    blocks = re.split(r"(\n  \{)", text)
    if len(blocks) < 2:
        raise SystemExit("special-program-data.js parse failed")

    out = [blocks[0]]
    for i in range(1, len(blocks), 2):
        sep = blocks[i]
        block = blocks[i + 1] if i + 1 < len(blocks) else ""
        id_m = re.search(r'"id":\s*(\d+)', block)
        if id_m:
            pid = int(id_m.group(1))
            eid = exhibition_id(pid)
            block = re.sub(
                r'"detailUrl":\s*"[^"]*"',
                f'"detailUrl": "special/exhibition/exhibition_detail.html?id={eid}"',
                block,
                count=1,
            )
        out.append(sep + block)
    data_js.write_text("".join(out), encoding="utf-8")
    print("updated", data_js.relative_to(ROOT))


if __name__ == "__main__":
    main()

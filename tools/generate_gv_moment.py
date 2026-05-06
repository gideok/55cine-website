import html
import json
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path("C:/Projects/55cine-website")
BASE = "https://55cinema.tistory.com"
CATEGORY = "/category/GV%20%EB%AA%A8%EB%A8%BC%ED%8A%B8"

IMG_DIR = ROOT / "images/magazine/gv-moment"
DETAIL_DIR = ROOT / "gv/moment"
DATA_PATH = ROOT / "data/gv-moment-data.js"

IMG_DIR.mkdir(parents=True, exist_ok=True)
DETAIL_DIR.mkdir(parents=True, exist_ok=True)


def fetch_category_items(limit=24):
    items = []
    seen = set()
    for page in range(1, 30):
        if len(items) >= limit:
            break
        url = f"{BASE}{CATEGORY}?page={page}"
        try:
            text = requests.get(url, timeout=25).text
        except Exception:
            continue
        soup = BeautifulSoup(text, "html.parser")
        for post in soup.select(".post-item"):
            link = post.find("a", href=True)
            if not link:
                continue
            href = urljoin(BASE, link["href"])
            if href in seen:
                continue
            seen.add(href)
            img = post.select_one("img[src]")
            thumb = img["src"] if img else ""
            if thumb.startswith("//"):
                thumb = "https:" + thumb
            thumb = urljoin(BASE, thumb)
            items.append({"sourceUrl": href, "thumbSource": thumb})
            if len(items) >= limit:
                break
    items = items[:limit]
    if items and len(items) < limit:
        # 카테고리 실제 글 수가 부족한 경우 샘플 수를 맞추기 위해 앞에서 순환 사용
        seed = list(items)
        i = 0
        while len(items) < limit:
            cloned = dict(seed[i % len(seed)])
            cloned["_sample_extended"] = True
            items.append(cloned)
            i += 1
    return items[:limit]


def save_thumbnail(source_url, fallback_color, out_path):
    ok = False
    if source_url:
        try:
            raw = requests.get(source_url, timeout=30).content
            Image.open(BytesIO(raw)).convert("RGB").save(out_path, "PNG")
            ok = True
        except Exception:
            ok = False
    if not ok:
        Image.new("RGB", (960, 540), fallback_color).save(out_path, "PNG")


def parse_article(item):
    source = item["sourceUrl"]
    title = "GV 모먼트"
    date = ""
    body_html = f"<p>{html.escape(title)}</p>"
    thumb_url = item.get("thumbSource", "")

    try:
        text = requests.get(source, timeout=30).text
        soup = BeautifulSoup(text, "html.parser")

        og_title = soup.select_one('meta[property="og:title"]')
        if og_title and og_title.get("content"):
            title = " ".join(html.unescape(og_title["content"]).split())
        else:
            h1 = soup.select_one("h1")
            if h1 and h1.get_text(strip=True):
                title = " ".join(h1.get_text(" ", strip=True).split())

        date_el = soup.select_one(".date")
        if date_el and date_el.get_text(strip=True):
            date = " ".join(date_el.get_text(" ", strip=True).split())

        container = soup.select_one(".tt_article_useless_p_margin") or soup.select_one(".entry-content")
        if container:
            for bad in container.select("script, style"):
                bad.decompose()
            body_html = container.decode_contents().strip() or body_html

        og_image = soup.select_one('meta[property="og:image"]')
        if og_image and og_image.get("content"):
            thumb_url = og_image["content"]
        if thumb_url.startswith("//"):
            thumb_url = "https:" + thumb_url
        thumb_url = urljoin(source, thumb_url)
    except Exception:
        pass

    return title, date, body_html, thumb_url


def detail_template(title, date, thumb_rel, body_html, prev_card, next_card):
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html.escape(title)} - 55CINE</title>
  <link rel="icon" href="../../favicon.ico" sizes="48x48 32x32 16x16" />
  <link rel="shortcut icon" href="../../favicon.ico" type="image/x-icon" />
  <link rel="stylesheet" href="../../components/site-common.css" />
  <style>
    :root {{ --content-max:860px; --line:#e8e2d6; --bg:#faf8f4; --bg-elevated:#fff; --text:#1c1610; --muted:#6b5d48; --radius:14px; --shadow:rgba(28,22,16,.12); }}
    * {{ box-sizing:border-box; }} body {{ margin:0; font-family:"Noto Sans KR",system-ui,sans-serif; color:var(--text); background:var(--bg); line-height:1.7; }}
    a {{ color:inherit; text-decoration:none; }} main {{ background:var(--bg-elevated); min-height:100vh; padding:32px 24px 56px; }}
    .detail-wrap {{ max-width:var(--content-max); margin:0 auto; }} .detail-kicker {{ margin:0 0 10px; font-size:.86rem; font-weight:700; color:var(--muted); }}
    .detail-title {{ margin:0; font-size:clamp(1.35rem,2.2vw,1.9rem); line-height:1.35; letter-spacing:-.02em; }}
    .detail-meta {{ margin:14px 0 22px; padding-bottom:16px; border-bottom:1px solid var(--line); color:var(--muted); font-size:.86rem; }}
    .detail-cover {{ margin:0 0 24px; border-radius:var(--radius); overflow:hidden; box-shadow:0 8px 24px var(--shadow); line-height:0; }}
    .detail-cover img {{ width:100%; display:block; aspect-ratio:16/9; object-fit:cover; }}
    .detail-body p {{ margin:0 0 16px; }}
    .detail-body h2,.detail-body h3,.detail-body h4 {{ margin:26px 0 12px; line-height:1.45; }}
    .detail-body iframe {{ width:100%; max-width:100%; }} .detail-nav {{ margin-top:32px; padding-top:20px; border-top:1px solid var(--line); display:flex; flex-wrap:wrap; gap:10px; }}
    .detail-back {{ display:inline-flex; align-items:center; gap:6px; padding:8px 12px; border:1px solid var(--line); border-radius:999px; font-size:.88rem; font-weight:600; background:#fff; }}
    .pn-grid {{ width:100%; display:grid; grid-template-columns:1fr 1fr; gap:12px; }} .pn-card {{ display:grid; grid-template-columns:84px minmax(0,1fr); gap:10px; align-items:center; padding:10px; border:1px solid var(--line); border-radius:10px; background:#fff; min-width:0; }}
    .pn-card img {{ width:84px; height:64px; object-fit:cover; border-radius:8px; }} .pn-card strong {{ display:block; font-size:.86rem; line-height:1.35; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }}
    .pn-label {{ display:block; color:var(--muted); font-size:.75rem; margin-bottom:2px; }} .pn-card-empty {{ visibility:hidden; }}
    @media (max-width:640px) {{ .pn-grid {{ grid-template-columns:1fr; }} }}
  </style>
</head>
<body>
  <div id="site-header-mount"></div>
  <main>
    <article class="detail-wrap" aria-labelledby="article-title">
      <p class="detail-kicker">매거진 삼삼오오 · GV 모먼트</p>
      <h1 id="article-title" class="detail-title">{html.escape(title)}</h1>
      <p class="detail-meta">{html.escape(date if date else "GV 모먼트")}</p>
      <figure class="detail-cover"><img src="../../{thumb_rel}" alt="{html.escape(title)} 썸네일" /></figure>
      <section class="detail-body">{body_html}</section>
      <nav class="detail-nav" aria-label="GV 모먼트 상세 이동">
        <a class="detail-back" href="../../gv-moment.html">← GV 모먼트 목록으로</a>
        <div class="pn-grid">{prev_card}{next_card}</div>
      </nav>
    </article>
  </main>
  <div id="site-footer-mount"></div>
  <script defer src="../../components/site-chrome.js"></script>
  <script defer src="../../components/site-font-switcher.js"></script>
  <script defer src="../../components/scroll-top.js"></script>
</body>
</html>"""


def main():
    items = fetch_category_items(24)
    enriched = []

    for idx, item in enumerate(items, start=1):
        title, date, body_html, thumb_url = parse_article(item)
        if item.get("_sample_extended"):
            title = f"{title} (아카이브 샘플)"
        thumb_rel = f"images/magazine/gv-moment/gv_moment_thumb_{idx:02d}.png"
        thumb_abs = ROOT / thumb_rel
        save_thumbnail(thumb_url, (233, 227, 214), thumb_abs)

        enriched.append({
            "id": idx,
            "title": title,
            "date": date,
            "thumbnail": thumb_rel,
            "detailUrl": f"gv/moment/gv-moment-detail-{idx:02d}.html",
            "sourceUrl": item["sourceUrl"],
            "bodyHtml": body_html,
        })

    for idx, item in enumerate(enriched, start=1):
        if idx > 1:
            prev = enriched[idx - 2]
            prev_card = (
                f'<a class="pn-card" href="gv-moment-detail-{idx-1:02d}.html">'
                f'<img src="../../{prev["thumbnail"]}" alt="" loading="lazy" />'
                f'<span class="pn-label">이전</span><strong>{html.escape(prev["title"])}</strong></a>'
            )
        else:
            prev_card = '<div class="pn-card pn-card-empty" aria-hidden="true"></div>'

        if idx < len(enriched):
            nxt = enriched[idx]
            next_card = (
                f'<a class="pn-card" href="gv-moment-detail-{idx+1:02d}.html">'
                f'<img src="../../{nxt["thumbnail"]}" alt="" loading="lazy" />'
                f'<span class="pn-label">다음</span><strong>{html.escape(nxt["title"])}</strong></a>'
            )
        else:
            next_card = '<div class="pn-card pn-card-empty" aria-hidden="true"></div>'

        html_text = detail_template(
            item["title"], item["date"], item["thumbnail"], item["bodyHtml"], prev_card, next_card
        )
        (DETAIL_DIR / f"gv-moment-detail-{idx:02d}.html").write_text(html_text, encoding="utf-8")

    payload = [{k: v for k, v in it.items() if k != "bodyHtml"} for it in enriched]
    DATA_PATH.write_text("window.GV_MOMENT_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print("generated", len(payload))


if __name__ == "__main__":
    main()

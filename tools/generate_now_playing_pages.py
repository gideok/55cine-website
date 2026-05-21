# -*- coding: utf-8 -*-
"""Generate data/now-playing-data.js and movies/now-playing/*.html (movie-detail.html 레이아웃 기준)."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOKING = (
    "https://www.dtryx.com/cinema/main.do?"
    "cgid=FE8EF4D2-F22D-4802-A39A-D58F23A29C1E&BrandCd=indieart&CinemaCd=000059"
)


def fmt_schedule_date(mmdd_dow: str, year: int = 2026) -> str:
    """MM.DD.(요일) — year 인자는 하위 호환용으로 유지(표시에는 사용하지 않음)."""
    m = re.match(r"(\d{2})/(\d{2})\(([^)]+)\)", mmdd_dow)
    if not m:
        return mmdd_dow
    mm, dd, w = m.groups()
    return f"{mm}.{dd}.({w})"


def badges_from_raw(pairs: list[tuple[str, str]], year: int = 2026) -> list[dict[str, str]]:
    out = []
    for d, t in pairs:
        out.append({"date": fmt_schedule_date(d, year), "time": t})
    return out


RATING_PICTOGRAMS: list[tuple[str, str]] = [
    ("전체관람가", "rate_all.png"),
    ("12세이상관람가", "rate_12.png"),
    ("12세이상 관람가", "rate_12.png"),
    ("15세이상관람가", "rate_15.png"),
    ("15세이상 관람가", "rate_15.png"),
    ("청소년관람불가", "rate_19.png"),
    ("19세이상관람가", "rate_19.png"),
]


def format_movie_info_html(info: str, images_prefix: str = "../../images/") -> str:
    for rating_label, filename in RATING_PICTOGRAMS:
        suffix = f" · {rating_label}"
        if info.endswith(suffix):
            base = info[: -len(suffix)]
        elif info.endswith(rating_label):
            base = info[: -len(rating_label)].rstrip(" ·")
        else:
            continue
        base_esc = html.escape(base)
        img = (
            f'<img class="movie-rating-pictogram" src="{images_prefix}{filename}" '
            f'width="24" height="24" alt="{html.escape(rating_label)}" decoding="async" />'
        )
        return f"{base_esc} · {img}" if base_esc else img
    return html.escape(info)


MOVIES: list[dict] = [
    {
        "slug": "riddle-of-fire",
        "titleKo": "달걀 원정대",
        "titleEn": "Riddle of Fire",
        "director": "웨스턴 라줄리",
        "cast": "리오 팁턴, 찰스 핼포드, 찰리 스토버",
        "info": "드라마 · 115분 · 12세이상관람가",
        "release": "2026.4.29",
        "sourceUrl": "http://55cine.com/2026/04/29/riddle-of-fire/",
        "youtubeId": "lQdFU-QF8FQ",
        "synopsis": (
            "동네의 소문난 꼬마 악동들 ‘앨리스, 헤이즐, 조디’. 고대하던 비디오 게임을 드디어 손에 넣지만, "
            "굳게 잠긴 TV 화면 앞에서 좌절한다. 암호를 알아낼 방법은 단 하나, 엄마를 위한 맛있는 블루베리 파이를 구해올 것! "
            "파이 품절 대란 속에서 아이들은 직접 베이킹에 나서지만 가장 중요한 재료인 달걀마저 정체불명의 남자에게 도둑맞고 만다. "
            "달걀을 되찾기 위해 미지의 숲으로 뛰어든 셋은 수상한 마녀와 신비로운 소녀를 마주하며 예상치 못한 사건에 휘말리게 되는데…"
        ),
        "scheduleRaw": [
            ("05/06(수)", "19:15"),
            ("05/08(금)", "20:05"),
            ("05/09(토)", "11:30"),
            ("05/10(일)", "15:25"),
            ("05/12(화)", "20:05"),
            ("05/13(수)", "16:10"),
        ],
    },
    {
        "slug": "the-day-she-returns",
        "titleKo": "그녀가 돌아온 날",
        "titleEn": "The Day She Returns",
        "director": "홍상수",
        "cast": "송선미, 조윤희, 박미소, 김선진, 오윤수, 강소이, 하성국, 신석호",
        "info": "드라마 · 84분 40초 · 15세이상관람가",
        "release": "2026.4.24",
        "sourceUrl": "http://55cine.com/2026/04/24/the-day-she-returns/",
        "youtubeId": "LJu5eGAQGtY",
        "synopsis": (
            "결혼 후 연기를 안 하게 되었고, 이혼 후 다시 일을 하기 위해 독립영화를 한 편 찍었다. "
            "오늘 그 찍은 영화의 개봉을 위해 인터뷰를 한다. 중년의 나이가 돼서 아주 오랜만에 세상에 배우로 얼굴을 내미는 날이다. "
            "세 번의 인터뷰가 삼십분 간격으로 이어지고 여자는 질문들에 최선을 다해서 답한다. 인터뷰 후에 새로 시작한 연기수업에 가게 된다. "
            "거기서 연기 선생은 오늘 있은 인터뷰를 다시 재현해보라고 한다. 인터뷰 중에 가장 중요한 부분에 다다르면 여자는 왠일인지 기억이 전혀 나지 않는 것 같다. "
            "피곤하고 집으로 빨리 돌아가고 싶다. 딸이 기다리고 있다."
        ),
        "scheduleRaw": [
            ("05/06(수)", "17:30"),
            ("05/07(목)", "20:20"),
            ("05/08(금)", "18:25"),
            ("05/09(토)", "17:15"),
            ("05/10(일)", "13:45"),
            ("05/11(월)", "13:40"),
            ("05/12(화)", "18:25"),
            ("05/13(수)", "12:40"),
        ],
    },
    {
        "slug": "tango-at-dawn",
        "titleKo": "새벽의 Tango",
        "titleEn": "Tango at Dawn",
        "director": "김효은",
        "cast": "이연(지원), 권소현, 박한솔, 오경주, 박서은, 진수",
        "info": "드라마 · 116분 43초 · 15세이상관람가",
        "release": "2026.4.13",
        "sourceUrl": "http://55cine.com/2026/04/13/tango-at-dawn/",
        "youtubeId": "45J1UqlyTKc",
        "synopsis": (
            "믿었던 친구의 배신으로 깊은 상처를 입은 ‘지원‘. 세상으로부터 도망치듯 들어간 공장에서 누구보다 긍정과 다정함의 힘을 믿는 룸메이트 ‘주희‘를 만나는데, "
            "갑자기 ‘Tango’를 함께 추자는 제안이 부담스럽기만 하다. 하지만 ‘지원’은 자신을 기다리며 건네는 ‘주희‘의 서툰 스텝을 따라가며 굳게 닫았던 마음의 문을 용기 내어 조금씩 열기 시작한다. "
            "마침내 다시 누군가를 믿어보려던 찰나, 어린 조장 ‘한별’이 일으킨 사고에 ‘주희’와 함께 휘말린 ‘지원’의 일상은 흔들리기 시작하는데… "
            "차가운 새벽 같은 삶에 따뜻한 햇살처럼 다가온 ‘Tango’. 완벽하지 않아도 괜찮다고 말할 수 있는 첫 스텝이 시작된다!"
        ),
        "scheduleRaw": [
            ("05/01(금)", "17:25"),
            ("05/02(토)", "15:30"),
            ("05/03(일)", "11:30"),
            ("05/04(월)", "15:10"),
            ("05/05(화)", "13:10"),
            ("05/06(수)", "11:15"),
            ("05/09(토)", "14:00 GV"),
            ("05/11(월)", "11:30"),
            ("05/12(화)", "15:35"),
        ],
    },
    {
        "slug": "the-voice-of-hind-rajab",
        "titleKo": "힌드의 목소리",
        "titleEn": "The Voice of Hind Rajab",
        "director": "카우타르 벤 하니야",
        "cast": "사자 킬라니, 모타즈 말히스, 아메르 흘레헬, 클라라 코우리 등",
        "info": "드라마 · 88분 55초 · 15세이상관람가",
        "release": "2026.4.4",
        "sourceUrl": "http://55cine.com/2026/04/04/the-voice-of-hind-rajab/",
        "youtubeId": "gHT94hQd6Ys",
        "synopsis": (
            "2024년 1월 29일, 가자지구에 대피 명령이 떨어진 날 6살 소녀로부터 1통의 신고가 접수된다. "
            "“나한테 총을 쏘고 있어요, 제발 데리러 와 주세요.” 적십자사는 구조대와 단 8분 거리에 있는 ‘힌드’를 구하기 위해 조정 절차를 이어가지만 구조 작전은 무려 5시간 동안 이어지는데…"
        ),
        "scheduleRaw": [
            ("05/05(화)", "15:25"),
            ("05/07(목)", "18:30"),
            ("05/09(토)", "18:55"),
            ("05/10(일)", "17:35"),
            ("05/13(수)", "18:20"),
        ],
    },
    {
        "slug": "the-yeast",
        "titleKo": "누룩",
        "titleEn": "The Yeast",
        "director": "장동윤",
        "cast": "김승윤(다슬), 송지혁(다현), 박명훈(아빠)",
        "info": "드라마 · 83분 36초 · 15세이상관람가",
        "release": "2026.4.4",
        "sourceUrl": "http://55cine.com/2026/04/04/the-yeast/",
        "youtubeId": "e8TMxXtKjtI",
        "synopsis": (
            "동네 사람들만 아는 소문난 양조장 집 딸이자 막걸리를 사랑하는 열여덟 소녀 ‘다슬’이 어느 날 막걸리의 맛이 변한 걸 느끼고 "
            "막걸리의 주재료인 사라진 누룩을 찾아 나서며 벌어지는 특별한 이야기."
        ),
        "scheduleRaw": [
            ("05/04(월)", "13:30"),
            ("05/05(화)", "11:30"),
            ("05/06(수)", "15:45"),
            ("05/07(목)", "13:35"),
            ("05/08(금)", "16:10"),
            ("05/09(토)", "20:40"),
            ("05/11(월)", "15:20"),
            ("05/12(화)", "13:50"),
            ("05/13(수)", "11:00"),
        ],
    },
    {
        "slug": "have-you-seen-the-land-of-the-red",
        "titleKo": "빨간 나라를 보았니",
        "titleEn": "Have You Seen the Land of the Red?",
        "director": "홍주현",
        "cast": "임미애, 김현권, 박규환, 이영수, 황태성",
        "info": "다큐멘터리 · 117분 · 12세이상관람가",
        "release": "2026.4.4",
        "sourceUrl": "http://55cine.com/2026/04/04/have-you-seen-the-land-of-the-red/",
        "youtubeId": "DAQKs_d70B0",
        "synopsis": (
            "당선 확률 0%! 험지에서 펼쳐지는 선거는 어떤 모습일까? 2022년 윤석열 대통령이 당선된 이후 치러진 전국지방동시선거! "
            "민주당 험지인 경북에서는 국민의 힘 이철우 지사의 무투표 당선이 이야기되고 있었다. 그러나 이에 맞서 모두가 출마를 말리는 선거에 뛰어든 임미애 후보! 그리고 예상 밖의 선전! "
            "그녀의 득표율은 이재명 후보 득표율을 넘어설 수 있을까… 2024년 국회의원 선거. 빨간 나라 경북의 지는 선거에 또 뛰어드는 파란 후보들! "
            "윤석열 심판과 채상병 특검이 뒤흔든 분위기는 민주당에 유리하지만, 경북도 그럴까? 이번에는 다를 것 같은 기분이 든다. 이 판을 뒤집을 수 있을까?"
        ),
        "scheduleRaw": [
            ("04/30(목)", "11:30"),
            ("05/04(월)", "17:25"),
            ("05/08(금)", "11:30"),
        ],
    },
    {
        "slug": "dear-juhee",
        "titleKo": "주희에게",
        "titleEn": "Dear Juhee",
        "director": "장주희, 부성필, 김성환",
        "cast": "철규, 인숙, 성필 등(다큐 주인공)",
        "info": "다큐멘터리 · 103분 48초 · 12세이상관람가",
        "release": "2026.4.4",
        "sourceUrl": "http://55cine.com/2026/04/04/dear-juhee/",
        "youtubeId": "UBoNaW5bqQA",
        "synopsis": (
            "세상의 속도대로 갈 수 없는 철규. 그리고 아직도 해결되지 않은 과거로 현재를 사는 인숙. 그리고 그 두 사람으로 인해 다큐멘터리 감독으로 살아가게 된 성필. "
            "이 세 사람의 삶은 암을 경험했던 이십대의 주희에게, 그리고 가정폭력 피해자에서 현재는 활동가가 된 주희에게, 영화가 늘 실패의 경험이었던 주희에게 삶의 동기가 되었다. "
            "자신의 의존해야 할 부양자로부터 겪은 폭력과 신체적 고통 속에서 생존하기 위해 자신의 삶을 타인의 것처럼 방관했던 주희는 결국엔 이 영화의 연출로써 이야기를 써내려가는 주체로, "
            "그리고 세 사람들과 연결되며 자기 자신으로 살아가는 것이 무엇인지 찾아가게 된다."
        ),
        "scheduleRaw": [("05/11(월)", "17:00 (종영)")],
    },
    {
        "slug": "the-world-of-love",
        "titleKo": "세계의 주인",
        "titleEn": "The World of Love",
        "director": "윤가은",
        "cast": "서수빈, 장혜진, 김정식, 강채윤, 이재희, 김예창",
        "info": "드라마 · 119분 3초 · 12세이상관람가",
        "release": "2025.10.13",
        "sourceUrl": "http://55cine.com/2025/10/13/the-world-of-love/",
        "youtubeId": "cm7y2k9pFOU",
        "synopsis": (
            "반장, 모범생, 학교 인싸인 동시에 연애가 가장 큰 관심사인 열여덟 ‘이주인’. 어느 날, 반 친구 ‘수호’가 제안한 서명운동에 전교생이 동참하던 중 오직 ‘주인’만이 내용에 동의할 수 없다며 나 홀로 서명을 거부한다. "
            "어떻게든 설득하려는 ‘수호’와 단호한 ‘주인’의 실랑이가 결국 말싸움으로 번지고, 화가 난 ‘주인’이 아무렇게나 질러버린 한마디가 주변을 혼란에 빠뜨린다. 설상가상, ‘주인’을 추궁하는 익명의 쪽지가 배달되기 시작하는데……. "
            "인싸? 관종? 허언증? 거짓말쟁이? “이주인, 뭐가 진짜 너야?”"
        ),
        "scheduleRaw": [
            ("05/08(금)", "13:50"),
            ("05/10(일)", "11:30"),
            ("05/11(월)", "19:00 GV"),
            ("05/12(화)", "11:30"),
        ],
    },
    {
        "slug": "teaching-practice",
        "titleKo": "교생실습",
        "titleEn": "Teaching Practice: Idiot Girls and School Ghost 2",
        "director": "김민하",
        "cast": "한선화, 홍예지, 여름, 이화원, 유선호",
        "info": "코미디, 공포(호러) · 94분 40초 · 12세이상관람가",
        "release": "2026.5.2",
        "sourceUrl": "http://55cine.com/2026/05/02/teaching-practice/",
        "youtubeId": "nPZipr49Otk",
        "synopsis": (
            "엄청난 포부와 사명감을 안고 모교로 부임한 열혈 교생 은경. 어느 날, 은경은 기묘한 분위기의 교내 흑마술 동아리 ‘쿠로이소라’의 "
            "세 소녀 아오이, 리코, 하루카를 만나게 되고, 모의고사 전국 1등을 놓치지 않는다는 이들의 비밀을 파헤치려 한다. "
            "모의고사 전국 1등의 비밀은 흑마술?! 방과 후, 어둠의 세계에서 죽음의 모의고사가 시작된다!"
        ),
        "scheduleRaw": [
            ("05/13(수)", "14:20"),
            ("05/13(수)", "20:05"),
            ("05/14(목)", "18:15"),
            ("05/15(금)", "15:00"),
            ("05/16(토)", "11:30"),
            ("05/17(일)", "19:20"),
            ("05/18(월)", "17:40"),
            ("05/19(화)", "14:25"),
            ("05/20(수)", "10:30"),
            ("05/21(목)", "13:15"),
            ("05/25(월)", "20:00"),
            ("05/26(화)", "11:00"),
        ],
    },
    {
        "slug": "namtaeryeong",
        "titleKo": "남태령",
        "titleEn": "The Longest Night: Namtaeryeong",
        "director": "김현지",
        "cast": "—",
        "info": "다큐멘터리 · 113분 51초 · 12세이상관람가",
        "release": "2026.5.20",
        "sourceUrl": "http://55cine.com/2026/05/11/namtaeryeong/",
        "youtubeId": "a0VpGTJiBgA",
        "synopsis": (
            "좋아요, 리트윗, 북마크로 열린 우연한 광장에서, 가로막히고 얼어붙은 고갯길에서, 동짓밤을 함께 하며 우리는 서로의 동지가 되었다. "
            "체감온도 영하 20도의 ‘긴긴밤’은, 그렇게 가장 ‘밝은 밤’이 됐다. 변방의 트위터리안이 모은 남태령 탐사 기록."
        ),
        "scheduleRaw": [
            ("05/20(수)", "12:20"),
            ("05/20(수)", "18:10"),
            ("05/21(목)", "17:10"),
            ("05/22(금)", "16:10"),
            ("05/23(토)", "13:45"),
            ("05/24(일)", "15:35"),
            ("05/25(월)", "11:30"),
            ("05/26(화)", "12:50"),
            ("05/27(수)", "18:05"),
        ],
    },
    {
        "slug": "nirvanna-the-band-the-show-the-movie",
        "titleKo": "너바나 더 밴드",
        "titleEn": "Nirvanna the Band the Show the Movie",
        "director": "맷 존슨",
        "cast": "맷 존슨, 제이 맥캐럴",
        "info": "코미디, 어드벤처, SF · 100분 1초 · 12세이상관람가",
        "release": "2026.5.20",
        "sourceUrl": "http://55cine.com/2026/05/11/nirvanna-the-band-the-show-the-movie/",
        "youtubeId": "V6drU2EcIow",
        "synopsis": (
            "전설적 밴드 ‘너바나’와는 별로 관련이 없어 보이는 ‘너바나 더 밴드’의 콤비 맷과 제이. "
            "어느 날 이들은 공연을 위해 타임 머신을 만들자는 황당한 계획을 세우고 처음 만났던 17년 전으로 돌아가기로 하는데…"
        ),
        "scheduleRaw": [
            ("05/20(수)", "14:30"),
            ("05/20(수)", "20:20"),
            ("05/21(목)", "15:10"),
            ("05/23(토)", "15:55"),
            ("05/24(일)", "13:40"),
            ("05/25(월)", "15:50"),
            ("05/26(화)", "20:20"),
            ("05/27(수)", "15:50"),
        ],
    },
]


DETAIL_TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html_title}</title>
  <meta name="description" content="{meta_desc}" />
  <link rel="icon" href="../../favicon.ico" sizes="48x48 32x32 16x16" />
  <link rel="shortcut icon" href="../../favicon.ico" type="image/x-icon" />
  <link rel="stylesheet" href="../../components/site-common.css" />
  <link rel="stylesheet" href="../../components/movie-detail-layout.css" />
</head>
<body>
  <div id="site-header-mount"></div>

  <main>
    <section class="section-movie-detail" aria-labelledby="movie-detail-page-title">
      <p class="np-back"><a href="../../now-playing.html">현재 상영작 목록</a></p>
      <h2 class="section-title" id="movie-detail-page-title">{title_h2}</h2>
      <div class="movie-detail-grid">
        <div class="movie-detail-c1 movie-detail-box">
          <div class="movie-detail-box-inner">
            <img class="movie-detail-poster" src="{poster_src}" width="260" height="368" alt="{poster_alt}" decoding="async" />
          </div>
        </div>
        <div class="movie-detail-c2 movie-detail-box">
          <div class="movie-detail-box-inner">
            <dl class="movie-detail-meta">
              <div class="meta-row">
                <dt>감독</dt>
                <dd>{director}</dd>
              </div>
              <div class="meta-row">
                <dt>출연</dt>
                <dd>{cast}</dd>
              </div>
              <div class="meta-row">
                <dt>정보</dt>
                <dd class="movie-detail-info">{info}</dd>
              </div>
              <div class="meta-row">
                <dt>개봉</dt>
                <dd>{release}</dd>
              </div>
            </dl>
            <a class="md2-booking-btn" href="{booking}" target="_blank" rel="noopener noreferrer" aria-label="{title_ko} 예매하기">예매하기</a>
          </div>
        </div>
        <div class="movie-detail-c3 movie-detail-box">
          <div class="movie-detail-box-inner">
            <div class="movie-detail-tabs" role="tablist" aria-label="영화 정보 탭">
              <button type="button" class="movie-detail-tab" role="tab" id="{tab_syn_id}" aria-selected="true" aria-controls="{panel_syn_id}">줄거리</button>
              <button type="button" class="movie-detail-tab" role="tab" id="{tab_tr_id}" aria-selected="false" aria-controls="{panel_tr_id}" tabindex="-1">예고</button>
            </div>
            <div id="{panel_syn_id}" class="movie-detail-tabpanel" role="tabpanel" aria-labelledby="{tab_syn_id}">
              <p class="movie-detail-synopsis">{synopsis}</p>
            </div>
            <div id="{panel_tr_id}" class="movie-detail-tabpanel" role="tabpanel" aria-labelledby="{tab_tr_id}" hidden>
              <div class="movie-detail-trailer-frame">
                <iframe
                  src="https://www.youtube.com/embed/{youtube_id}"
                  title="「{title_ko}」 예고편"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                  loading="lazy"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
        <div class="movie-detail-c4 movie-detail-box">
          <div class="movie-detail-box-inner">
            <h3 class="movie-detail-schedule-title">상영시간표</h3>
            <p class="ref-note" style="margin:-6px 0 12px;">오오극장 공식 사이트 기준 · 변경될 수 있습니다.</p>
            <div class="movie-detail-badge-grid">
{badges_html}
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <div id="site-footer-mount"></div>

  <script defer src="../../components/site-chrome.js"></script>
  <script defer src="../../components/site-font-switcher.js"></script>
  <script defer src="../../components/scroll-top.js"></script>
  <script>
    (function () {{
      function runApp() {{
        var gnbToggle = document.getElementById("gnbToggle");
        var gnbPanel = document.getElementById("gnb-panel");
        if (gnbToggle && gnbPanel) {{
          gnbToggle.addEventListener("click", function () {{
            var open = gnbPanel.classList.toggle("is-open");
            gnbToggle.setAttribute("aria-expanded", open ? "true" : "false");
            gnbToggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
            if (!open) {{
              gnbPanel.querySelectorAll(".gnb-item.is-open").forEach(function (li) {{
                li.classList.remove("is-open");
              }});
            }}
          }});
          gnbPanel.querySelectorAll(".gnb-depth2 a").forEach(function (a) {{
            a.addEventListener("click", function () {{
              if (window.matchMedia("(max-width: 900px)").matches) {{
                gnbPanel.classList.remove("is-open");
                gnbToggle.setAttribute("aria-expanded", "false");
                gnbToggle.setAttribute("aria-label", "메뉴 열기");
                gnbPanel.querySelectorAll(".gnb-item.is-open").forEach(function (li) {{
                  li.classList.remove("is-open");
                }});
              }}
            }});
          }});
        }}
        document.querySelectorAll(".gnb-item > .gnb-depth1").forEach(function (depth1) {{
          depth1.addEventListener("click", function (e) {{
            if (!window.matchMedia("(max-width: 900px)").matches) return;
            var panel = document.getElementById("gnb-panel");
            if (!panel || !panel.classList.contains("is-open")) return;
            var item = depth1.closest(".gnb-item");
            if (!item || !item.querySelector(".gnb-dropdown")) return;
            e.preventDefault();
            var wasOpen = item.classList.contains("is-open");
            document.querySelectorAll(".gnb-item.is-open").forEach(function (li) {{
              li.classList.remove("is-open");
            }});
            if (!wasOpen) item.classList.add("is-open");
          }});
        }});

        var movieTabSynopsis = document.getElementById("{tab_syn_id}");
        var movieTabTrailer = document.getElementById("{tab_tr_id}");
        var moviePanelSynopsis = document.getElementById("{panel_syn_id}");
        var moviePanelTrailer = document.getElementById("{panel_tr_id}");
        if (movieTabSynopsis && movieTabTrailer && moviePanelSynopsis && moviePanelTrailer) {{
          function activateMovieDetailTab(which) {{
            var isSynopsis = which === "synopsis";
            movieTabSynopsis.setAttribute("aria-selected", isSynopsis ? "true" : "false");
            movieTabTrailer.setAttribute("aria-selected", !isSynopsis ? "true" : "false");
            movieTabSynopsis.tabIndex = isSynopsis ? 0 : -1;
            movieTabTrailer.tabIndex = !isSynopsis ? 0 : -1;
            moviePanelSynopsis.hidden = !isSynopsis;
            moviePanelTrailer.hidden = isSynopsis;
          }}
          movieTabSynopsis.addEventListener("click", function () {{
            activateMovieDetailTab("synopsis");
          }});
          movieTabTrailer.addEventListener("click", function () {{
            activateMovieDetailTab("trailer");
          }});
        }}
      }}
      var needsSiteChrome = document.getElementById("site-header-mount") || document.getElementById("site-footer-mount");
      if (needsSiteChrome) {{
        document.addEventListener("sitechrome:ready", runApp, {{ once: true }});
        document.addEventListener("sitechrome:error", runApp, {{ once: true }});
      }} else {{
        runApp();
      }}
    }})();
  </script>
</body>
</html>
"""


def badge_html(b: dict[str, str]) -> str:
    aria = html.escape(f'{b["date"]} {b["time"]} 예매')
    return (
        f'              <a class="movie-detail-time-badge" href="{BOOKING}" '
        f'target="_blank" rel="noopener noreferrer" aria-label="{aria}">\n'
        f'                <span class="badge-date">{html.escape(b["date"])}</span>\n'
        f'                <span class="badge-time">{html.escape(b["time"])}</span>\n'
        f"              </a>"
    )


def build_public_movie(m: dict) -> dict:
    poster = f"images/movies/now-playing/{m['slug']}-poster.jpg"
    detail = f"movies/now-playing/{m['slug']}.html"
    return {
        "slug": m["slug"],
        "titleKo": m["titleKo"],
        "titleEn": m["titleEn"],
        "poster": poster,
        "detailUrl": detail,
    }


def main() -> None:
    out_dir = ROOT / "movies" / "now-playing"
    out_dir.mkdir(parents=True, exist_ok=True)

    public_list = []
    for m in MOVIES:
        badges = badges_from_raw(m["scheduleRaw"], 2026)
        badges_html = "\n".join(badge_html(b) for b in badges)
        poster_src = f"../../images/movies/now-playing/{m['slug']}-poster.jpg"
        synopsis_esc = html.escape(m["synopsis"])
        sid = m["slug"]
        tab_syn_id = f"movie-tab-synopsis-{sid}"
        tab_tr_id = f"movie-tab-trailer-{sid}"
        panel_syn_id = f"movie-tabpanel-synopsis-{sid}"
        panel_tr_id = f"movie-tabpanel-trailer-{sid}"
        page = DETAIL_TEMPLATE.format(
            html_title=html.escape(f"{m['titleKo']} ({m['titleEn']}) — 현재 상영작 — 55CINE"),
            meta_desc=html.escape(m["synopsis"][:160].replace("\n", " ") + "…"),
            title_h2=html.escape(m["titleKo"]),
            poster_src=poster_src,
            poster_alt=html.escape(f"{m['titleKo']} 포스터"),
            director=html.escape(m["director"]),
            cast=html.escape(m["cast"]),
            info=format_movie_info_html(m["info"]),
            release=html.escape(m["release"]),
            booking=BOOKING,
            title_ko=html.escape(m["titleKo"]),
            synopsis=synopsis_esc,
            youtube_id=html.escape(m["youtubeId"]),
            badges_html=badges_html,
            tab_syn_id=tab_syn_id,
            tab_tr_id=tab_tr_id,
            panel_syn_id=panel_syn_id,
            panel_tr_id=panel_tr_id,
        )
        (out_dir / f"{m['slug']}.html").write_text(page, encoding="utf-8")
        public_list.append(build_public_movie(m))

    js_path = ROOT / "data" / "now-playing-data.js"
    dumped = json.dumps(public_list, ensure_ascii=False, indent=2)
    dumped = dumped.replace("</", "<\\/")
    js_path.write_text(
        "/** 현재 상영작 목록 — now-playing.html 에서 사용 */\n"
        f"window.NOW_PLAYING_MOVIES = {dumped};\n",
        encoding="utf-8",
    )
    print("Wrote", js_path, "and", len(MOVIES), "detail pages under", out_dir)


if __name__ == "__main__":
    main()

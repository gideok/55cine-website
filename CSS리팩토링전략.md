# CSS 리팩토링 전략

> **전제:** [리팩토링전략.md](./리팩토링전략.md) 1단계(`test/` → 루트, `test-ti-*` → `ti-*`)는 완료되었다.  
> **파일명 정리(2026-05):** `css/`·`js/`·`partials/`·`special/**`에서 **`ti-` 파일 접두어 제거** 완료(`shell.css`, `left-gnb-include.js` 등).  
> 본 문서는 **CSS 구조 정리·중복 제거·로드 규칙 고정**을 위한 2단계 작업 계획이다.

---

## 0. 명칭 정리 (파일 vs 마크업)

| 구분 | 예전 | 현재 | 비고 |
|------|------|------|------|
| **CSS/JS 파일명** | `ti-shell.css`, `ti-left-gnb-include.js` | `shell.css`, `left-gnb-include.js` | 본 문서·HTML `<link>`·`<script>` 기준 |
| **Partial HTML** | `ti-left-gnb.html` | `left-gnb.html` | `js/left-gnb-include.js`가 fetch |
| **CSS 클래스·스코프** | `.ti`, `.ti-shell`, `.ti-np-root` | **유지** | 마크업·셀렉터 변경은 별도 작업 |
| **JS 전역·설정** | `TI_ASSET_BASE`, `TI_*_CONFIG` | **유지** | 경로·설정 API; 파일명과 무관 |
| **data 속성** | `data-ti-left-gnb`, `data-ti-site-footer` | **유지** | partial 마운트 훅 |
| **역사적 의미** | TI = Test UI(테스트 UI) | 파일명에서는 제거됨 | 클래스/변수에 잔존 |

재적용 스크립트: `scripts/rename-drop-ti-prefix.py` (51개 파일 rename + 참조 치환).

---

## 1. 현황 맵 (약 6,800줄, 2026-05 기준)

### A. 공유·레거시 (`components/`)

| 파일 | 줄 수 | 역할 | 비고 |
|------|------:|------|------|
| `components/site-common.css` | 702 | GNB, `section-page-*`, 공통 토큰 | 신규 UI 페이지 다수가 **추가로** 로드 |
| `components/movie-detail-layout.css` | 406 | 상영작·기획전 상세 그리드·탭·배지 | `movie-detail.html`, `exhibition_detail.html` 등 |
| `components/magazine-scroll-carousel.css` | 282 | 구 루트 매거진 캐러셀 | **현재 HTML 미참조** — 삭제 후보 |

### B. 신규 UI (`css/`) — 27개

| 계층 | 파일 | 줄 수 | 비고 |
|------|------|------:|------|
| **기반** | `fonts.css` | 1 | Spoqa import |
| | `fonts-display.css` | 1 | display 폰트 import |
| **셸** | `shell.css` | 654 | 좌 GNB + 우 패널, 모바일 메뉴 고정 |
| | `site-footer.css` | 136 | 푸터 슬롯 |
| **공통 UI** | `page-shell.css` | 106 | 오오극장 5페이지 + `section-page-subnav` 오버라이드 |
| | `page-pager.css` | 107 | 페이지네이션·툴바 |
| | `carousel-chrome.css` | 69 | 캐러셀 화살·인디케이터 |
| | `detail.css` | 280 | 매거진 상세 공통(`.sd-*`, 이전·다음) |
| | `logo-spinner.css` | 90 | 로고 스피너 (`past-playing.html` 등) |
| **목록형** | `magazine-preview.css` | 468 | 프리뷰·지난기사 목록(가장 큼) |
| | `magazine-list-pages.css` | 158 | 연재·GV 카드 |
| | `now-playing.css` | 423 | 현재/지난/예정 상영작 목록 |
| | `exhibition.css` | 233 | 기획전 목록 |
| | `exhibition-grid-lines.css` | 33 | 기획전 그리드 라인 |
| **상세 변형** | `magazine-*-detail.css` ×4 | 123~171 | 프리뷰/연재/GV/지난기사 — `sd-pn` 중복 |
| | `movie-detail-test.css` | 160 | 영화·기획전 상세 톤 오버라이드 |
| | `now-playing-movie-detail.css` | 20 | 상영작 상세 미세 조정 |
| **페이지 전용** | `theater-info.css` 등 5개 | 118~226 | 오오극장 하위 |
| | `intro.css` | 460 | **메인 `index.html` 전용** |
| **미사용** | `css/index.css` | 529 | **어떤 HTML도 미링크** — `intro.css`로 대체됨 |

### C. 기능별 분리 (`special/`)

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `special/exhibition/css/exhibition-detail.css` | 573 | 기획전 상세 |
| `special/exhibition/js/exhibition-detail-page.js` | — | 기획전 상세 렌더 |
| `special/event/js/event-detail-page.js` | — | 행사 상세 렌더 |

### D. 정리 대상(워크스페이스 잔존)

- **`test/css/`, `test/js/`:** 1단계 이전 복사본 — **기준은 루트 `css/`·`js/`만**. diff 후 삭제.
- **`.claude/worktrees/...`:** 워크트리 사본 — 본 repo와 혼동 금지.

---

## 2. 주요 문제 (2단계 동기)

### 2-1. 로드 스택이 페이지·깊이마다 제각각

```
[공통 4]  css/fonts → fonts-display → shell → site-footer
[+ site-common]  components/site-common.css  ← 매거진·극장·상세 일부
[+ feature]      page-pager / now-playing / magazine-* / exhibition-* …
[+ detail]       detail.css + magazine-*-detail.css 1개
```

**깊이별 `<link>` 예시**

| 페이지 위치 | `css/*.css` | `components/*.css` |
|-------------|-------------|-------------------|
| 루트 (`index.html`, `now-playing.html`) | `css/shell.css` | (없음 또는 잘못된 `../components/`) |
| 2단계 (`magazine/preview/article-detail.html`) | `../../css/shell.css` | (대개 없음) |
| 3단계 (`movies/now-playing/movie-detail.html`) | `../../css/shell.css` | `../../../components/...` |
| 3단계 (`special/exhibition/exhibition_detail.html`) | `../../css/...` + `css/exhibition-detail.css` | `../../../components/...` |

→ 새 페이지 추가 시 “몇 단계 `../`인지”가 문서화되어 있지 않음.

### 2-2. 알려진 경로 버그 (CSS 작업 전에 수정 권장)

루트에 있는데 `../components/site-common.css`를 쓰는 페이지(상위 폴더로 빠져 **404**):

- `magazine-preview.html`, `magazine-serial.html`, `magazine-past-articles.html`, `gv-moment.html`
- `theater-info.html`, `viewing-guide.html`, `membership.html`, `daegwan.html`, `osinneun-gil.html`

**올바른 루트 기준:** `components/site-common.css`

### 2-3. 역할 중복

| 패턴 | 중복 위치 | 내용 |
|------|-----------|------|
| `section-page-subnav` | `site-common` + `magazine-preview` + `page-shell` | 각진 탭·호버·현재 탭 |
| `.visually-hidden` | `page-shell`, `theater-info` | 동일 유틸 |
| `.sd-pn-*` | `detail` + 4× `magazine-*-detail` | 이전·다음 카드 |
| 목록 카드 | `magazine-preview` + `magazine-list-pages` | 썸네일·타이틀 |
| 영화/기획전 상세 | `movie-detail-layout` + `movie-detail-test` + `now-playing-movie-detail` | 3중 스택 |
| 구 타이틀 (`.ti-sub-h1` 등) | `page-shell` + 페이지별 | `section-page-head` 도입 후 dead code 가능 |

### 2-4. 네이밍·스코프

- **파일명:** `shell.css`, `magazine-preview.css` 등 **도메인·역할** 기준(접두어 없음).
- **클래스:** `.ti-*`, `sd-*`, `section-page-*`, `preview-*`, `np-*` 혼재 — 2단계에서 파일만 계층화, 클래스는 최소 변경.
- 우측 본문: `.ti-mz-panel` / `.ti-sub-scroll` / `.sd-right` / `.ti-np-root` 등 패널 클래스 분산 → `data-ti-panel` 통일 검토(선택).

### 2-5. `components/` vs `css/` 이원화

- 신규 UI: `css/shell.css` 등
- 레거시 공통: `components/site-common.css`, `movie-detail-layout.css`
- 구 정적 영화 HTML (`movies/now-playing/*.html`): `components` 중심

→ 스타일 수정 시 **두 디렉터리 + 깊이별 path**를 맞춰야 함.

---

## 3. 목표 아키텍처

### 3-1. 4계층 모델

```
① tokens/base     — fonts, colors, spacing, utilities
② layout/shell    — shell, GNB, footer, 우측 패널, section-page-head
③ components      — subnav, pager, carousel, preview-card, movie-detail, sd-pn
④ pages/themes    — intro, theater/*, magazine/* (최소 오버라이드)
```

### 3-2. 제안 폴더 구조 (`css/` 기준)

```
css/
  base/
    fonts.css              ← fonts + fonts-display
    tokens.css             ← --ti-* CSS 변수 (클래스 토큰, 파일명과 별개)
    utilities.css
  layout/
    shell.css
    site-footer.css
    detail-shell.css       ← detail.css
  components/
    section-page-head.css  ← subnav 오버라이드 1곳
    page-pager.css
    carousel-chrome.css
    logo-spinner.css
    preview-card.css
    …
  pages/
    intro.css
    theater/ …
    magazine/ …
  bundles/                 ← manifest (선택)
    core.json
    magazine-list.json

partials/
  left-gnb.html
  mobile-menu-bar.html
  site-footer.html

js/
  left-gnb-include.js
  site-footer-include.js
  movie-list-page.js
  …

special/exhibition/css/
  exhibition-detail.css
```

**권장 순서:** 파일 이동 전 `css/README.md`에 **번들 manifest + 로드 순서**만 고정.

### 3-3. 경로 규칙 (HTML `<link>` / `<script>`)

| 규칙 | 내용 |
|------|------|
| 루트 페이지 | `css/*.css`, `js/*.js`, `components/site-common.css` |
| `magazine/*/` 2단계 | `../../css/...`, `../../js/...` |
| `movies/now-playing/` 3단계 | `../../css/...`, `../../../components/...` |
| `special/exhibition/` 3단계 | `../../css/...` + 로컬 `css/exhibition-detail.css`, `js/exhibition-detail-page.js` |
| JS 자산 | `window.TI_ASSET_BASE`, `data-ti-asset-base` — 이미지·partial 경로 |

장기: `partials/styles.html` + depth 치환 또는 빌드 concat으로 `<link>` 6~7종 manifest화.

---

## 4. 페이지 타입별 CSS 번들 (manifest 초안)

| 페이지 타입 | 대표 URL | 권장 스택 |
|-------------|----------|-----------|
| **공통** | (모든 `.ti` 셸 페이지) | fonts → fonts-display → shell → site-footer |
| **메인** | `/index.html` | 공통 → intro |
| **매거진 목록** (프리뷰·지난기사) | `/magazine-preview.html`, `/magazine-past-articles.html` | 공통 → site-common → page-pager → magazine-preview → carousel-chrome |
| **매거진 목록** (연재·GV) | `/magazine-serial.html`, `/gv-moment.html` | 위 + magazine-list-pages |
| **매거진 상세** | `/magazine/preview/article-detail.html?id=pv001` | 공통 → detail → `magazine-*-detail.css` 1개 |
| **오오극장 5페이지** | `/theater-info.html` … | 공통 → site-common → page-shell → `{page}.css` |
| **상영작 목록** | `/now-playing.html`, `/past-playing.html`, `/upcoming-playing.html` | 공통 → page-pager → now-playing (+ past: logo-spinner) |
| **상영작 상세** | `/movies/now-playing/movie-detail.html?slug=…` | 공통 → site-common → movie-detail-layout → movie-detail-test → now-playing-movie-detail |
| **기획전 목록** | `/special-exhibition.html` | 공통 → page-pager → exhibition → exhibition-grid-lines → carousel-chrome |
| **기획전 상세** | `/special/exhibition/exhibition_detail.html?id=…` | 공통 → site-common → movie-detail-layout → movie-detail-test → exhibition-detail |
| **행사 상세** | `/special/event/event_detail.html` | 기획전 상세와 유사 (전용 CSS 없음) |

**공통 JS (대부분 페이지):** `left-gnb-include.js`, `mobile-menu.js`, `scroll-top.js`, `site-footer-include.js`, `week-schedule.js` (+ 페이지별 config 스크립트).

---

## 5. 통합·분리 우선순위

### Phase 0 — 정리·문서 (코드 변경 최소)

1. **`css/README.md`** — manifest, 로드 순서, 깊이별 path.
2. **잔존 `test/`** — 루트와 diff 후 삭제.
3. **루트 HTML `../components/`** → `components/` (9파일).
4. **`css/index.css`** — 삭제 또는 `intro.css` 병합.
5. **`components/magazine-scroll-carousel.css`** — 미사용 시 삭제.
6. dead selector (`.ti-sub-h1` 등).

### Phase 1 — 중복 제거 (영향 낮음)

| 작업 | 통합 대상 |
|------|-----------|
| 1-A | `section-page-subnav` → `css/components/section-page-head.css` |
| 1-B | `.visually-hidden` → `base/utilities.css` |
| 1-C | `.sd-pn` → `sd-prev-next.css`, 변형만 `*-detail`에 소량 유지 |

### Phase 2 — 대형 파일 분할

| 작업 | 대상 |
|------|------|
| 2-A | `magazine-preview.css` (468) |
| 2-B | `now-playing.css` (423) |
| 2-C | `shell.css` (654) — 선택 |

### Phase 3 — `components/` 정렬

- `site-common` vs `css/` 오버라이드 관계를 base + theme로 문서화.
- `movie-detail-test` vs `movie-detail-layout` 역할 분리.
- 레거시 `movies/now-playing/*.html` → `movie-detail.html?slug=` 단일화.

### Phase 4 — 로드 방식 (선택)

- manifest + 빌드 concat 권장; 전면 `@import` 비권장.

### (완료) 파일명 `ti-` 제거

- `scripts/rename-drop-ti-prefix.py`로 51개 파일 `git mv` + HTML/JS/CSS/MD 참조 갱신.
- **미변경:** `body.ti`, `.ti-shell`, `TI_*`, `data-ti-*` — 후속 “마크업 네임스페이스” 작업 시 검토.

---

## 6. 네이밍·스코프 규칙

| 구분 | 규칙 |
|------|------|
| **CSS/JS 파일** | `{역할}.css` / `{역할}.js` 또는 `{도메인}-{부분}.css` — **`ti-` 접두어 사용 안 함** |
| **Partial** | `partials/left-gnb.html` 등 |
| **CSS 클래스** | 당분간 `.ti-*`, `sd-*`, `section-page-*` 유지 |
| **JS** | `TI_ASSET_BASE`, `TI_*_CONFIG` 유지(파일명과 독립) |
| **토큰 변수** | `--ti-surface` 등 CSS 변수는 `ti-` 유지 가능 |

---

## 7. 하지 말아야 할 것

- 한 번에 27파일+ 폴더 분할 + HTML path 일괄 변경.
- `site-common.css` 대규모 수정을 Phase 1과 동시 진행.
- Purge/Unused CSS 자동 삭제.
- `.claude/worktrees/` 기준 작업.
- 파일명만 바꿨는데 **클래스 `.ti-*`까지 한 번에 전면 개명** (범위 폭발).

---

## 8. 검증 체크리스트

로컬: `python -m http.server 8080`

| 영역 | URL |
|------|-----|
| 메인 | `/index.html` |
| 프리뷰·연재·GV | `/magazine-preview.html`, `/magazine-serial.html`, `/gv-moment.html` |
| 매거진 상세 | `/magazine/preview/article-detail.html?id=pv001` |
| 오오극장 | `/theater-info.html`, `/viewing-guide.html`, … |
| 상영작 | `/now-playing.html`, `/past-playing.html`, `/upcoming-playing.html` |
| 상영작 상세 | `/movies/now-playing/movie-detail.html?slug=…&section=upcoming` |
| 기획전·행사 | `/special-exhibition.html`, `/special/exhibition/exhibition_detail.html?id=e000003`, `/special/event/event_detail.html?id=ev000001` |

**리네임 후 추가 확인:** 브라우저 네트워크 탭에서 `css/shell.css`, `js/left-gnb-include.js`, `partials/left-gnb.html` **200** 여부.

---

## 9. 요약

| 항목 | 현재 | CSS 2단계 목표 |
|------|------|----------------|
| CSS 파일명 | `css/*.css` (ti- 없음) 27개 | `css/{base,layout,components,pages}` + manifest |
| JS/Partial | `js/*.js`, `partials/*.html` (ti- 없음) | 동일 계층 구조 |
| 최대 파일 | magazine-preview 468줄, shell 654줄 | ~200줄 단위 component |
| HTML link | 깊이·페이지마다 6~9개 | manifest 6~7종 |
| 클래스/JS | `.ti-*`, `TI_*` 잔존 | 선택적 후속 개명 |
| prod/legacy | `components/` + `css/` | components 단계적 흡수 |

---

## 10. 참고

- 구조 이동: [리팩토링전략.md](./리팩토링전략.md)
- 파일명 일괄 변경: `scripts/rename-drop-ti-prefix.py`
- 기획전 이미지: `images/special/…`(루트) vs `special/exhibition/images/e00000N_t.webp` — `exhibition-detail-page.js` `resolveAssetUrl`

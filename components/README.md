# `components/` — 레거시 공통 CSS

신규 TI UI의 공통 스타일은 **`css/`**(`css/components/`, `css/base/`)에 둔다.  
이 폴더는 **골드 톤 레거시 토큰·상세 레이아웃** 등 기존 `site-common` 체계용이다.

## 파일 역할

| 파일 | 계층 | 역할 |
|------|------|------|
| `site-common.css` | **Base (레거시)** | `:root` 골드 팔레트, 폰트, `.section-page-*`, `.detail-body`, 매거진 레거시 nav |
| `movie-detail-layout.css` | **Layout** | `.section-movie-detail`, `.movie-detail-box`, 탭·배지·`md2-booking-btn` 구조 (토큰 `var(--*)` 사용) |

## `site-common` vs `css/` — 오버라이드 관계

```
① components/site-common.css     … :root 골드 토큰 + GNB/section-page 기본
② css/shell.css + components/*  … TI 셸·모노 UI (대부분 페이지)
③ css/components/section-page-head.css … subnav 각진 탭 (site-common 위)
④ 페이지/테마 CSS               … intro, magazine-preview, movie-detail-theme …
```

| 영역 | Base | Theme / Override |
|------|------|------------------|
| 매거진·오오극장 목록 | `site-common` | `section-page-head.css`, `page-shell.css`, `magazine-preview.css` |
| 상영작·기획전 **상세** | `site-common` + `movie-detail-layout` | 영화: `movie-detail-panel` + `movie-detail-theme` + `now-playing-movie-detail` / 기획전: `exhibition-detail.css` |
| TI 셸만 쓰는 페이지 (`index`) | (없음) | `intro.css` |

**규칙:** `site-common`은 건드리지 않고, TI 모노 톤은 `.ti-md-theme` 등 **스코프 래퍼 안에서 CSS 변수를 재정의**한다.

## 영화 상세 CSS 스택 (Phase 3)

| 순서 | 파일 | 위치 |
|------|------|------|
| 1 | `site-common.css` | 토큰·공통 타이포 |
| 2 | `movie-detail-layout.css` | 그리드·탭·배지 마크업 |
| 3 | `movie-detail-panel.css` | `.ti-md-panel` / `.ti-md-scroll` |
| 4 | `movie-detail-theme.css` | `.ti-md-theme` 모노 변수·각진 오버라이드 |
| 5 | `now-playing-movie-detail.css` | 로딩·시놉시스 등 소량 |

기획전·행사 상세는 `movie-detail-layout`만 공유하고, 본문은 `special/exhibition/css/exhibition-detail.css`가 담당한다 (`movie-detail-theme` 미사용).

## 상영작 상세 URL

- **단일 템플릿:** `movies/now-playing/movie-detail.html?slug={slug}`
- **레거시 SEO 경로:** `movies/now-playing/{slug}.html` → 위 URL로 리다이렉트 (`tools/sync-now-playing-slug-redirects.js`)

목록 페이지 `detailUrlMode: "query"`(현재·예정·지난 공통).

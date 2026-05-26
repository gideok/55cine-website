# CSS 로드 가이드

`CSS리팩토링전략.md`의 2단계 작업 기준 문서. HTML에 `<link>`를 추가할 때 **아래 순서**를 지킨다.

## 공통 6종 (대부분 `.ti` 셸 페이지)

1. `css/fonts.css`
2. `css/fonts-display.css`
3. `css/shell.css` — grid·좌 GNB·스케줄
4. `css/components/shell-mobile-menu.css` — 모바일 메뉴·패널 접기
5. `css/components/shell-scroll-top.css` — 맨 위로 버튼
6. `css/site-footer.css`

## 깊이별 경로

| HTML 위치 | `css/` | `components/` | `js/` |
|-----------|--------|---------------|-------|
| 루트 (`index.html`, `magazine-preview.html` …) | `css/…` | `components/…` | `js/…` |
| 2단계 (`magazine/preview/article-detail.html`) | `../../css/…` | (보통 없음) | `../../js/…` |
| 3단계 (`movies/now-playing/movie-detail.html`) | `../../css/…` | `../../../components/…` | `../../js/…` |

**주의:** 루트 페이지는 `../components/site-common.css`가 아니라 `components/site-common.css`를 쓴다.

## 번들 manifest (페이지 타입별)

### 메인

- 공통 4종 → `intro.css`

### 매거진 목록 (프리뷰·지난기사·연재·GV)

- 공통 4종
- `components/site-common.css`
- `css/components/section-page-head.css` — subnav 오버라이드
- `page-pager.css`
- `magazine-preview.css` — 패널·뷰 모드·하단 페이지네이션
- `css/components/mz-thumb-stack.css` — 썸네일 캐러셀
- `css/components/preview-list.css` — 목록형 카드
- (프리뷰·지난기사만) `carousel-chrome.css`
- (연재·GV만 추가) `magazine-list-pages.css`

### 매거진 상세

- 공통 4종
- `detail.css`
- `css/components/sd-prev-next-magazine.css`
- `magazine-*-detail.css` 1개 (프리뷰 / 연재 / GV / 지난기사)

### 오오극장 5페이지

- 공통 4종
- `components/site-common.css`
- `css/components/section-page-head.css`
- `css/base/utilities.css` — `.visually-hidden`
- `page-shell.css`
- `{theater-info|viewing-guide|membership|daegwan|osinneun-gil}.css`

### 상영작 목록

- 공통 6종 → `page-pager.css` → `now-playing.css` → `np-movie-grid.css` → `np-search-toolbar.css`
- (`past-playing`만 추가) `logo-spinner.css`

### 상영작·기획전 상세

- 공통 6종 → `components/site-common.css` → `movie-detail-layout.css`
- **상영작:** `movie-detail-panel.css` → `movie-detail-theme.css` → `now-playing-movie-detail.css`
- **기획전·행사:** `exhibition-detail.css` (영화 theme CSS 없음)

상세 URL: `movies/now-playing/movie-detail.html?slug={slug}` (`{slug}.html`은 리다이렉트 stub).

레거시 `components/` 역할: [components/README.md](../components/README.md)

## `css/` 디렉터리 구조 (2026-05)

```
css/
  base/
    utilities.css          # .visually-hidden
  components/
    section-page-head.css
    sd-prev-next-magazine.css
    mz-thumb-stack.css
    preview-list.css
    np-movie-grid.css
    np-search-toolbar.css
    shell-mobile-menu.css
    shell-scroll-top.css
    movie-detail-panel.css
    movie-detail-theme.css
  *.css                    # 페이지·도메인별 (shell, magazine-preview, now-playing, …)
```

`components/`(루트)는 레거시 공통(`site-common`, `movie-detail-layout`) 전용. 신규 공통 UI는 `css/components/`에 둔다.

## 스크립트

- `scripts/patch-html-css-bundles.py` — 루트 `../components/` 수정 및 Phase 1 번들 `<link>`
- `scripts/patch-html-shell-np-css.py` — shell·now-playing 분할 후 `<link>` 보강
- `scripts/apply-phase3-css.py` — movie-detail CSS 분리·slug URL·data 갱신
- `tools/sync-now-playing-slug-redirects.js` — `{slug}.html` 리다이렉트 stub 생성

## 검증

로컬: `python -m http.server 8080` — 네트워크 탭에서 CSS **200**, subnav·매거진 이전/다음·썸네일/목록 토글 확인. 상세는 `CSS리팩토링전략.md` §8.

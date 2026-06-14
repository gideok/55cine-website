# 매거진 삼삼오오 — 썸네일형 PC 한 화면 개수

> **대상:** 매거진 삼삼오오(프리뷰·연재·GV 모먼트·지난 기사) **썸네일형** 레이아웃  
> **목록형** 페이지당 개수(`TI_MAGAZINE_LIST_ITEMS_PER_PAGE`)와는 **별개**입니다.

---

## 1. 한 화면에 몇 개가 보이나

썸네일형은 가로 스와이프 캐러셀의 **슬라이드 1장**에 들어가는 카드 수입니다.

```
한 화면 개수 = thumbItemsPerPage = 열(cols) × 행(rows)
```

| 보기 | 변수명 | 계산 위치 |
|------|--------|-----------|
| 썸네일형 | `thumbItemsPerPage` | `js/magazine-carousel-page.js` |
| 목록형 | `TI_MAGAZINE_LIST_ITEMS_PER_PAGE` (= 6) | `js/magazine-list-config.js` |

적용 페이지(공통 JS):

- `magazine-preview.html`
- `magazine-serial.html`
- `gv-moment.html`
- `magazine-past-articles.html`

스크립트 로드 순서:

```
thumb-grid-layout.js → magazine-list-config.js → magazine-carousel-page.js
```

---

## 2. 현재 동작 (동적 계산)

PC(가로 ≥ 821px)에서는 **뷰포트 너비·높이**에 따라 열·행이 바뀝니다.  
1920×1080 기준으로 대략 **4열 × 2행 ≈ 8개**가 나오도록 설계되어 있습니다.

### 2-1. 열 수 (가로)

**파일:** `js/magazine-carousel-page.js` — `getGridColumns()`

| 상수 | 기본값 | 설명 |
|------|--------|------|
| `THUMB_MIN_CELL_PX` | `200` | 셀 최소 너비(px) |
| `MAX_THUMB_COLS` | `4` | PC 최대 열 수 |
| `GRID_GAP_DESKTOP` | `16` | 열·행 간격(px) |

```js
cols = Math.floor((뷰포트너비 + gap) / (THUMB_MIN_CELL_PX + gap))
cols = Math.min(MAX_THUMB_COLS, cols)  // 최대 4
```

뷰포트가 좁으면 3열·2열로 줄어듭니다.

### 2-2. 행 수 (세로)

**파일:** `js/magazine-carousel-page.js` — `computeThumbItemsPerPage()`  
**공통 유틸:** `js/thumb-grid-layout.js` — `computeRows()`

PC 분기에서 `useCellFit: true`로 **셀 높이(썸네일 비율 + 제목 영역)** 에 맞춰 행 수를 계산합니다.

| 상수 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `THUMB_IMG_H_PER_W` | `magazine-carousel-page.js` | `cfg.thumbImgRatio` 또는 `200/264` | 썸네일 세로/가로 비율 |
| `TITLE_BLOCK_RESERVE_PX` | `magazine-carousel-page.js` | `cfg.titleBlockReservePx` 또는 `88` | 제목·부제 영역 예약 높이 |
| `REF_VIEWPORT_HEIGHT` | `thumb-grid-layout.js` | `680` | 행 수 스케일 기준 높이 |
| `REF_ROWS_DESKTOP` | `thumb-grid-layout.js` | `2` | 기준 행 수 |
| `DEFAULT_MAX_ROWS` | `thumb-grid-layout.js` | `4` | 최대 행 수 |

```js
rows = TiThumbGridLayout.computeRows({ cols, useCellFit: true, maxRows: 4, ... })
thumbItemsPerPage = cols * rows
```

### 2-3. 실제 그리드에 반영

**파일:** `js/magazine-carousel-page.js` — `applyThumbLayoutFromViewport()`

1. `getGridColumns()` → `--mz-thumb-cols` CSS 변수 설정  
2. `computeThumbItemsPerPage()` → `thumbItemsPerPage` 갱신  
3. `buildThumbSlides()` — 슬라이드·API 페이지 크기 재구성  

**그리드 CSS:** `css/components/mz-thumb-stack.css`

```css
grid-template-columns: repeat(var(--mz-thumb-cols, 4), minmax(0, 1fr));
grid-template-rows: repeat(var(--mz-thumb-rows, 2), minmax(0, auto));
```

### 2-4. CSS 보조 (뷰포트 높이별 행 힌트)

**파일:** `css/components/magazine-mz-pc-layout.css` (349행 부근)

`--mz-thumb-rows`를 뷰포트 **높이** 미디어쿼리로 지정합니다.

| 조건 (PC) | `--mz-thumb-rows` |
|-----------|-------------------|
| `min-height: 760px` | 2 |
| `min-height: 1070px` | 3 |
| `min-height: 1380px` | 4 |

지난 기사 **세로형(9:16) 썸네일**은 `.preview-page--tall-thumb` 변형 블록에서 별도 행 수를 씁니다.

> **참고:** PC에서는 JS가 `syncThumbRowsVariable()`로 `--mz-thumb-rows`를 다시 덮어씁니다.  
> 개수를 확실히 고정하려면 **JS 수정**이 우선입니다.

### 2-5. 페이지별 옵션 (선택)

각 HTML의 `window.TI_MAGAZINE_CAROUSEL_CONFIG`에서 썸네일 비율만 조정 가능합니다.

```js
window.TI_MAGAZINE_CAROUSEL_CONFIG = {
  thumbImgRatio: 200 / 264,      // 썸네일 비율 (미지정 시 JS 기본값)
  titleBlockReservePx: 88        // 제목 영역 높이 (미지정 시 JS 기본값)
};
```

현재 네 페이지 모두 이 옵션은 **미설정**(기본값 사용)입니다.

---

## 3. PC에서 항상 4×2 = 8개 고정으로 바꾸기

동적 계산을 끄고 PC 썸네일형만 **4열 × 2행 = 8개**로 고정하는 방법입니다.  
모바일(가로 ≤ 820px) 동작은 그대로 둡니다.

### 3-1. 권장: `computeThumbItemsPerPage()` 에 PC 고정 분기 추가

**파일:** `js/magazine-carousel-page.js`

파일 상단 상수 영역에 고정값을 추가합니다.

```js
var THUMB_PC_COLS_FIXED = 4;
var THUMB_PC_ROWS_FIXED = 2;
```

`computeThumbItemsPerPage()` 함수 **맨 앞**(모바일 분기 전)에 다음을 넣습니다.

```js
function computeThumbItemsPerPage() {
  if (!isMobileThumbViewport()) {
    syncThumbRowsVariable(THUMB_PC_ROWS_FIXED);
    return THUMB_PC_COLS_FIXED * THUMB_PC_ROWS_FIXED; // 8
  }

  // 이하 기존 모바일·동적 계산 코드 유지
  var cols = getGridColumns();
  // ...
}
```

### 3-2. 열도 4로 고정: `getGridColumns()` 보완

열 계산을 그대로 두면 창 너비에 따라 3열·2열이 될 수 있습니다.  
PC에서 항상 4열이어야 하면 `getGridColumns()`에 분기를 추가합니다.

```js
function getGridColumns() {
  if (!isMobileThumbViewport()) {
    return THUMB_PC_COLS_FIXED; // 4
  }
  // 이하 기존 모바일 분기
  if (!mzSwipeViewport) {
    return COL_BREAKPOINT.matches ? 2 : 4;
  }
  // ...
}
```

### 3-3. (선택) CSS 변수도 맞추기

`applyThumbLayoutFromViewport()`에서 이미 `--mz-thumb-cols`를 설정하므로,  
3-1·3-2만 적용해도 동작합니다.  
CSS만으로 맞추고 싶다면 `css/components/mz-thumb-stack.css` 기본값을 확인합니다.

```css
.ti .mz-panel .mz-thumb-stack {
  --mz-thumb-cols: 4;
  --mz-thumb-rows: 2;  /* JS syncThumbRowsVariable 과 일치 */
}
```

### 3-4. API 페이지 크기

지난 기사 등 `usePaginatedApi: true` 페이지는 `thumbItemsPerPage`가 **API 요청 pageSize**로도 쓰입니다.  
고정 8개로 바꾸면 서버에서도 슬라이드당 8건씩 내려옵니다.  
`applyThumbLayoutFromViewport()`의 `fetchMagazinePageApi(1, thumbItemsPerPage)` 호출이 자동으로 8을 사용합니다.

### 3-5. 다른 고정값 예시

| 원하는 개수 | `THUMB_PC_COLS_FIXED` | `THUMB_PC_ROWS_FIXED` |
|-------------|------------------------|------------------------|
| 4×2 = 8 | 4 | 2 |
| 4×3 = 12 | 4 | 3 |
| 3×2 = 6 | 3 | 2 |

열·행을 바꾼 뒤 PC에서 썸네일형으로 새로고침하고, 슬라이드당 카드 수·페이지네이션 총 페이지 수를 확인하세요.

---

## 4. 수정 시 건드리지 않아도 되는 것

| 파일/설정 | 이유 |
|-----------|------|
| `js/magazine-list-config.js` | **목록형** 전용 (`6`건/페이지) |
| `css/components/magazine-mz-pc-layout.css` `--mz-thumb-rows` 미디어쿼리 | JS 고정 시 PC에서 덮어씀. 모바일·tall-thumb만 영향 |
| `js/exhibition-carousel.js`, `js/event-carousel.js` | 기획전·행사 전용 (매거진과 별도) |

---

## 5. 확인 체크리스트

1. PC(가로 ≥ 900px)에서 매거진 아무 메뉴 → **썸네일형** 선택  
2. 첫 슬라이드에 카드가 **정확히 8개**(4×2)인지  
3. 좌우 스와이프·페이지 점/화살표로 다음 슬라이드도 8개 단위인지  
4. 브라우저 창 너비를 줄여도 PC 구간에서 열 수가 **4로 유지**되는지 (3-2 적용 시)  
5. 모바일(≤ 820px)은 기존 2열·동적 행 동작이 깨지지 않는지  
6. 지난 기사 API 목록에서 네트워크 탭 `pageSize`가 8로 요청되는지 (API 사용 페이지)

---

## 6. 관련 파일 요약

| 역할 | 경로 |
|------|------|
| 썸네일 캐러셀 메인 로직 | `js/magazine-carousel-page.js` |
| 행 수·슬라이드 너비 공통 유틸 | `js/thumb-grid-layout.js` |
| 목록형 N건 (썸네일과 무관) | `js/magazine-list-config.js` |
| 그리드·스크롤바 스타일 | `css/components/mz-thumb-stack.css` |
| PC/모바일 행 수 CSS 힌트 | `css/components/magazine-mz-pc-layout.css` |
| 페이지별 API·데이터 설정 | `magazine-*.html`, `gv-moment.html` 내 `TI_MAGAZINE_CAROUSEL_CONFIG` |

# 55CINE 관리자 API 명세

> Base URL: `/api/v1` (로컬: `http://localhost:3000/api/v1`)  
> 인증: **추후수정 및 로그인 연동** — 현재 스텁으로 `X-Admin-Auth: true` 헤더 또는 서버 스텁 통과

## 공통

### 에러 응답

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자 메시지"
  }
}
```

| HTTP | 설명 |
|------|------|
| 400 | 잘못된 요청 (쿼리/본문 검증 실패) |
| 401 | 인증 필요 (로그인 연동 후) |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |

---

## 1. 대시보드

### `GET /admin/dashboard`

각 항목 집계를 반환합니다.

**응답 예시**

```json
{
  "programs": { "total": 565 },
  "movies": {
    "nowPlaying": 12,
    "upcoming": 3,
    "past": 550
  },
  "special": {
    "exhibition": 29,
    "event": 1,
    "total": 30
  },
  "magazine": {
    "preview": 85,
    "serial": 30,
    "gvMoment": 24,
    "past": 74,
    "total": 213
  }
}
```

---

## 2. 상영작 관리 (`web_program` + `prog_base`)

### `GET /admin/programs`

| Query | 타입 | 설명 |
|-------|------|------|
| `q` | string | 한글제목·영제·slug·prog_id 검색 |
| `page` | number | 페이지 (기본 1) |
| `pageSize` | number | 페이지 크기 (기본 20, 최대 100) |

**응답**

```json
{
  "items": [
    {
      "seq": 1,
      "progId": 12345,
      "slug": "movie-slug",
      "titleKo": "한글 제목",
      "titleEn": "English Title",
      "dateOpen": "2026-01-01",
      "dateClose": null,
      "imgThumb": "images/movies/...",
      "img1": "images/movies/..."
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 565,
  "totalPages": 29
}
```

### `GET /admin/programs/:seq`

상세 (web_program 편집 필드 + prog_base 메타).

### `PUT /admin/programs/:seq`

`web_program` 컬럼 수정. `prog_base`는 읽기 전용.

**요청 본문** (모두 optional)

```json
{
  "slug": "string",
  "detailUrl": "string | null",
  "imgThumb": "string | null",
  "img1": "string | null",
  "img2": "string | null",
  "img3": "string | null",
  "img4": "string | null",
  "img5": "string | null",
  "director": "string | null",
  "castNames": "string | null",
  "info": "string | null",
  "synopsis": "string | null",
  "trailerUrl": "string | null"
}
```

---

## 3. 기획전·행사 관리 (`web_special`)

### `GET /admin/special`

| Query | 타입 | 설명 |
|-------|------|------|
| `kind` | `exhibition` \| `event` | 구분 필터 |
| `q` | string | 제목·public_id 검색 |
| `page` | number | 페이지 |
| `pageSize` | number | 페이지 크기 |

### `GET /admin/special/:publicId`

상세 (items·screenings 포함, 기획전만 films 배열).

### `POST /admin/special`

**요청 본문**

```json
{
  "publicId": "e000001",
  "kind": "exhibition",
  "title": "제목",
  "dateLabel": "02/21(토)~22(일)",
  "body": "소개 HTML/텍스트",
  "imgMain": "images/special/sp/sp_1_main.jpg",
  "bookingUrl": "https://...",
  "listOrder": 0,
  "films": [
    {
      "title": "작품명",
      "image": "images/special/sp/sp_1_1.jpg",
      "titleEn": "",
      "info": "",
      "runningTimeLabel": "",
      "director": "",
      "cast": "",
      "description": "",
      "sectionName": "",
      "isEmptySpacer": false,
      "screenings": [
        { "date": "2026-02-21", "time": "14:00", "gv": false }
      ]
    }
  ]
}
```

### `PUT /admin/special/:publicId`

메인 필드 및 `films` 전체 교체 (기획전).

### `DELETE /admin/special/:publicId`

CASCADE로 item·screening 삭제.

---

## 4. 매거진 관리 (`web_magazine`)

### `GET /admin/magazine`

| Query | 타입 | 설명 |
|-------|------|------|
| `section` | `preview` \| `serial` \| `gv-moment` | 섹션 (isPast 미사용 시) |
| `isPast` | `true` \| `1` | 지난기사만 |
| `q` | string | 제목·ID·영화제목 검색 |
| `page` | number | 페이지 |
| `pageSize` | number | 페이지 크기 |

### `GET /admin/magazine/:seq`

### `POST /admin/magazine`

```json
{
  "section": "preview",
  "title": "제목",
  "movieTitle": null,
  "subtitle": null,
  "publishedLabel": "2026. 6. 4.",
  "publishedAt": null,
  "excerpt": null,
  "bodyHtml": "<p>본문</p>",
  "imgThumb": null,
  "imgCover": null,
  "sourceUrl": null,
  "createdAt": null
}
```

목록 정렬: `created_at` 역순 (기본).

### `PUT /admin/magazine/:seq`

### `DELETE /admin/magazine/:seq`

### `POST /admin/magazine/:seq/mark-past`

지난기사 처리: `is_past=1` 설정. **seq 는 유지**됩니다.

**응답**: 갱신된 기사 객체

---

## 공개 API (매거진)

### `GET /api/v1/magazine/:seq`

대외 식별자는 `web_magazine.seq` (양의 정수).

목록 응답 `items[]`: `{ seq, id, title, detailUrl, ... }` — `detailUrl`은 `?id={seq}` 형식.

---

## 5. 이미지 업로드

### `POST /admin/upload`

`multipart/form-data`

| 필드 | 필수 | 설명 |
|------|------|------|
| `file` | O | 이미지 파일 (최대 20MB) |
| `category` | O | 업로드 종류 (아래 표) |
| `specialSeq` | △ | 기획전·행사 seq |
| `itemSeq` | △ | 작품 item 순번 (1부터) |
| `magazineSeq` | △ | 매거진 seq |
| `imageIndex` | △ | 본문 이미지 순번 |
| `programSeq` | △ | web_program seq |

**category별 저장 경로**

| category | 경로 규칙 |
|----------|-----------|
| `special-main` | `images/special/sp/sp_{specialSeq}_main.{ext}` |
| `special-item` | `images/special/sp/sp_{specialSeq}_{itemSeq}.{ext}` |
| `magazine-body` | `images/magazine/body/wm_{magazineSeq}_{imageIndex}.{ext}` |
| `magazine-thumb` | `images/magazine/body/wm_{magazineSeq}_thumb.{ext}` |
| `program` | `images/movies/wp/wp_{programSeq}_1.{ext}` |

**응답**

```json
{ "path": "images/special/sp/sp_3_main.jpg" }
```

---

## 6. 프론트엔드 페이지

| URL | 설명 |
|-----|------|
| `/admin/index.html` | 대시보드 |
| `/admin/programs.html` | 상영작 목록·수정 |
| `/admin/special.html` | 기획전·행사 목록 |
| `/admin/special-edit.html?id=` | 기획전·행사 추가/수정 |
| `/admin/magazine.html` | 매거진 목록 |
| `/admin/magazine-edit.html?id=` | 매거진 추가/수정 |

### 인증 스텁 (프론트)

- `js/admin/auth.js`: `TI_ADMIN_LOGGED_IN = true` — **추후수정 및 로그인 연동**
- `localStorage` 키: `ti_admin_logged_in`

### API 클라이언트

- `js/admin/api.js`: `window.TiAdminApi`

---

## 7. 추후 작업

1. 관리자 로그인 페이지 및 JWT/세션 인증
2. `ADMIN_STUB_ENABLED` / `TI_ADMIN_LOGGED_IN` 실제 검증 연동
3. 상영작 이미지 업로드 UI (`program` category)
4. 기획전 작품 상영 회차(screenings) 편집 UI
5. 매거진 저장 시 JSON 미러 동기화 정책

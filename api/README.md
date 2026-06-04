# 55cine API (Phase 2)

Node.js 20 + Fastify + TypeScript. **MS SQL Server**의 `prog_daily` / `prog_base` 는 SELECT 만, `web_program` 은 신규 테이블입니다.

## 빠른 시작

```bash
cd api
npm install
cp ../.env.example ../.env   # DATABASE_URL 설정
# DB 없이 로컬 UI 테스트
echo SCHEDULE_USE_MOCK=true >> ../.env
npm run dev
```

- Health: `GET http://localhost:3000/api/v1/health`
- 주간 시간표: `GET http://localhost:3000/api/v1/schedule/week?anchor=2026-06-04`

## DB (cine55)

신규 테이블만 추가합니다 (`prog_daily` / `prog_base` 는 변경 없음).

| 테이블 | 용도 |
|--------|------|
| `web_program` | `prog_id`별 slug, `detail_url`, 썸네일·이미지, 감독·출연·info·synopsis·trailer_url |
| 상영시간표(상세) | `prog_daily` (`prog_id`, `date_sc`, `time_sc`) — `web_program` 컬럼 없음 |
| `web_program_schedule` | `prog_daily.seq` FK — `is_opening`, `is_closing`, `is_gv`, `is_ct` |

```bash
# 루트 .env 에 DB_* 설정 후
npm run db:migrate
npm run db:inspect
```

**관리자 수동 SQL** (`db:migrate` 대상 아님): `sql/admin/sync_prog_base_date_close_from_종영.sql` — `prog_daily` 종영 회차 `date_sc` → `prog_base.date_close` 동기화.

`SCHEDULE_USE_MOCK` 을 설정하지 않으면 실 DB 를 조회합니다. 플래그는 `web_program_schedule` 우선, 없으면 `prog_label` 파싱 fallback.

### 이미지 필드

| 필드 | 용도 | 파일 예 |
|------|------|---------|
| `img1` | 상영작 목록·상세 (`/movies`) — 원본 | `images/movies/wp/wp_{seq}_1.jpg` |
| `img_thumb` | GNB 시간표 (`/schedule/week`) — 40×40 | `images/movies/wp/thumb_wp_{seq}_1.jpg` |

```bash
npm run db:migrate:nowshowing-archive   # nowshowing page/2+ → web_program
npm run db:generate:thumbs              # img1 원본 → img_thumb 40×40 생성
```

## 프론트 연동

정적 서버만 쓸 때는 API 를 별도로 띄우고 HTML 에 다음을 추가합니다 (스크립트는 `insert-week-schedule-api-client.py` 로 일괄 삽입 가능).

```html
<script>window.TI_API_BASE = "http://localhost:3000/api/v1";</script>
<script src="js/api/client.js"></script>
```

운영: Nginx `location /api/` → 이 API.

## mock 픽스처 갱신

기존 정적 시간표에서 추출:

```bash
node scripts/build-mock-fixture.mjs
```

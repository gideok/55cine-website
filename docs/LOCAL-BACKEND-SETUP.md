# 로컬 백엔드 환경 구성 매뉴얼

> Git에서 코드를 내려받은 뒤 **55CINE API(Fastify + TypeScript)** 를 로컬에서 실행하기 위한 절차입니다.  
> 프론트엔드 정적 서버·운영 배포는 [DEPLOY.md](./DEPLOY.md), API 상세는 [api/README.md](../api/README.md) 를 참고하세요.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| **저장소** | `55cine-website` (모노레포: 정적 HTML + `api/`) |
| **백엔드 경로** | `api/` |
| **런타임** | Node.js **20 이상** |
| **DB** | MS SQL Server (`cine55` 등) — **없이도** mock 모드로 일부 개발 가능 |
| **기본 포트** | `3000` |
| **API prefix** | `/api/v1` |

```
브라우저 (localhost:8080 등)
    → js/api/client.js
    → http://127.0.0.1:3000/api/v1/...
    → Fastify (api/)
    → MS SQL (또는 mock 픽스처)
```

---

## 2. 사전 요구 사항

### 필수

- **Git**
- **Node.js 20+** · **npm**  
  - 확인: `node -v` → `v20.x` 이상  
  - [Node.js LTS](https://nodejs.org/) 설치

### DB 연동 개발 시 (선택)

- **MS SQL Server** 접속 정보 (호스트, DB명, 계정)  
  - 기존 극장 DB: `prog_base`, `prog_daily` (읽기) + `web_*` 테이블 (신규/마이그레이션)
- 방화벽·VPN·**SSH 터널** 등으로 RDS/사내 DB에 도달 가능한 네트워크

### 프론트 연동 확인 시 (선택)

- Python 3 (`python -m http.server 8080`) 또는 동등한 정적 서버  
  - API만 띄울 때는 불필요

---

## 3. 저장소 받기

### 최초 클론

```bash
git clone <저장소-URL> 55cine-website
cd 55cine-website
```

### 이미 클론한 경우 — 최신 코드 반영

```bash
cd 55cine-website
git fetch origin
git pull origin <작업-브랜치>   # 예: main, develop
```

> `.env` 는 git에 포함되지 않습니다. `git pull` 후에도 로컬 `.env` 는 유지됩니다.

---

## 4. 환경 변수 (.env)

API는 **저장소 루트**의 `.env` 를 읽습니다. (`api/src/config.ts` — `api/.env` 도 보조로 읽음)

### 4.1 파일 생성

```bash
# 저장소 루트에서
cp .env.example .env
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

### 4.2 최소 설정 (API만 기동)

`.env.example` 기본값으로도 서버는 뜹니다.

```env
API_HOST=0.0.0.0
API_PORT=3000
API_PREFIX=/api/v1
TZ=Asia/Seoul
```

- 브라우저·`curl` 은 **`http://127.0.0.1:3000`** 사용 (`0.0.0.0` URL은 브라우저에서 동작하지 않음)

### 4.3 DB 없이 빠른 UI 테스트 (mock)

시간표 등 일부 API만 픽스처 JSON으로 응답합니다.

```env
SCHEDULE_USE_MOCK=true
```

- `web_program` / 상영작 목록 / 매거진 등 **DB 의존 API는 실패**할 수 있습니다.
- Health·시간표 mock 확인용으로 적합합니다.

### 4.4 실 DB 연결

**방법 A — `DATABASE_URL` (한 줄)**

```env
DATABASE_URL=sqlserver://your-host:1433;database=cine55;user=YOUR_USER;password=YOUR_PASSWORD;encrypt=true;trustServerCertificate=true
```

**방법 B — 개별 변수**

```env
DB_SERVER=your-host
DB_PORT=1433
DB_DATABASE=cine55
DB_USER=your-user
DB_PASSWORD=your-password
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
```

| 변수 | 설명 |
|------|------|
| `DB_ENCRYPT` | Azure/RDS 등 TLS 사용 시 `true` |
| `DB_TRUST_SERVER_CERTIFICATE` | 자체 서명 인증서 허용 시 `true` (로컬·개발 DB) |
| `SCHEDULE_USE_MOCK` | `true` 이면 시간표만 mock, **미설정/false 시 실 DB** |

> `.env` 는 **절대 git에 커밋하지 마세요.** (`.gitignore` 처리됨)

---

## 5. 의존성 설치

```bash
cd api
npm install
```

- `node_modules/` 는 `api/` 아래에 생성됩니다.
- `sharp` 등 네이티브 모듈 포함 — Node 20과 OS 아키텍처가 맞아야 합니다.

---

## 6. DB 마이그레이션 (실 DB 사용 시)

`web_program`, `web_special`, `web_magazine` 등 **신규 테이블**만 `api/sql/` 스크립트로 추가합니다.  
`prog_base` / `prog_daily` 는 변경하지 않습니다.

```bash
cd api
npm run db:migrate
```

연결 확인:

```bash
npm run db:inspect
```

성공 시 `prog_daily` 컬럼 목록이 출력됩니다.

### (선택) 콘텐츠 시드·동기화

데이터·이미지가 필요할 때만 실행합니다. 상세는 `api/README.md` 참고.

```bash
npm run db:seed:web-program      # 예시 web_program
npm run db:migrate:special       # 기획전 JSON → DB
npm run db:migrate:magazine      # 매거진 JSON → DB
```

---

## 7. 백엔드 실행

### 7.1 개발 모드 (권장)

파일 변경 시 자동 재시작 (`tsx watch`):

```bash
cd api
npm run dev
```

정상 기동 로그 예:

```text
API listening (bind 0.0.0.0:3000) — use http://127.0.0.1:3000/api/v1 in browser
```

### 7.2 프로덕션 빌드 후 실행

```bash
cd api
npm run build
npm start
```

산출물: `api/dist/`

---

## 8. 동작 확인

### Health check

```bash
curl -s http://127.0.0.1:3000/api/v1/health | jq
```

또는 브라우저: `http://127.0.0.1:3000/api/v1/health`

| 응답 필드 | 의미 |
|-----------|------|
| `status: "ok"` | API 프로세스 정상 |
| `dbConfigured: true` | `.env` 에 DB 설정 있음 |
| `db: "connected"` | DB ping 성공 |
| `scheduleMock: true` | 시간표 mock 모드 |

### 주요 엔드포인트 예시

| 용도 | URL |
|------|-----|
| 주간 시간표 | `GET http://127.0.0.1:3000/api/v1/schedule/week` |
| 현재 상영작 | `GET http://127.0.0.1:3000/api/v1/movies/now-playing` |
| 매거진 목록 | `GET http://127.0.0.1:3000/api/v1/magazine?section=preview&page=1` |
| 관리자 대시보드 | `GET http://127.0.0.1:3000/api/v1/admin/dashboard` |

관리자 API는 현재 **스텁 인증** (`X-Admin-Auth: true` 또는 미들웨어 통과) — `api/src/middleware/admin-auth.ts`

---

## 9. 프론트엔드와 함께 보기

### 9.1 정적 서버 + API (로컬 일반 패턴)

**터미널 1 — API**

```bash
cd api && npm run dev
```

**터미널 2 — 프론트 (저장소 루트)**

```bash
python -m http.server 8080
```

브라우저: `http://localhost:8080/`

`js/api/client.js` 는 포트 `8080`·`5500` 등 로컬 정적 서버에서 자동으로  
`http://127.0.0.1:3000/api/v1` 을 API 베이스로 사용합니다.

### 9.2 API URL 수동 지정

```html
<script>window.TI_API_BASE = "http://127.0.0.1:3000/api/v1";</script>
<script src="js/api/client.js"></script>
```

---

## 10. 운영 체제별 참고

### Windows

- **Git Bash** 또는 **PowerShell** 모두 가능
- Node는 공식 설치 프로그램 권장
- MS SQL: 사내 호스트 접속 시 VPN 필요할 수 있음
- `npm run dev` 가 방화벽에 막히면 Node 허용

### macOS / Linux

```bash
# Node 20 (nvm 예시)
nvm install 20
nvm use 20
```

Ubuntu 서버와 동일 Node 버전을 맞추려면 **20 LTS** 사용 (`deploy/scripts/server-bootstrap.sh` 기준).

---

## 11. 자주 하는 문제

| 증상 | 원인 | 조치 |
|------|------|------|
| `DATABASE_URL 또는 DB_* 환경 변수가 설정되지 않았습니다` | DB 미설정 상태에서 DB API 호출 | `.env` DB 설정 또는 `SCHEDULE_USE_MOCK=true` |
| Health `db: "error"` | 방화벽·VPN·잘못된 비밀번호 | `npm run db:inspect` 로 연결 테스트 |
| 브라우저에서 `0.0.0.0:3000` 접속 실패 | 바인드 주소와 접속 URL 혼동 | **`127.0.0.1:3000`** 사용 |
| 프론트만 띄우면 API 오류 | API 미기동 | `cd api && npm run dev` |
| CORS 오류 (드묾) | 다른 포트/도메인 | API에 `cors` 허용됨 — `TI_API_BASE` 확인 |
| `npm install` sharp 실패 | Node/OS 불일치 | Node 20 재설치, `npm cache clean --force` 후 재설치 |
| `git pull` 후 API 이상 | 의존성·스키마 변경 | `cd api && npm install && npm run db:migrate` |

---

## 12. 체크리스트

로컬 백엔드 구성 완료 기준:

- [ ] `git pull` 로 최신 코드 반영
- [ ] Node 20+ (`node -v`)
- [ ] `cp .env.example .env` 및 필요 시 DB 또는 `SCHEDULE_USE_MOCK=true`
- [ ] `cd api && npm install`
- [ ] (DB 사용 시) `npm run db:migrate` · `npm run db:inspect` 성공
- [ ] `npm run dev` 기동
- [ ] `http://127.0.0.1:3000/api/v1/health` → `status: "ok"`
- [ ] (선택) `python -m http.server 8080` + 브라우저에서 상영작·시간표 페이지 확인

---

## 13. 관련 문서

| 문서 | 내용 |
|------|------|
| [api/README.md](../api/README.md) | API 엔드포인트·DB 테이블·시드 스크립트 |
| [DEPLOY.md](./DEPLOY.md) | 운영 서버 Nginx + systemd 배포 |
| [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) | 수동 배포 상세 |
| [AUTO-DEPLOY.md](./AUTO-DEPLOY.md) | CD·자동 배포 |
| [개발명세_Phase2.md](../개발명세_Phase2.md) | Phase 2 아키텍처·로컬 개발 정책 |

---

## 14. 한 줄 요약 (DB mock)

```bash
git clone <URL> 55cine-website && cd 55cine-website
cp .env.example .env
echo SCHEDULE_USE_MOCK=true >> .env
cd api && npm install && npm run dev
# → http://127.0.0.1:3000/api/v1/health
```

## 15. 한 줄 요약 (실 DB)

```bash
git pull
cp .env.example .env    # DB_* 또는 DATABASE_URL 편집
cd api && npm install && npm run db:migrate && npm run dev
# → http://127.0.0.1:3000/api/v1/health
```

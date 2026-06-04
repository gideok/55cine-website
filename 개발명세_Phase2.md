# 55CINE 오오극장 — 개발 명세 Phase 2

**목표:** Frontend(현재 정적 UI)와 Backend(API·DB)를 분리하고, JSON/전역 변수로 임시 처리 중인 데이터를 API 기반으로 전환한다.  
**전제:** Phase 1은 정적 HTML·CSS·Vanilla JS·`TI_*_CONFIG` 패턴으로 UI·데이터 접근 계층을 분리해 두었음 ([CSS리팩토링전략.md](./CSS리팩토링전략.md), [designsystem.html](./designsystem.html)).  
**DB 전제:** **기존 관련 시스템과 동일한 MySQL(MariaDB)** 를 쓰되, DB는 **웹 서버와 분리된 외부 RDB 서버**에 둔다. Phase 2용 PostgreSQL·DB 전용 Docker는 **도입하지 않는다**.  
**인프라 전제:** **Frontend(정적) + Backend(API)는 동일 웹 서버**에 배치하고, Nginx가 진입점이 된다 ([§1.2](#12-운영-인프라-구성-일-사용자-5000명-기준)).  
**URL 전제:** 테스트는 `/55cine/` 서브경로였으나, **운영·스테이징은 도메인 루트 `/`** 에 배포한다 ([§1.3](#13-배포-url-경로-루트-)).

---

## 1. Phase 2 범위

| 구분 | Phase 1 (현재) | Phase 2 (목표) |
|------|----------------|----------------|
| **Frontend** | HTML + CSS + JS 렌더러, `fetch` / `window.*` 데이터 | 동일 UI 유지, **API 클라이언트**로 통일 |
| **Backend** | 없음 (정적 파일 서버) | REST API + DB + (선택) 관리자 |
| **데이터** | JSON 파일·`.js` 전역 배열 | **공용 MySQL(MariaDB)** 정규화 + API 응답 JSON |
| **배포** | 테스트: `/55cine/` 서브경로 | **단일 웹 서버**, URL **`/`** 정적 + **`/api/`** + 외부 RDB |

**Phase 2에서 하지 않을 것(별도 트랙):** 전면 SPA 전환, 디자인 시스템 통합(P0 토큰), 검색 서버 전문 엔진 도입, **PostgreSQL·DB용 Docker Compose 신규 구축**.

---

## 1.1 DB·인프라 제약 (필수)

| 항목 | 내용 |
|------|------|
| **DBMS** | **MySQL 5.7+ / MariaDB 10.3+** (운영 환경·기존 관련 시스템과 동일 버전) |
| **RDB 위치** | **웹 서버 외부** 별도 호스트(또는 관리형 DB). 기존 극장·멤버십 등과 **동일 MariaDB 인스턴스/클러스터** — 스키마·접두어로 웹 영역 분리 |
| **웹 서버** | **Frontend + Backend API 동일 VM/베어메탈 1대** (또는 동일 K8s 노드). DB 프로세스는 이 서버에 **설치하지 않음** |
| **Docker** | 선택: **API만** 컨테이너 가능. **DB 컨테이너·로컬 DB Docker는 사용 안 함** |
| **스키마** | `cine_*` 등 접두어 또는 전용 database — DBA·기존 백엔드와 사전 합의 |
| **문자셋** | `utf8mb4` / `utf8mb4_unicode_ci` |
| **권한** | 웹 API DB 계정: `cine_*` CRUD + (필요 시) 기존 테이블 **SELECT만**. `3306`은 **웹 서버 IP만** 허용 |

---

## 1.2 운영 인프라 구성 (일 사용자 5,000명 기준)

### 1.2.1 토폴로지

```
                    [인터넷]
                        │
                   HTTPS :443
                        │
         ┌──────────────▼──────────────┐
         │   웹 서버 (단일)              │
         │   Frontend + Backend        │
         │  ┌────────────────────────┐ │
         │  │ Nginx (진입점)          │ │
         │  │  /*         → 정적(루트) │ │
         │  │  /api/*     → API 프록시│ │
         │  └──────────┬─────────────┘ │
         │             │ loopback     │
         │  ┌──────────▼─────────────┐ │
         │  │ Node.js API (Fastify)  │ │
         │  │ 127.0.0.1:3000 (PM2×2) │ │
         │  └──────────┬─────────────┘ │
         └─────────────┼───────────────┘
                       │ TCP 3306 (사설망/VPN/방화벽 허용 IP만)
         ┌─────────────▼───────────────┐
         │   외부 RDB 서버               │
         │   MySQL / MariaDB (공용)    │
         │   + 기존 관련 시스템 테이블    │
         └─────────────────────────────┘
```

| 구간 | 프로토콜 | 비고 |
|------|----------|------|
| 사용자 ↔ 웹 서버 | HTTPS 443 (80→301) | TLS 종료는 **Nginx** |
| Nginx ↔ API | HTTP `127.0.0.1:3000` | 외부에 API 포트 **직접 노출하지 않음** |
| API ↔ RDB | MySQL `3306` | **사설 IP·VPC** 권장; 공인 IP 오픈 지양 |

---

### 1.2.2 웹 서버 내부 구성

| 경로 (예시) | 역할 |
|-------------|------|
| `/var/www/55cine/` | **Frontend** document root (`index.html`, `css/`, `js/`, `images/`, `movies/`, `magazine/`, …) |
| `/opt/55cine-api/` (또는 `/srv/api/55cine/`) | **Backend** 소스·빌드 산출물, `package.json`, `.env` |
| `/etc/nginx/sites-enabled/55cine.conf` | 가상호스트·`root` + `location /api/` ([§1.3](#13-배포-url-경로-루트-)) |
| `/var/log/nginx/` | 액세스·에러 로그 (정적·프록시) |
| `/var/log/55cine-api/` | API 애플리케이션 로그 (PM2 또는 stdout) |
| `/etc/systemd/system/55cine-api.service` | API 부팅·재시작 (PM2 대신 systemd도 가능) |

**프로세스 구성**

| 프로세스 | 개수 | 역할 |
|----------|------|------|
| **nginx** | 1 (master + worker) | 정적 파일, gzip/brotli, 캐시 헤더, `proxy_pass` → API |
| **node (Fastify)** | **2** (PM2 cluster 또는 fork 2) | CPU 코어 활용·무중단 재시작; 일 사용자 5,000명에 충분 |
| **PM2** (권장) | 1 | API 프로세스 감시, 로그 로테이션 연동 |

**Nginx 라우팅 (개념, URL 루트 `/`)**

```nginx
server {
  root /var/www/55cine;   # 파일시스템 경로명; URL은 /
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location / {
    try_files $uri $uri/ =404;
  }

  # (선택) 테스트 URL 호환 — 구독·북마크
  location ~ ^/55cine/(.*)$ {
    return 301 /$1$is_args$args;
  }
}
```

**정적 자산 캐시 (권장)**

| 유형 | Cache-Control |
|------|----------------|
| `css/`, `js/` (해시 없음) | `public, max-age=3600` (배포 시 버전 쿼리 또는 짧은 TTL) |
| `images/` | `public, max-age=86400` (1일) |
| HTML | `no-cache` 또는 짧은 TTL (배포 반영 속도 우선) |
| API `GET /schedule/week` | API에서 `max-age=60` ([§10](#10-비기능-요구사항)) |

---

### 1.2.3 트래픽 가정 (일 사용자 5,000명)

| 지표 | 보수적 가정 | 근거 |
|------|-------------|------|
| **DAU** | 5,000 | 명세 기준 |
| **세션/인당 페이지뷰** | 5~8 | GNB·상영작·매거진 탐색 |
| **일 페이지뷰** | ~30,000 | 5,000 × 6 |
| **API 호출/페이지** | 1~2 (시간표·목록·상세) | 정적 HTML/CSS는 Nginx가 직접 처리 |
| **일 API 요청** | ~40,000~60,000 | 상세·목록 위주 |
| **피크 동시 사용자** | **80~200** | DAU의 2~4% (이벤트·개봉일 없을 때) |
| **피크 API RPS** | **15~40** | 동시 200명 × 분당 소수 요청; 순간 버스트 **~80 RPS** 여유 |
| **대역폭 (피크)** | **20~50 Mbps** | 포스터 이미지(200~500KB)×동시 다운로드; 대부분 캐시 히트 |

→ 독립영화관 단일 지점 사이트 규모에서 **경량 API + Nginx 정적** 구조로 충분히 수용 가능한 수준이다.

---

### 1.2.4 웹 서버 적정 사양 (권장)

**운영 1대 기준 (일 사용자 5,000명, 여유 포함)**

| 항목 | 최소 | **권장** | 비고 |
|------|------|----------|------|
| **vCPU** | 2 | **4** | PM2 2 워커 + Nginx; 배포·로그 I/O 여유 |
| **메모리** | 4 GB | **8 GB** | Nginx ~200MB, Node×2 ~1GB, OS·버퍼 2GB+, 피크 여유 |
| **디스크** | 40 GB SSD | **80 GB SSD** | 정적+이미지 2~5GB, 로그 10~20GB/년, 스냅샷 여유 |
| **디스크 종류** | SSD/NVMe | SSD/NVMe | 이미지·로그 랜덤 I/O |
| **네트워크** | 100 Mbps | **100 Mbps~1 Gbps** | 피크 50Mbps 이하면 100Mbps로 충분 |
| **OS** | **Ubuntu 24.04 LTS** (1순위) 또는 **Rocky 9 / Alma 9** (RHEL 계열 표준 시) — [§1.2.8](#128-linux-os-선택) |

**스케일 업 트리거 (모니터링 기준)**

| 신호 | 조치 |
|------|------|
| CPU 지속 > 70% (피크 시간) | Node 워커 3~4 또는 vCPU 증설 |
| 메모리 > 85% | RAM 증설 또는 API 메모리 누수 점검 |
| API p95 > 500ms | DB 쿼리·인덱스·연결 풀·캐시(Redis 2차) 검토 |
| 디스크 > 80% | 로그 로테이션·이미지 CDN 분리 |

**개발·스테이징**

| 환경 | 사양 |
|------|------|
| 스테이징 웹 | 운영의 **50%** (2 vCPU / 4 GB) 또는 동일 서버 내 별도 vhost |
| 로컬 | Frontend `python -m http.server`, API 로컬, DB는 **외부 dev RDB** SSH 터널 |

---

### 1.2.5 API ↔ 외부 RDB 연결

| 항목 | 권장값 |
|------|--------|
| **연결 풀** (Node) | `connectionLimit: 10~20` (PM2 2대 기준 총 20~40, DB `max_connections`와 합의) |
| **타임아웃** | connect 5s, query 10s |
| **TLS** | DB가 원격이면 MariaDB SSL 옵션 검토 (사설망이면 생략 가능) |
| **환경 변수** | `DATABASE_URL`, `DB_HOST`, `DB_PORT` — `.env` 권한 `600` |

**외부 RDB 서버 (웹 API 관점)**

- 웹 트래픽 5,000 DAU만으로 DB 부하를 크게 만들지 않음(읽기 위주·데이터량 소~중).
- **DB 서버 사양은 기존 관련 시스템 전체 부하**로 산정하고, 웹 API 계정·`cine_*` 테이블만 추가.
- 웹 서버 장애 시 **Frontend 정적은 Nginx만으로 일부 열람 가능**; API·동적 목록은 불가 → 2차 JSON fallback 검토([§10](#10-비기능-요구사항)).

---

### 1.2.6 보안·방화벽

| 대상 | 인바운드 | 아웃바운드 |
|------|----------|------------|
| **웹 서버** | 80, 443 (공인) | 3306 → **RDB IP만**, NTP, (선택) SMTP |
| **외부 RDB** | 3306 ← **웹 서버 IP만** (+ 기존 앱 서버 IP) | 기존 정책 따름 |
| **SSH** | 관리 IP 대역만 | — |

- API `3000` 포트는 **방화벽 미개방** (loopback only).
- `.env`, DB 비밀번호, Kakao API 키는 서버 secrets·배포 파이프라인에서 주입.

---

### 1.2.7 (선택) 2차 확장

| 항목 | 시점 |
|------|------|
| **Redis** | API 응답 캐시(시간표·목록), 피크 RPS ↑ 또는 DB 부하 ↑ 시 |
| **CDN** | `images/` 대역폭·해외 접속 ↑ 시 |
| **웹 서버 이중화** | SLA·무중단 필요 시 로드밸런서 + 정적 동기화 |
| **전용 DB** | 공용 RDB 경합 시에만 — 현 단계는 **외부 공용 MariaDB 유지** |

---

### 1.2.8 Linux OS 선택

55CINE 웹 서버 스택: **Nginx + Node.js 20 LTS + PM2** (DB는 외부). 후보 배포판 비교 및 추천.

| 배포판 | 추천 | 이유 |
|--------|------|------|
| **Ubuntu 24.04 LTS** | **1순위 (2026년~)** | 2024-04 출시, **2029-05**까지 표준 보안 지원. 24.04.4(2026-02) 등 포인트 릴리스로 안정화됨. Node 20·Nginx·PM2 운영 사례 충분 |
| **Ubuntu 22.04 LTS** | 기존 서버만 | 표준 지원 **~2027-06** 종료 임박 — **2026년 신규 프로비저닝 비권장**(이미 22.04면 Phase 2 가능, 추후 24.04 업그레이드 계획) |
| **Ubuntu 26.04 LTS** | 신규 보류 | 2026-04 출시 직후 — **26.04.1**(통상 출시 후 수개월) 또는 팀·Node 20 스택 검증 전까지 운영 채택 지양 |
| **Rocky Linux 9** | **2순위 (RHEL 표준)** | CentOS 8 대체 계열. 기존 IDC·관공/엔터프라이즈가 **RHEL 계열**이면 운영·보안 패치 정책 통일에 유리. Node는 **NodeSource** 또는 **nvm**으로 20 LTS 설치 |
| **AlmaLinux 9** | Rocky와 동급 | Rocky 9와 동일한 용도. 조직에서 Alma를 표준으로 쓰면 **Rocky 대신 Alma 9** 선택 |
| **Debian 12** | 3순위 | 안정·경량. 패키지가 Ubuntu보다 보수적일 수 있어 **Node 20은 공식 저장소 또는 NodeSource** 확인 후 채택 |
| **Oracle Linux 9** | 조건부 | Oracle 인프라·지원 계약이 있을 때만. 일반 웹 API 서버에는 이점 적음 |
| **CentOS** | **비추천(신규)** | CentOS 7은 **2024-06 EOL**. CentOS Stream은 롤링에 가까워 “고정 마이너” 기대와 다름. 신규는 **Rocky 9 / Alma 9**로 대체 |

**Ubuntu LTS만 고를 때 (2026년 5월 기준)**

| 버전 | 표준 지원(대략) | 신규 웹 서버 |
|------|-----------------|--------------|
| **24.04 LTS** | ~**2029-05** | **권장** — 지원 잔여 3년+, 포인트 릴리스로 검증됨 |
| **22.04 LTS** | ~**2027-06** | **비권장** — 1년 내 표준 지원 종료, 신규는 24.04 |
| **26.04 LTS** | ~**2031-05** | **보류** — 출시 직후; 프로덕션은 **26.04.1 이후** 또는 2026 하반기 재평가 |

**결정 가이드**

1. **호스팅·운영팀에 RHEL/Rocky 표준이 없고** 자유롭게 고를 수 있음 → **Ubuntu 24.04 LTS** (최신 포인트 릴리스 이미지, 예: 24.04.4).
2. **같은 조직의 다른 서버가 Rocky/Alma/RHEL** → **Rocky Linux 9** 또는 **AlmaLinux 9**.
3. **이미 22.04로 프로비저닝됨** → Phase 2 진행 가능; 로드맵에 **24.04 in-place 업그레이드**(22→24 1단계) 검토.
4. **CentOS 7 레거시** → Rocky 9 / Alma 9 / **Ubuntu 24.04**로 신규 구축.

**Node.js:** OS 무관하게 **Node 20 LTS**는 NodeSource·nvm·공식 바이너리로 고정. Ubuntu 24.04 `apt`의 Node는 18.x일 수 있어 **20 LTS는 별도 설치** 권장(22.04와 동일).

---

## 1.3 배포 URL 경로 (루트 `/`)

| 구분 | 테스트(과거) | 운영·스테이징(목표) |
|------|----------------|---------------------|
| **정적 사이트** | `https://호스트/55cine/index.html` | `https://호스트/index.html` (또는 `/`) |
| **API** | (미연동) | `https://호스트/api/v1/...` |
| **사이트 루트 prefix** | `/55cine/` (`TiSiteRoot`) | **`/`** (자동 감지) |

**Frontend 경로 처리 (`js/site-root.js`)**

- `getSiteRootPrefix()`가 **`/`** 이면 head 인터셉터·`TI_ASSET_BASE` 보정을 **하지 않음** — 상대 경로 `css/…`, `js/…` 그대로 동작.
- 루트 배포 시 `meta[name="ti-site-root"]` **불필요**. 서브경로 재테스트만 할 때 `content="/55cine/"` 로 오버라이드 가능.
- GNB·fetch·이미지는 `TiSiteRoot.resolve()` / `relativePrefix()` 사용 — prefix가 `/`이면 기존 상대 경로 규칙과 동일.

**레거시 URL (권장)**

- Nginx에서 `/55cine/*` → `/*` **301 영구 리다이렉트** ([§1.2.2](#122-웹-서버-내부-구성) 예시).
- 외부 문서(디자인의뢰서 등)의 `…/55cine/…` 링크는 운영 도메인 루트로 순차 갱신.

### 1.3.1 코드베이스 점검 (루트 배포)

| 영역 | 파일·패턴 | 루트 `/` 시 조치 |
|------|-----------|------------------|
| **필수 변경 없음** | `js/site-root.js`, `TiSiteRoot.resolve` 사용처(`week-schedule.js`, `movie-list-page.js`, 매거진·캐러셀 등) | 루트에서 prefix **`/`** 자동 — **코드 수정 불필요** |
| **필수 변경 없음** | `partials/left-gnb.html` `__TI_SITE_ROOT__` | `left-gnb-include.js`가 상대 prefix로 치환 |
| **필수 변경 없음** | HTML `link`/`script` 상대 경로 | 서브경로 전용 meta **미사용** 확인됨 |
| **API 주석** | `fetch("/api/...")` 예시 (일부 HTML) | 루트 배포와 일치; Phase 2는 **`/api/v1/`** 로 통일 예정 |
| **문서** | `components/README.md`, `designsystem.html` | 서브경로 설명 → 루트 기본·서브경로 선택으로 갱신 |
| **배포·Nginx** | 저장소 외 | `root` + `location /api/`; `/55cine/` 301 ([§1.2.2](#122-웹-서버-내부-구성)) |
| **변경 안 함** | `http://55cine.com`, `55cinema.tistory.com` 등 **외부 sourceUrl** | 레거시 콘텐츠 출처 URL |
| **변경 안 함** | Instagram `…/55cine/` SNS 링크 | SNS 계정 경로 |

**로컬 개발:** `python -m http.server 8080` 후 `http://localhost:8080/` — 저장소 루트가 document root이면 **운영과 동일** (`TiSiteRoot` → `/`).

---

## 2. 현재 아키텍처 요약

```
[브라우저]
  ├─ TI 셸 (shell.css, left-gnb-include.js, week-schedule.js)
  ├─ 페이지별 JS (movie-list-page.js, magazine-*-detail-page.js, …)
  └─ 데이터 소스
        ├─ A. fetch → *.json (런타임)
        ├─ B. <script src="data/*.js"> → window.* 배열 (빌드/수동)
        └─ C. data/week-schedule-data.js (GNB 시간표 + 포스터 매핑 혼합)
```

- **개발 서버:** `python -m http.server 8080` (API 없음, CORS 이슈 없음).
- **경로:** `js/site-root.js` — **루트 `/` 기본**, (선택) 서브경로·`TiSiteRoot.resolve()` ([§1.3](#13-배포-url-경로-루트-)).
- **API 전환 준비:** 대부분 페이지에 `window.TI_*_CONFIG` + `fetchList` / `fetchMovies` / `fetchDetail` / `fetchIndex` **주석 예시**가 이미 존재.

---

## 3. Frontend / Backend 역할 분리

### 3.1 Frontend (유지·보강)

| 책임 | 담당 |
|------|------|
| 레이아웃·타이포·컴포넌트 | 기존 HTML/CSS (`ti-shell`, `section-page-head`, …) |
| 데이터 표시·페이지네이션·캐러셀 | 기존 `js/*-page.js` |
| API 호출 | **신규** `js/api/` (또는 `js/services/`) — 공통 `fetchJson`, 에러·로딩 |
| 설정 | 페이지별 `TI_*_CONFIG` — `dataUrl` 제거, `fetch*` 만 API 구현체로 교체 |

**원칙**

- HTML/CSS 구조는 최대한 유지.
- 페이지 JS는 **렌더링만** 담당; URL·인증·캐시는 API 클라이언트에 위임.
- 응답 JSON 스키마는 **현재 정적 JSON과 동일 shape**를 1차 목표로 하여 마이그레이션 비용 최소화.

### 3.2 Backend (신규)

| 책임 | 담당 |
|------|------|
| REST API | 목록·상세·GNB 시간표·기획전/행사·매거진 |
| DB | **공용 MySQL(MariaDB)** — 기존 인스턴스, 신규 테이블만 추가 |
| 자산 URL | 포스터·썸네일·PDF — 스토리지 경로 또는 CDN URL 필드 |
| (선택) 관리자 | 상영작·시간표·기사 CRUD |
| (선택) 외부 연동 | 예매(dtryx), 향후 POS/상영 스케줄 연동 |

**원칙**

- API prefix: `/api/v1/` (Nginx에서 정적 `/`와 `location /api/` 분리).
- 인증: 1차는 **공개 읽기 전용**; 관리자 API만 JWT/세션 (2차).

---

## 4. JSON·임시 데이터 인벤토리

### 4.1 로딩 방식 분류

| 방식 | 설명 | API 전환 시 |
|------|------|-------------|
| **fetch JSON** | `fetch(path).then(r => r.json())` | `cfg.fetch*` → `GET /api/...` |
| **전역 JS** | `data/*.js`가 `window.XXX = [...]` 설정 | 제거 → API 또는 빌드 시 시드만 |
| **HTML 내장** | `week-schedule-data.js` 대량 배열 | `GET /api/schedule/week` |
| **하이브리드** | `fetchList` + `dataKey` | `fetchList`만 API로 통일 |

---

### 4.2 도메인별 상세

#### (1) GNB 이번주·다음주 시간표 — **최우선 API화**

| 항목 | 내용 |
|------|------|
| **파일** | `data/week-schedule-data.js` |
| **소비** | `js/week-schedule.js` — `window.WEEK_SCHEDULE`, `MOVIE_POSTER_BY_TITLE`, `MOVIE_DETAIL_BY_TITLE` |
| **형식** | 일별 `{ label, weekday, entries: [{ time, title, opening, closing, gv, ct }] }` |
| **특이** | `nowPlayingByTitle` 맵이 파일 내 중복 유지; 시간표 제목 ↔ 상영작 slug 수동 매핑 |
| **임시** | `getScheduleToday()` 테스트 고정(5/27) — **배포 전 제거** ([조치필요] 주석) |
| **API 제안** | `GET /api/v1/schedule?from=2026-05-21&to=2026-06-03` 또는 `?week=primary\|following` |
| **응답** | `days[]` + `moviesByTitle{ titleKo: { poster, detailUrl, slug } }` |

---

#### (2) 상영작 — 목록

| 페이지 | 설정 객체 | 현재 데이터 소스 | JSON 경로 |
|--------|-----------|------------------|-----------|
| `now-playing.html` | `TI_MOVIE_LIST_PAGE_CONFIG` | `dataUrl` + (주석) `/api/now-playing/list` | `movies/now-playing/data/now-playing-list.json` |
| `upcoming-playing.html` | 동일 | `dataUrl` | `upcoming-list.json` |
| `past-playing.html` | 동일 | `dataUrl` | `past-list.json` |

| 항목 | 내용 |
|------|------|
| **JS** | `js/movie-list-page.js` — `fetchList` 우선, 없으면 `fetch(dataUrl)` |
| **목록 필드** | `slug`, `poster`, `titleKo`, `titleEn`, (`director` — past 검색용) |
| **API 제안** | `GET /api/v1/movies?section=now-playing\|upcoming\|past` |
| **비고** | `js/now-playing-page.js` — 레거시 별도 파일, `TI_NOW_PLAYING_LIST_CONFIG` (통합 권장) |

---

#### (3) 상영작 — 상세

| 항목 | 내용 |
|------|------|
| **페이지** | `movies/movie-detail.html` |
| **설정** | `TI_MOVIE_DETAIL_CONFIG` — `pageBase: "movies/now-playing/data/"` |
| **JS** | `js/now-playing-movie-detail-page.js` |
| **현재** | `now-playing-movies.json` + `upcoming-movies.json` + `past-movies.json` **3파일 병합 fetch** |
| **쿼리** | `?slug=`, `?from=now-playing\|upcoming\|past` (목록 복귀 링크만, 카탈로그는 slug 단일) |
| **상세 필드** | 감독·출연·info·ratingImage·synopsis·trailerYoutubeId·`screenings[]` |
| **API 제안** | `GET /api/v1/movies/{slug}` (섹션 무관 단일 레코드) |
| **레거시** | `data/now-playing-data.js` — `NOW_PLAYING_MOVIES` (일부 페이지 `<script>` 로드, **목록은 미사용**) |

---

#### (4) 매거진 — 목록

| 섹션 | 페이지 | 데이터 소스 | 비고 |
|------|--------|-------------|------|
| 프리뷰 | `magazine-preview.html` | `window.MAGAZINE_PREVIEW_DATA` ← `data/magazine-preview-data.js` | `fetchList`는 주석만 |
| 연재 | `magazine-serial.html` | `MAGAZINE_SERIAL_DATA` ← `.js` | 주석에 `index.json` 예시 |
| GV | `gv-moment.html` | `GV_MOMENT_DATA` ← `data/gv-moment-data.js` | 동일 |
| 지난 기사 | `magazine-past-articles.html` | **`fetchList` → `magazine/past-articles/data/index.json`** | API 예시 주석 있음 |

| 항목 | 내용 |
|------|------|
| **JS** | `js/magazine-carousel-page.js` — `cfg.dataKey` 또는 `cfg.fetchList` |
| **JSON** | `magazine/{preview,serial,gv-moment}/data/index.json` + 항목별 `{id}.json` |
| **API 제안** | `GET /api/v1/magazine/{section}` · `GET /api/v1/magazine/{section}/{id}` |

---

#### (5) 매거진 — 상세

| 섹션 | 설정 | 기사 JSON | index |
|------|------|-----------|-------|
| 프리뷰 | `TI_MAGAZINE_PREVIEW_DETAIL_CONFIG` | `magazine/preview/data/{id}.json` | `index.json` |
| 연재 | `TI_MAGAZINE_SERIAL_DETAIL_CONFIG` | `magazine/serial/data/{id}.json` | 동일 |
| GV | `TI_MAGAZINE_GV_MOMENT_DETAIL_CONFIG` | `magazine/gv-moment/data/{id}.json` | 동일 |
| 지난 기사 | `TI_MAGAZINE_PAST_DETAIL_CONFIG` | `magazine/past-articles/data/{id}.json` | 동일 (+ `articles-bundle.json`) |

| 항목 | 내용 |
|------|------|
| **JS** | `magazine-*-detail-page.js` — `fetchArticle(id)`, `fetchIndex()` |
| **HTML** | 각 `article-detail.html`에 `/api/magazine/...` **주석 예시** 존재 |
| **본문** | HTML 문자열(`contentHtml`) 또는 마크다운 — MySQL `LONGTEXT` + sanitize |

---

#### (6) 기획전·행사

| 유형 | 목록 | 상세 |
|------|------|------|
| **기획전** | `special-exhibition.html` — `window.SPECIAL_PROGRAM_DATA` (`data/special-program-data.js`) | `exhibition_detail.html` — `exhibition-{id}.json` |
| **행사** | `special-event.html` — `window.EVENT_PROGRAM_DATA` | `event_detail.html` — `event-{id}.json` |

| 항목 | 내용 |
|------|------|
| **JS 목록** | `exhibition-carousel.js`, `event-carousel.js` |
| **JS 상세** | `special/exhibition/js/exhibition-detail-page.js`, `special/event/js/event-detail-page.js` |
| **API 주석** | `fetchDetail` → `/api/exhibitions/{id}` (기획전 상세 HTML만 예시) |
| **API 제안** | `GET /api/v1/exhibitions`, `GET /api/v1/exhibitions/{id}`, `GET /api/v1/events`, `GET /api/v1/events/{id}` |

---

#### (7) 정적·인프라 (API 불필요 또는 2차)

| 항목 | 파일 | 비고 |
|------|------|------|
| GNB/푸터 HTML | `partials/left-gnb.html`, `partials/site-footer.html` | `fetch` include — 메뉴는 정적 또는 CMS 2차 |
| 오오극장 텍스트 페이지 | `theater-info.html`, `viewing-guide.html`, `membership.html`, … | 본문 HTML 정적; 멤버십 PDF 링크만 자산 URL |
| 인트로 | `index.html` + `intro.css` | 데이터 없음 |
| 카카오맵 | `osinneun-gil.html` | 클라이언트 SDK 키 — 서버 비밀 관리 권장 |
| 예매 링크 | 하드코딩 dtryx URL | 외부; API화 불필요 |

---

#### (8) 레거시·중복·빌드 도구

| 항목 | 설명 | Phase 2 조치 |
|------|------|--------------|
| `data/now-playing-data.js` | `NOW_PLAYING_MOVIES` — 매거진/기획전 페이지에 로드되나 **미참조 가능성** | 사용처 제거 후 삭제 또는 API 시드 |
| `movies/now-playing/{slug}.html` | `movie-detail.html` 리다이렉트 stub | 유지(SEO) 또는 서버 301 |
| `tools/*.js`, `tools/*.py` | JSON 추출·크롤·slug sync | **시드/import 스크립트**로 전환 |
| ~150+ `magazine/**/data/*.json` | 정적 기사 | DB bulk import |

---

## 5. API 전환 패턴 (Frontend 작업 가이드)

### 5.1 공통 클라이언트 (신규 권장)

```javascript
// js/api/client.js (신규)
var API_BASE = (window.TI_API_BASE || "/api/v1");

function apiGet(path) {
  return fetch(API_BASE + path, {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  }).then(function (res) {
    if (!res.ok) throw new Error("요청 실패 (" + res.status + ")");
    return res.json();
  });
}
```

- 개발: Vite/webpack **devServer.proxy** `/api` → `localhost:3000`.
- 운영: Nginx `location /api/ { proxy_pass http://backend; }`.

### 5.2 페이지별 교체 (1줄 원칙)

| Before | After |
|--------|-------|
| `dataUrl: "movies/.../now-playing-list.json"` | 삭제 |
| `fetchList` 없음 (JSON fetch) | `fetchList: () => apiGet("/movies?section=now-playing").then(d => d.movies)` |
| `week-schedule-data.js` script | `week-schedule.js`가 `apiGet("/schedule/week")` |
| `window.MAGAZINE_PREVIEW_DATA` script | 제거, `fetchList`만 사용 |

**`TI_*_CONFIG`는 유지** — 구현체만 API로 바꾸면 HTML diff 최소화 ([CSS리팩토링전략.md](./CSS리팩토링전략.md) §0 설계 의도와 일치).

---

## 6. API 엔드포인트 초안 (v1)

| Method | Path | 대체하는 정적 데이터 |
|--------|------|---------------------|
| GET | `/schedule/week?anchor=YYYY-MM-DD` | `week-schedule-data.js` |
| GET | `/movies?section=now-playing\|upcoming\|past` | `*-list.json` |
| GET | `/movies/{slug}` | `*-movies.json` 항목 |
| GET | `/magazine/preview` | `preview/data/index.json` |
| GET | `/magazine/preview/{id}` | `preview/data/{id}.json` |
| GET | `/magazine/serial` … | 동일 패턴 |
| GET | `/magazine/gv-moment` … | 동일 |
| GET | `/magazine/past-articles` … | `past-articles/data/*` |
| GET | `/exhibitions` | `special-program-data.js` |
| GET | `/exhibitions/{id}` | `exhibition-{id}.json` |
| GET | `/events` | `event-program-data.js` |
| GET | `/events/{id}` | `event-{id}.json` |

**공통 응답 규칙**

- 목록: `{ "items": [...], "meta": { "total", "page" } }` (페이지네이션은 기존 `TiPagePager`와 호환).
- 에러: `{ "error": { "code", "message" } }`.
- 날짜·상영: ISO 8601 저장, 표시용 `dateLabel`/`timeLabel`는 API에서 포맷 또는 프론트 포맷터.

---

## 7. DB 엔티티 개요 (MySQL / MariaDB)

> 물리 테이블명은 **§1.1 접두어**를 붙인 예시이다 (`cine_movies` 등). 실제 명칭은 기존 DB 네이밍 규칙·ERD와 합의 후 확정.

```mermaid
erDiagram
  cine_movies ||--o{ cine_screenings : has
  cine_movies {
    bigint id PK
    varchar slug UK
    varchar title_ko
    json metadata
  }
  cine_screenings {
    bigint id PK
    bigint movie_id FK
    datetime starts_at
    tinyint flags
  }
  cine_schedule_days ||--o{ cine_schedule_entries : contains
  cine_magazine_articles {
    bigint id PK
    varchar section
    varchar slug UK
    longtext content_html
  }
  cine_exhibitions ||--o{ cine_exhibition_films : contains
  cine_events {
    bigint id PK
    varchar slug UK
  }
```

| 테이블 (예시) | 설명 |
|---------------|------|
| `cine_movies` | 상영작 마스터 (slug UK, `metadata` JSON 컬럼) |
| `cine_movie_sections` | 현재/예정/지난 구간 이력 (또는 `section` ENUM + 기간) |
| `cine_screenings` | 상세 페이지 상영 회차 |
| `cine_schedule_days` / `cine_schedule_entries` | GNB 주간 시간표 |
| `cine_movie_title_aliases` | 시간표 표기 제목 ↔ `movie_id` (예: `고양심술` → 교생실습) |
| `cine_magazine_articles` | section + slug + HTML 본문 |
| `cine_exhibitions`, `cine_exhibition_films` | 기획전 + 참여 영화 |
| `cine_events` | 행사 프로그램 |

**MySQL 타입 메모**

- PK: `BIGINT UNSIGNED AUTO_INCREMENT` (기존 시스템이 BIGINT면 맞춤).
- slug/제목: `VARCHAR(191)` 이하 UK (utf8mb4 인덱스 길이 제한).
- JSON: MySQL 5.7+ `JSON` 타입 또는 `LONGTEXT` + 앱 검증.
- 일시: `DATETIME` (타임존은 API·서버 `Asia/Seoul` 고정 문서화).

**기존 시스템과의 관계 (P2-0에서 확인)**

- 상영·회원·예매 등 **이미 존재하는 테이블**이 있으면 신규 `cine_*`와 **FK 연결 vs slug만 소프트 참조** 결정.
- 중복 데이터(영화 마스터가 이미 있음) 시: 웹 전용 뷰·API는 **기존 테이블 읽기** + 웹 전용 보조 테이블만 추가.

**마이그레이션:** SQL 마이그레이션 파일( Flyway / Liquibase / Prisma migrate ) + JSON 1회 import 스크립트 `scripts/seed-from-json/`.

---

## 8. 개발 플랫폼 추천

현재 저장소 특성:

- **Frontend:** 정적 HTML/CSS/Vanilla JS, `TI_*_CONFIG`·`fetch` 추상화 완료.
- **도구:** Node(`tools/`), Python(`scripts/`) 혼재.
- **배포:** URL **루트 `/`**, 별도 빌드 파이프라인 없음 (`package.json` 없음). (테스트 이력: `/55cine/`)
- **규모:** 영화 ~50편, 매거진 기사 ~100+, 시간표 주 단위 갱신.
- **DB:** **기존 MySQL(MariaDB) 공용** — 신규 DBMS·DB 컨테이너 도입 없음.

### 8.1 추천 조합 (1순위)

| 계층 | 기술 | 이유 |
|------|------|------|
| **Frontend** | **현 구조 유지** + 선택적 **Vite** (dev proxy만) | HTML/JS 재작성 없이 API 연동; HMR·프록시로 CORS 해소 |
| **Backend** | **Node.js 20 LTS + Fastify + TypeScript** | `api/` 신규 코드만 TS — Prisma·Zod·라우트 타입 ([§8.6](#86-typescript-도입-검토)) |
| **ORM** | **Prisma (`provider = "mysql"`)** 또는 **Knex.js** | 마이그레이션·시드; 팀이 PHP/기존 스택이면 **기존 ORM 규칙에 맞춰 Knex만**도 가능 |
| **DB** | **기존 MySQL / MariaDB** | 관련 시스템과 동일 인스턴스·운영 정책(백업·계정) 재사용 |
| **연결** | 환경 변수 `DATABASE_URL` (팀 제공) | 예: `mysql://web_api:***@db-host:3306/theater_db` |
| **스토리지** | 기존 웹 루트 `images/` → 2차 CDN | DB에는 URL·경로만 저장 |
| **배포** | **단일 웹 서버** Nginx + PM2(API) | [§1.2](#12-운영-인프라-구성-일-사용자-5000명-기준) 토폴로지 |
| **로컬 개발** | 정적 로컬 + API 로컬 → **외부 dev RDB** | DB Docker 없음 |

### 8.2 대안 (2순위)

| 계층 | 기술 | 선택 시점 |
|------|------|-----------|
| **Backend** | **Python FastAPI + SQLAlchemy** | 기존 관련 시스템 백엔드가 이미 Python/MySQL일 때 |
| **Backend** | **PHP (Laravel/Slim)** | 동일 서버의 PHP·MySQL 스택과 통합 배포할 때 |
| **CMS** | **Strapi (MySQL connector)** | 비개발자 편집 — **DB가 MySQL이어야** 하며 별도 Postgres 에디션은 사용 안 함 |

### 8.3 비추천 (현 단계)

| 기술 | 사유 |
|------|------|
| **PostgreSQL 신규 도입** | 운영·백업·계정 이원화; 기존 시스템과 DB 불일치 |
| **Docker Compose로 DB 기동** | 공용 MariaDB 정책과 충돌; 로컬·운영 데이터 원천 분리 곤란 |
| **Supabase(Postgres)** | DBMS가 요구사항(MySQL)과 다름 |
| Next.js / Nuxt 전면 전환 | Phase 1 자산·경로·GNB 셸 재이식 비용 큼 |
| **Frontend 전면 TypeScript** | 정적 HTML에 `<script>` 직결 구조와 상충; 빌드·전 파일 변환 비용 대비 이득 적음 ([§8.6](#86-typescript-도입-검토)) |
| MongoDB only | 상영·시간표·slug 관계에 RDB·기존 MySQL 생태계와 맞음 |

### 8.4 권장 저장소 구조 (Phase 2)

```
55cine-website/          # Frontend (Vanilla JS, 빌드 없음 — 정적 배포)
  js/                    # 기존 .js 유지
  js/api/                # (신규) fetch 클라이언트 — .js + JSDoc 권장
api/                     # Backend — TypeScript 전용
  package.json
  tsconfig.json
  src/
    index.ts
    routes/
    services/
    schemas/             # Zod — 요청·응답·DB 매핑
  dist/                  # tsc 빌드 산출 (gitignore, PM2가 실행)
  prisma/
    schema.prisma
    migrations/
  scripts/
    seed-from-json/
.env.example             # DATABASE_URL=mysql://...
```

- **`docker-compose.yml`**: API 서비스만 정의 가능(선택). **`db:` 서비스는 두지 않음.**
- DB 마이그레이션은 CI 또는 배포 전 **공용 DB에 대해** DBA 승인 후 적용.
- **배포:** `api/`에서 `npm run build` 후 `node dist/index.js` (또는 `tsx`는 dev만).

### 8.6 TypeScript 도입 검토

**현황 (2026년 기준)**

| 항목 | 수치·상태 |
|------|-----------|
| **Frontend JS** | `js/` 약 22파일 · ~5,500줄, IIFE + `window.TI_*_CONFIG` |
| **빌드** | 루트 `package.json` 없음 — HTML이 `.js`를 **그대로** 로드 |
| **배포** | Nginx 정적 + (예정) `/api/` 프록시 |
| **데이터** | JSON shape가 사실상 스키마 — API 전환 시 계약 정의가 핵심 |

**결론: 계층별 채택**

| 계층 | TypeScript | 판단 |
|------|------------|------|
| **Frontend** (`js/`, `components/`) | **Phase 2 비권장** | 정적 배포·기존 패턴 유지가 효율적 ([§3.1](#31-frontend-유지보강)) |
| **Backend** (`api/`) | **권장** | 신규 코드베이스 — Prisma Client·Fastify·Zod와 궁합 좋음 |
| **도구** (`tools/`, `scripts/`) | **유지 (JS/Python)** | 일회성·배치; TS 전환 우선순위 낮음 |

#### Frontend — Vanilla JS 유지

**TS 전환이 비효율적인 이유**

1. **빌드 파이프라인 필수** — 모든 페이지 `script src`를 `dist/`로 바꾸고, dev·배포에 번들러(Vite/esbuild) 추가.
2. **이미 추상화됨** — `TI_*_CONFIG`, `TiSiteRoot`, 페이지별 렌더러로 규모(~50편·기사 100+)에 충분.
3. **Phase 2 목표와 불일치** — “HTML/CSS 유지 + `fetch*`만 API로 교체”; TS는 범위·리스크만 키움.
4. **타입 이득 제한** — DOM·설정 객체 위주; 복잡한 제네릭·대규모 모듈 그래프 없음.

**대안 (가벼운 계약)**

- `js/api/client.js`에 **JSDoc `@typedef`** (MovieListItem, ScheduleWeek 등) — 에디터 자동완성.
- P2-0 **`openapi.yaml`** → (선택) `openapi-typescript`로 **개발용** `.d.ts` 생성, Frontend는 여전히 `.js`.
- API 응답은 Phase 1 JSON과 **동일 shape** 유지 → 런타임 깨짐은 통합 테스트·스테이징으로 검증.

#### Backend — TypeScript 권장

**효율적인 이유**

1. **Greenfield** — `api/`만 신규; 기존 `js/` 변환 없음.
2. **Prisma** — `schema.prisma` → **생성 타입**으로 쿼리·시드 안전.
3. **Zod** — `cine_*`·REST 응답 검증 + `z.infer<>`로 타입 추론; OpenAPI와 병행 가능.
4. **Fastify** — 라우트·쿼리스트링 타입 지정 용이; PM2는 `dist/`만 실행.
5. **공유** — `api/src/schemas/`를 단일 소스로 두고, Frontend는 문서·OpenAPI로 동기화 (모노레포 `packages/types`는 인원·복잡도 증가 시).

**스택 예시**

| 용도 | 패키지 |
|------|--------|
| 런타임 | `typescript`, `tsx`(dev), `fastify`, `@prisma/client` |
| 검증 | `zod` (또는 `fastify-type-provider-zod`) |
| 빌드 | `tsc` → `dist/`, `npm run build`를 배포 전 필수 |

#### 2차에 Frontend TS를 검토할 때

- 관리자 UI를 **React/Vue SPA**로 새로 만들 때.
- 전면 프레임워크 전환(Next/Nuxt)을 별도 트랙으로 승인했을 때.
- 팀 전원 TS·번들러 운영이 일상화된 이후.

### 8.5 개발·운영 연결 (MySQL)

| 환경 | 웹 서버 (Front+Back) | RDB |
|------|----------------------|-----|
| 로컬 | PC에서 정적 + `localhost:3000` API | **외부 dev** MariaDB (SSH 터널/VPN) |
| 스테이징 | **1대** Nginx + API (2 vCPU / 4 GB 가능) | 외부 RDB · 스테이징 schema |
| 운영 | **1대** Nginx + API ([§1.2.4](#124-웹-서버-적정-사양-권장) 4 vCPU / 8 GB) | **외부** 공용 MariaDB |

**P2-0 필수 산출물:** 기존 DB ERD·`cine_*` 테이블 명세·웹 API DB 계정·**웹 서버→RDB 방화벽 허용 IP** 합의서.

---

## 9. Phase 2 작업 순서 (권장)

| 단계 | 작업 | 산출물 |
|------|------|--------|
| **P2-0** | **기존 MySQL ERD 합의** + API 스키마·OpenAPI (TS/Zod 타입 단일 소스 후보) | 합의서, `openapi.yaml` |
| **P2-1** | **`api/` TypeScript** Fastify 스켈레톤 + DB 연결 (`tsc`→`dist`, `/api/v1/health`) | `package.json`, `tsconfig.json`, migration 1차 |
| **P2-2** | JSON → **MySQL** 시드 (movies, magazine) | seed SQL/스크립트 |
| **P2-3** | `GET /movies`, `GET /movies/{slug}` | Frontend 3목록+상세 연동 |
| **P2-4** | `GET /schedule/week` | GNB `week-schedule.js` 연동, 테스트 날짜 제거 |
| **P2-5** | Magazine API + 상세 4종 | `fetchArticle` / `fetchIndex` |
| **P2-6** | Exhibitions / Events API | 캐러셀 2종 |
| **P2-7** | Nginx 루트 `/` + `/api/`([§1.3](#13-배포-url-경로-루트-))·`/55cine/` 301·CORS·캐시 | 스테이징 URL |
| **P2-8** | (선택) 관리자 최소 UI | 상영작·시간표 입력 |

---

## 10. 비기능 요구사항

| 항목 | 요구 |
|------|------|
| **성능** | 일 DAU 5,000 기준 [§1.2.3](#123-트래픽-가정-일-사용자-5000명); API p95 &lt; 300ms; 시간표 `max-age=60` |
| **용량** | 웹 서버 **4 vCPU / 8 GB / 80 GB SSD** 권장 ([§1.2.4](#124-웹-서버-적정-사양-권장)) |
| **가용성** | **기존 DB 백업 정책** 준수(웹 테이블 포함); API 무응답 시 Frontend JSON fallback (선택, 2차) |
| **보안** | 관리 API 인증; HTML 본문 sanitize(XSS); Kakao API 키는 env |
| **SEO** | 상영작·기사 slug URL 유지; `movie-detail.html?slug=` 유지 |
| **i18n** | 1차 한국어만 (`title_ko` / `title_en` 필드는 유지) |

---

## 11. 체크리스트 — JSON 제거 전 확인

- [ ] `week-schedule.js` — `getScheduleToday` 테스트 블록 제거
- [ ] `past-playing.html` — `testSpinnerDelayMs` 제거(배포 시)
- [ ] 모든 페이지 `TI_*_CONFIG.fetch*` API 연결
- [ ] `data/week-schedule-data.js` — API 연동 후 삭제 또는 빌드 제외
- [ ] `data/now-playing-data.js` — 미사용 script 태그 제거
- [ ] Magazine `data/*.js` 레거시 — `fetchList` 통일 후 script 제거
- [ ] `css/README.md` · API URL 문서 갱신
- [ ] Nginx: 정적 `location /` + `location /api/` → API 프록시 테스트
- [ ] (선택) `/55cine/` → `/` 301 리다이렉트·주요 페이지·GNB 링크 루트 URL 확인 ([§1.3](#13-배포-url-경로-루트-))
- [ ] `TiSiteRoot.debug()` — `prefix: "/"` (운영·로컬 루트 서빙 시)
- [ ] 기존 MySQL에 `cine_*`(가칭) 테이블 마이그레이션 **DBA/담당 승인**
- [ ] API DB 계정이 **기존 테이블 미변경** 권한인지 확인
- [ ] PostgreSQL/Docker DB 관련 문서·스크립트 없음 확인
- [ ] 운영 웹 서버 디렉터리·Nginx vhost ([§1.2.2](#122-웹-서버-내부-구성)) 반영
- [ ] 외부 RDB 방화벽: 웹 서버 IP → `3306` 허용
- [ ] PM2(API×2) + Nginx 재시작·로그 로테이션 설정
- [ ] `api/` 배포: `npm run build` → `dist/` 실행 ([§8.6](#86-typescript-도입-검토))

---

## 12. 참고 문서

| 문서 | 용도 |
|------|------|
| [designsystem.html](./designsystem.html) | UI·토큰·CSS 번들 |
| [디자인시스템검토.md](./디자인시스템검토.md) | UI 일관성 개선 (API와 병행 가능) |
| [css/README.md](./css/README.md) | 페이지별 CSS |
| [CSS리팩토링전략.md](./CSS리팩토링전략.md) | Phase 1 완료 범위 |
| [오오극장 홈페이지재구축.md](./오오극장%20홈페이지재구축.md) | 기능 백로그 |

---

*작성: Phase 2 킥오프 — Frontend/Backend 분리, JSON 인벤토리, **외부 공용 MySQL(MariaDB)**, **단일 웹 서버 + 외부 RDB**, **URL 루트 `/`**, **Backend TS / Frontend JS** 반영.*

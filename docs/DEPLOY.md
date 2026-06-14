# 55cine 운영 서버 배포 가이드 (요약)

> **비전문가용 상세 매뉴얼:** [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) (수동) · [AUTO-DEPLOY.md](./AUTO-DEPLOY.md) (자동/CD)  
> **images만 부분 배포 · CD 업로드 보호:** [IMAGES-DEPLOY.md](./IMAGES-DEPLOY.md)  
> **images 제외 빠른 배포:** [DEPLOY-WITHOUT-IMAGES.md](./DEPLOY-WITHOUT-IMAGES.md)

운영 서버에 정적 프론트엔드 + Node.js API + Nginx 리버스 프록시를 구성하는 절차입니다.
## 아키텍처

```
브라우저
   │
   ▼
Nginx (:80)  ── /        → /var/www/55cine (HTML/CSS/JS/images)
           └── /api/*    → http://127.0.0.1:3000/api/* (Fastify)
                              │
                              ▼
                         MS SQL (RDS, 기존 .env 설정)
```

| 구성 요소 | 경로·포트 |
|-----------|-----------|
| 사이트 루트 | `/var/www/55cine` |
| API | `/var/www/55cine/api` (`node dist/index.js`, 포트 3000) |
| 환경 변수 | `/var/www/55cine/.env` |
| Nginx 설정 | `/etc/nginx/sites-available/55cine.conf` |
| systemd | `/etc/systemd/system/55cine-api.service` |

## 사전 요구

- Ubuntu 22.04+ (또는 Debian 계열)
- root 또는 sudo 권한
- RDS(MS SQL) 접속 정보 (로컬 `.env`와 동일)
- Node.js 20+, Nginx

## 1. 서버 최초 부트스트랩 (1회)

저장소의 스크립트를 서버에 올린 뒤 실행하거나, SSH로 직접 실행합니다.

```bash
# 서버에서
bash deploy/scripts/server-bootstrap.sh
```

수행 내용:

1. `apt update`
2. Node.js 20 (NodeSource) 설치
3. Nginx 설치 및 `systemctl enable nginx`
4. `/var/www/55cine` 디렉터리 생성

## 2. Nginx 설치·설정

Nginx가 없으면 `server-bootstrap.sh`가 설치합니다. 설정 파일은 저장소에 포함되어 있습니다.

```bash
cp deploy/nginx/55cine.conf /etc/nginx/sites-available/55cine.conf
ln -sf /etc/nginx/sites-available/55cine.conf /etc/nginx/sites-enabled/55cine.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### 주요 설정

- **정적 파일**: `root /var/www/55cine`, `try_files $uri $uri/ $uri.html`
- **API 프록시**: `location /api/` → `http://127.0.0.1:3000/api/`
- **업로드 한도**: `client_max_body_size 25m` (관리자 이미지 업로드)

프론트엔드 `js/api/client.js`는 운영 호스트에서 `TI_API_BASE = "/api/v1"` 을 사용합니다.

## 3. 운영 `.env` 작성

서버 `/var/www/55cine/.env` (git 커밋 금지):

```env
DB_SERVER=<RDS 호스트>
DB_PORT=1433
DB_DATABASE=cine55
DB_USER=<계정>
DB_PASSWORD=<비밀번호>
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

API_HOST=0.0.0.0
API_PORT=3000
API_PREFIX=/api/v1
TZ=Asia/Seoul
```

## 4. 수동 배포 (로컬 → 서버)

### 4-1. API 빌드

```bash
cd api
npm ci
npm run build
```

### 4-2. Python 배포 스크립트 (권장)

```bash
pip install paramiko
export DEPLOY_HOST=49.247.139.238
export DEPLOY_USER=root
export DEPLOY_PASSWORD='<서버 비밀번호>'
python deploy/scripts/deploy-from-local.py
```

스크립트가 수행하는 작업:

1. 프로젝트 tarball 생성 (`.git`, `node_modules` 제외)
2. SFTP 업로드 → `/var/www/55cine` 압축 해제
3. **서버 images stash → merge** (관리자 업로드 보호, [IMAGES-DEPLOY.md](./IMAGES-DEPLOY.md))
4. `.env` 업로드
5. `remote-setup.sh` 실행 (npm ci, systemd, nginx reload)

### 4-3. 서버에서 앱만 재설정

파일이 이미 있을 때:

```bash
bash /var/www/55cine/deploy/scripts/remote-setup.sh /var/www/55cine
```

## 5. systemd (API 데몬)

```bash
cp deploy/systemd/55cine-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable 55cine-api
systemctl start 55cine-api
systemctl status 55cine-api
```

로그 확인:

```bash
journalctl -u 55cine-api -f
```

## 6. 배포 확인

```bash
# API 헬스
curl http://127.0.0.1/api/v1/health

# 메인 페이지
curl -I http://127.0.0.1/
```

브라우저: `http://49.247.139.238/`

## 7. 트러블슈팅

| 증상 | 확인 |
|------|------|
| SFTP `OSError: Failure` (대용량 업로드) | 서버 `/tmp`는 tmpfs(~480MB). tarball은 `/root/`에 업로드 (`deploy-from-local.py` 반영됨) |
| 502 Bad Gateway | `systemctl status 55cine-api`, 포트 3000 리슨 여부 |
| DB 연결 실패 | `.env` RDS 값, 보안 그룹(서버 IP → 1433 허용) |
| 이미지 업로드 실패 | Nginx `client_max_body_size`, `images/` 디렉터리 권한 |
| images만 빠르게 반영 | [IMAGES-DEPLOY.md](./IMAGES-DEPLOY.md) — `rsync-images.sh` / `rsync-images.py` |
| CD 후 서버 업로드 이미지 덮어씀 | `server-images-guard.sh` stash/merge — [IMAGES-DEPLOY.md](./IMAGES-DEPLOY.md) |
| API CORS | 운영은 same-origin `/api/v1` 사용 — 별도 CORS 불필요 |

권한:

```bash
chown -R www-data:www-data /var/www/55cine
chmod 640 /var/www/55cine/.env
```

## 8. HTTPS (선택)

도메인 연결 후 Certbot 사용:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.example
```

`deploy/nginx/55cine.conf`의 `server_name`을 실제 도메인으로 변경합니다.

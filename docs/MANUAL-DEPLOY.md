# 55cine 수동 배포 매뉴얼

> **대상:** 개발 경험이 적은 분도 따라 할 수 있도록 작성했습니다.  
> **목적:** 내 PC(Windows)에서 수정한 사이트를 **운영 서버**에 직접 올리는 방법입니다.

---

## 이 문서에서 하는 일

| 구분 | 설명 |
|------|------|
| **프론트엔드** | HTML, CSS, JS, 이미지 등 방문자가 보는 화면 |
| **백엔드(API)** | 데이터베이스와 연결되는 Node.js 프로그램 |
| **운영 서버** | 실제 사용자가 접속하는 서버 (현재 IP: `49.247.139.238`) |
| **DB(RDS)** | 이미 클라우드에 있는 MS SQL — **바꾸지 않고 그대로 사용** |

수동 배포는 **“내 컴퓨터 → 운영 서버로 파일 복사 + API 재시작”** 입니다.

---

## 1. 미리 준비할 것

### 1-1. 내 PC에 설치되어 있어야 하는 프로그램

| 프로그램 | 확인 방법 | 없으면 |
|----------|-----------|--------|
| **Git** | 터미널에서 `git --version` | [git-scm.com](https://git-scm.com/) 설치 |
| **Node.js 20** | `node -v` → `v20.x` | [nodejs.org](https://nodejs.org/) LTS 설치 |
| **Python 3** | `python --version` | [python.org](https://www.python.org/) 설치 |
| **프로젝트 폴더** | `C:\Projects\55cine-website` 등 | Git clone 또는 기존 폴더 사용 |

### 1-2. 알아 두어야 하는 정보 (관리자에게 받기)

- **운영 서버 IP:** `49.247.139.238`
- **SSH 계정:** `root`
- **SSH 비밀번호:** (서버 접속용 — 채팅·메일로 공유받기)
- **DB 접속 정보:** 프로젝트 루트의 `.env` 파일에 이미 있음 (git에는 올리지 않음)

### 1-3. `.env` 파일이 있는지 확인

프로젝트 **최상위 폴더**에 `.env` 파일이 있어야 합니다.

```
55cine-website/
  .env          ← 이 파일 (없으면 .env.example 참고해서 작성)
  api/
  index.html
  ...
```

`.env` 예시는 `deploy/.env.production.example` 을 참고하세요.  
**절대 GitHub에 `.env`를 올리지 마세요.**

---

## 2. 배포가 어떻게 동작하는지 (개념)

```
[내 PC]                          [운영 서버 49.247.139.238]
  │                                      │
  │  1) API 빌드 (TypeScript → JS)       │
  │  2) 전체 사이트를 압축 파일로 묶음      │
  │  3) 압축 파일 + .env 업로드  ────────► │  /var/www/55cine/ 에 풀기
  │                                      │  4) npm 설치, API 재시작
  │                                      │  5) Nginx(웹서버) 설정 반영
  │                                      │
  │  ◄── 브라우저에서 http://49.247.../ 접속
```

- **Nginx:** 사용자 요청을 받아 HTML은 파일로, `/api/` 요청은 API 프로그램으로 넘깁니다.
- **API:** 포트 3000에서 실행되며, DB(RDS)와 통신합니다.

---

## 3. 최초 1회 — 운영 서버 준비 (이미 완료된 경우 건너뛰기)

운영 서버에 **Node.js·Nginx·폴더**가 없을 때만 1회 실행합니다.  
(2026년 6월 기준으로 이미 설치되어 있으면 **4장부터** 진행하면 됩니다.)

### 3-1. 서버에 SSH로 접속

**Windows — PowerShell 또는 Git Bash:**

```bash
ssh root@49.247.139.238
```

비밀번호를 입력하면 서버에 접속됩니다.

### 3-2. 부트스트랩 스크립트 실행

서버에 프로젝트가 아직 없다면, 먼저 로컬에서 한 번 배포(4장)를 해 파일을 올린 뒤:

```bash
bash /var/www/55cine/deploy/scripts/server-bootstrap.sh
```

이 스크립트가 하는 일:

1. Ubuntu 패키지 목록 갱신
2. **Node.js 20** 설치
3. **Nginx** 설치 및 자동 시작 설정
4. `/var/www/55cine` 폴더 생성

끝나면 `node -v`, `nginx -v` 버전이 출력됩니다.

---

## 4. 일반적인 수동 배포 (매번 하는 작업)

코드를 수정한 뒤 운영에 반영할 때 **아래 순서대로** 진행합니다.

### 4-1. 터미널 열기

- Windows: **Git Bash** 또는 **PowerShell**
- 프로젝트 폴더로 이동:

```bash
cd C:/Projects/55cine-website
```

> 경로는 본인 PC에 맞게 바꿉니다.

### 4-2. API 빌드

백엔드(TypeScript)를 실행 가능한 JavaScript로 변환합니다.

```bash
cd api
npm ci
npm run build
cd ..
```

**성공 확인:** `api/dist/` 폴더 안에 `.js` 파일들이 생겼는지 확인합니다.

**오류가 나면:**

- `node -v`가 20 이상인지 확인
- `npm ci` 실패 시 `npm install` 후 다시 `npm run build`

### 4-3. Python 배포 도구 설치 (최초 1회)

```bash
pip install paramiko
```

`paramiko`는 서버에 파일을 안전하게 올리기 위한 라이브러리입니다.

### 4-4. 배포 실행 (한 줄로)

**Git Bash (권장):**

```bash
export DEPLOY_HOST=49.247.139.238
export DEPLOY_USER=root
export DEPLOY_PASSWORD='여기에_서버_비밀번호'
python deploy/scripts/deploy-from-local.py
```

**PowerShell:**

```powershell
$env:DEPLOY_HOST = "49.247.139.238"
$env:DEPLOY_USER = "root"
$env:DEPLOY_PASSWORD = "여기에_서버_비밀번호"
python deploy/scripts/deploy-from-local.py
```

> 비밀번호에 `!`, `#`, `$` 등 특수문자가 있으면 **작은따옴표**로 감싸세요.

### 4-5. 스크립트가 하는 일 (진행 중 화면)

| 단계 | 화면에 보이는 메시지 | 설명 |
|------|---------------------|------|
| 1 | `[pack]` | 사이트 전체를 압축 (약 2GB, **10~20분** 걸릴 수 있음) |
| 2 | `[ssh] connect` | 서버 접속 |
| 3 | `[sftp] upload` | 압축 파일 업로드 (진행률 `%` 표시) |
| 4 | `tar -xzf` | 서버에서 압축 해제 |
| 5 | `remote-setup.sh` | npm 설치, API·Nginx 재시작 |
| 6 | `[deploy] complete` | **완료** |

압축 파일은 서버의 `/root/55cine-deploy.tar.gz` 로 올라갔다가, 풀린 뒤 **자동 삭제**됩니다.

### 4-6. 배포 성공 확인

**브라우저:**

1. [http://49.247.139.238/](http://49.247.139.238/) — 메인 페이지가 보이는지
2. [http://49.247.139.238/api/v1/health](http://49.247.139.238/api/v1/health) — 아래와 비슷한 JSON

```json
{"status":"ok","dbConfigured":true,"db":"connected"}
```

`db: "connected"` 이면 DB 연결도 정상입니다.

---

## 5. 이미 압축 파일만 만들어 둔 경우

업로드만 다시 하고 싶을 때:

```bash
# 1) 압축만 생성
python deploy/scripts/pack-release.py
# → release/55cine-deploy.tar.gz 생성

# 2) 기존 tarball로 배포 (재압축 생략)
export DEPLOY_HOST=49.247.139.238
export DEPLOY_USER=root
export DEPLOY_PASSWORD='비밀번호'
python deploy/scripts/deploy-from-local.py --tar release/55cine-deploy.tar.gz --env .env
```

---

## 6. 서버에만 접속해서 재시작만 할 때

파일은 이미 서버에 있는데 **API만 다시 켜고 싶을 때** (SSH 접속 후):

```bash
ssh root@49.247.139.238

bash /var/www/55cine/deploy/scripts/remote-setup.sh /var/www/55cine
```

또는 API만:

```bash
systemctl restart 55cine-api
systemctl status 55cine-api
```

---

## 7. 자주 나는 문제와 해결

### Q1. `pip install paramiko` / `python` 을 찾을 수 없음

- Python 설치 시 **“Add Python to PATH”** 체크 후 재설치
- 또는 `py -3 deploy/scripts/deploy-from-local.py` 로 실행

### Q2. SFTP 업로드 중 `OSError: Failure`

- **원인:** 예전에는 `/tmp` 용량(약 480MB) 부족
- **현재 스크립트:** `/root/` 로 업로드하도록 수정됨 → 최신 `deploy-from-local.py` 사용
- **디스크 확인 (서버):** `df -h /` — 여유 공간 5GB 이상 권장

### Q3. `pipefail: invalid option name` / `remote-setup.sh` 오류

- **원인:** Windows에서 만든 스크립트 줄바꿈(CRLF) 문제
- **해결:** 최신 배포 스크립트는 자동으로 `sed` 변환 후 실행
- 수동 실행 시: `sed -i 's/\r$//' /var/www/55cine/deploy/scripts/*.sh` 후 다시 `bash remote-setup.sh`

### Q4. 사이트는 되는데 API만 502 Bad Gateway

서버에서:

```bash
systemctl status 55cine-api
journalctl -u 55cine-api -n 50
```

- `.env` DB 정보 오류
- RDS 방화벽에 **운영 서버 IP** 허용 필요 (호스팅 업체·DB 관리자에게 요청)

### Q5. 배포는 됐는데 예전 화면이 보임

- 브라우저 **강력 새로고침:** `Ctrl + Shift + R` (Mac: `Cmd + Shift + R`)
- CDN/캐시 사용 중이면 캐시 purge

### Q6. `.env`를 바꿨는데 반영이 안 됨

- 수동 배포 시 `--env .env` 로 로컬 `.env`가 서버에 덮어씌워짐
- 변경 후: `systemctl restart 55cine-api`

---

## 8. 배포 체크리스트 (인쇄용)

```
□ 로컬에서 원하는 수정·테스트 완료
□ cd api && npm ci && npm run build 성공
□ .env 파일 존재 및 DB 정보 확인
□ DEPLOY_HOST / DEPLOY_USER / DEPLOY_PASSWORD 설정
□ python deploy/scripts/deploy-from-local.py 실행
□ [deploy] complete 메시지 확인
□ http://49.247.139.238/ 메인 페이지 확인
□ http://49.247.139.238/api/v1/health → db: connected 확인
□ 관리자(/admin/) 로그인·저장 한 번 테스트 (선택)
```

---

## 9. 관련 파일 위치

| 파일 | 설명 |
|------|------|
| `deploy/scripts/deploy-from-local.py` | 로컬 → 서버 배포 메인 스크립트 |
| `deploy/scripts/pack-release.py` | 압축만 만들 때 |
| `deploy/scripts/remote-setup.sh` | 서버에서 npm·systemd·nginx 처리 |
| `deploy/scripts/server-bootstrap.sh` | 서버 최초 Node+Nginx 설치 |
| `deploy/nginx/55cine.conf` | Nginx 설정 |
| `deploy/systemd/55cine-api.service` | API 자동 실행 설정 |
| `.env` | DB·API 설정 (비밀, git 제외) |

---

## 10. 자동 배포(CD)를 쓰고 싶다면

매번 PC에서 수동으로 올리지 않고, **GitHub에 push하면 자동 배포**하려면  
→ [AUTO-DEPLOY.md](./AUTO-DEPLOY.md) 를 참고하세요.

---

## 11. 용어 간단 설명

| 용어 | 뜻 |
|------|-----|
| **SSH** | 원격 서버에 명령을 내리는 접속 방식 |
| **SFTP** | SSH를 이용한 파일 전송 |
| **Nginx** | 웹 서버 (HTML 제공 + API로 연결) |
| **systemd** | Linux에서 API를 백그라운드 서비스로 실행 |
| **tarball** | 여러 파일을 하나로 묶은 압축 파일 (`.tar.gz`) |
| **RDS** | 클라우드 DB (MS SQL) |

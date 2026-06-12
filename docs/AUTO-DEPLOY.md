# 55cine 자동 배포(CD) 매뉴얼

> **대상:** 개발 경험이 적은 분도 따라 할 수 있도록 작성했습니다.  
> **목적:** GitHub에 코드를 **push**하면 **운영 서버에 자동으로 배포**되게 설정하는 방법입니다.

---

## 이 문서에서 하는 일

| 수동 배포 | 자동 배포 (CD) |
|-----------|----------------|
| 내 PC에서 Python 스크립트 실행 | GitHub Actions가 클라우드에서 실행 |
| 매번 비밀번호 입력 | 한 번 Secrets 등록 후 자동 |
| 로컬 PC가 켜져 있어야 함 | push만 하면 됨 |

**CD = Continuous Deployment (지속적 배포)**  
`main` 브랜치에 merge/push 하면 운영 서버(`49.247.139.238`)에 자동 반영됩니다.

---

## 1. 전체 흐름 (그림)

```
[개발자 PC]
    │
    │  git add / commit / push (main 브랜치)
    ▼
[GitHub 저장소]
    │
    │  GitHub Actions 워크플로 시작
    ▼
[GitHub 클라우드 머신]
    1) 코드 받기
    2) API 빌드 (npm run build)
    3) .env 작성 (Secrets에서)
    4) 사이트 압축
    5) SCP로 운영 서버에 업로드
    6) SSH로 압축 해제 + API 재시작
    ▼
[운영 서버 49.247.139.238]
    Nginx + API → 사용자 접속
```

워크플로 정의 파일: `.github/workflows/deploy.yml`

---

## 2. 시작하기 전 확인 사항

### 2-1. 필수 조건

| 항목 | 확인 |
|------|------|
| GitHub 저장소 | `gideok/55cine-website` (또는 사용 중인 repo) |
| 저장소 접근 권한 | Settings · Secrets를 바꿀 수 있는 **Admin** 권한 |
| 운영 서버 | SSH 접속 가능 (`root@49.247.139.238`) |
| 서버 1회 준비 | Node.js 20 + Nginx 설치됨 ([MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) 3장) |
| `.github/workflows/deploy.yml` | 저장소에 포함되어 있음 |

### 2-2. 자동 배포 vs 수동 배포 — 언제 무엇을 쓸까?

| 상황 | 권장 |
|------|------|
| 평소 코드 반영 | **자동 배포** (main push) |
| Secrets·서버 최초 설정 | 수동 1회 + 이 문서 3~4장 |
| GitHub Actions 장애 | [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) 로 긴급 배포 |
| 대용량 이미지만 서버에 직접 올림 | 수동 또는 서버에서 rsync |

---

## 3. 1회 설정 — GitHub Secrets 등록

Secrets는 **비밀번호·DB 정보를 GitHub에 안전하게 보관**하는 곳입니다.  
코드에는 들어가지 않고, Actions 실행 시에만 사용됩니다.

### 3-1. GitHub 웹에서 이동

1. 브라우저에서 GitHub 저장소 열기  
   예: `https://github.com/gideok/55cine-website`
2. 상단 **Settings** (설정) 클릭  
   → Settings가 안 보이면 저장소 Admin 권한이 없는 것입니다.
3. 왼쪽 메뉴 **Secrets and variables** → **Actions**
4. **New repository secret** 버튼 클릭

### 3-2. 등록할 Secret 목록

아래 **Name** 을 정확히 입력하고, **Secret** 칸에 값을 넣습니다.

#### (1) `DEPLOY_HOST`

| Name | Secret 값 |
|------|-----------|
| `DEPLOY_HOST` | `49.247.139.238` |

운영 서버 IP(또는 도메인)입니다.

---

#### (2) `DEPLOY_USER`

| Name | Secret |
|------|--------|
| `DEPLOY_USER` | `root` |

SSH 로그인 계정입니다.

---

#### (3) `DEPLOY_PASSWORD` (비밀번호 방식)

| Name | Secret |
|------|--------|
| `DEPLOY_PASSWORD` | 서버 root 비밀번호 |

> **주의:** 비밀번호는 GitHub Issue, 채팅 로그, 코드에 **절대 적지 마세요.**

SSH **키 방식**을 쓰면 이 Secret은 비워 두거나 등록하지 않아도 됩니다 (4장 참고).

---

#### (4) `DEPLOY_SSH_KEY` (키 방식 — 권장)

서버에서 한 번만 키를 만듭니다.

```bash
ssh root@49.247.139.238

ssh-keygen -t ed25519 -C "github-actions-55cine" -f /root/.ssh/github_actions -N ""
cat /root/.ssh/github_actions.pub >> /root/.ssh/authorized_keys
cat /root/.ssh/github_actions
```

마지막 `cat` 출력 **전체** (`-----BEGIN OPENSSH PRIVATE KEY-----` 부터 `-----END...` 까지)를 복사합니다.

| Name | Secret |
|------|--------|
| `DEPLOY_SSH_KEY` | (복사한 개인키 전체) |

키 방식을 쓰면 `DEPLOY_PASSWORD`보다 **안전**합니다.

---

#### (5) `DEPLOY_PORT` (선택)

SSH 포트가 22가 **아닐 때만** 등록합니다.

| Name | Secret |
|------|--------|
| `DEPLOY_PORT` | `22` |

기본값 22이면 **등록하지 않아도** 됩니다.

---

#### (6) `PROD_ENV_FILE` (중요 — DB·API 설정)

운영 서버의 `.env` **파일 내용 전체**를 한 Secret에 넣습니다.

**New repository secret:**

| Name | Secret |
|------|--------|
| `PROD_ENV_FILE` | 아래 블록 전체 (값은 실제 정보로 교체) |

```env
DB_SERVER=ms1201.gabiadb.com
DB_PORT=1433
DB_DATABASE=cine55
DB_USER=dbadmin
DB_PASSWORD=실제_RDS_비밀번호
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

API_HOST=0.0.0.0
API_PORT=3000
API_PREFIX=/api/v1
TZ=Asia/Seoul
```

- **줄바꿈 포함** 그대로 붙여 넣기
- `DB_PASSWORD`는 RDS 실제 비밀번호
- 로컬 `.env`와 동일해도 됨 (단, git에는 커밋 금지)

---

### 3-3. Secrets 등록 완료 확인

**Settings → Secrets and variables → Actions** 에서 다음이 보이면 됩니다:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PASSWORD` 또는 `DEPLOY_SSH_KEY` (하나 이상)
- `PROD_ENV_FILE`
- (선택) `DEPLOY_PORT`

Secret 값은 **한 번 저장하면 다시 볼 수 없습니다.** 분실 시 새로 등록하세요.

---

## 4. 자동 배포가 실행되는 시점

### 4-1. 자동 (push)

`main` 브랜치에 **push** 하면 자동 실행됩니다.

```bash
git checkout main
git pull
git add .
git commit -m "운영 반영: 설명"
git push origin main
```

push 후 1~2분 뒤 GitHub Actions가 돌기 시작합니다.

### 4-2. 수동 (버튼으로 실행)

코드 push 없이 **지금 당장** 배포하고 싶을 때:

1. GitHub 저장소 → **Actions** 탭
2. 왼쪽 **Deploy to Production** 클릭
3. 오른쪽 **Run workflow** ▼
4. Branch: `main` 선택 → **Run workflow**

---

## 5. 배포 진행 상황 보는 방법

1. GitHub → **Actions** 탭
2. 맨 위 **Deploy to Production** 실행 항목 클릭
3. **deploy** Job 클릭
4. 각 Step 펼쳐서 로그 확인

| Step 이름 | 하는 일 |
|-----------|---------|
| Checkout | 코드 다운로드 |
| Setup Node.js | Node 20 설치 |
| Build API | `npm ci && npm run build` |
| Write production .env | Secrets → `.env` 파일 생성 |
| Pack release tarball | `release/55cine-deploy.tar.gz` 생성 |
| Upload tarball to server | SCP → 서버 `/root/release/` |
| Deploy on server | SSH로 압축 해제, API·Nginx 재시작, health check |

**초록색 체크(✓)** = 성공  
**빨간색 X** = 실패 → Step 로그에서 오류 문구 확인

---

## 6. 배포 성공 확인

### 6-1. GitHub Actions

마지막 Step **Deploy on server** 로그에 health JSON이 보이면 성공:

```json
{"status":"ok","dbConfigured":true,"db":"connected"}
```

### 6-2. 브라우저

- [http://49.247.139.238/](http://49.247.139.238/)
- [http://49.247.139.238/api/v1/health](http://49.247.139.238/api/v1/health)

### 6-3. 서버에서 (선택)

```bash
ssh root@49.247.139.238
systemctl status 55cine-api
curl http://127.0.0.1/api/v1/health
```

---

## 7. 실패했을 때 — 단계별 해결

### 7-1. Build API 실패

**증상:** `npm ci` 또는 `npm run build` 오류

**조치:**

- 로컬 PC에서 동일하게 `cd api && npm ci && npm run build` 실행해 오류 재현
- TypeScript 오류 수정 후 다시 push

---

### 7-2. Upload tarball 실패 (SCP)

**증상:** `appleboy/scp-action` 오류, connection refused, authentication failed

**조치:**

| 원인 | 해결 |
|------|------|
| IP/계정 오류 | `DEPLOY_HOST`, `DEPLOY_USER` 재확인 |
| 비밀번호 오류 | `DEPLOY_PASSWORD` Secret 다시 등록 |
| 키 오류 | `DEPLOY_SSH_KEY` 전체(헤더~푸터) 복사했는지 확인 |
| 방화벽 | 서버 22번 포트 외부 허용 여부 (호스팅 업체) |
| 디스크 부족 | 서버 `df -h /` — 여유 공간 확보 |

---

### 7-3. Deploy on server 실패 (SSH)

**증상:** `remote-setup.sh` 오류, npm 오류, nginx -t 실패

**조치:**

1. Actions 로그에서 **어느 명령에서 멈췄는지** 확인
2. 서버 SSH 접속 후 수동 실행:

```bash
sed -i 's/\r$//' /var/www/55cine/deploy/scripts/*.sh
bash /var/www/55cine/deploy/scripts/remote-setup.sh /var/www/55cine
```

3. API 로그:

```bash
journalctl -u 55cine-api -n 80 --no-pager
```

---

### 7-4. 배포는 성공했는데 health check 실패

**증상:** `curl ... health` 실패, `db: "error"` 등

**조치:**

- `PROD_ENV_FILE` Secret의 DB 정보 확인
- RDS에서 **운영 서버 IP**(`49.247.139.238`) 허용
- 서버 `.env` 확인: `cat /var/www/55cine/.env` (비밀번호 노출 주의)

---

### 7-5. 긴급 — Actions가 계속 실패할 때

수동 배포로 운영 복구:

→ [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) 4장 따라하기

---

## 8. Secrets / DB 비밀번호를 바꿨을 때

| 변경 내용 | 해야 할 일 |
|-----------|------------|
| 서버 SSH 비밀번호 변경 | `DEPLOY_PASSWORD` Secret 업데이트 |
| RDS 비밀번호 변경 | `PROD_ENV_FILE` Secret 업데이트 → Actions 재실행 |
| 서버 IP 변경 | `DEPLOY_HOST` Secret 업데이트 |

Secret 수정 후 **Run workflow** 로 한 번 배포해 반영 여부를 확인하세요.

---

## 9. 자동 배포 체크리스트 (최초 1회)

```
□ 운영 서버 Node 20 + Nginx 설치 (MANUAL-DEPLOY 3장)
□ GitHub 저장소 Admin 권한
□ Secret: DEPLOY_HOST
□ Secret: DEPLOY_USER
□ Secret: DEPLOY_PASSWORD 또는 DEPLOY_SSH_KEY
□ Secret: PROD_ENV_FILE (DB 포함 .env 전체)
□ main 브랜치 push 또는 Run workflow 실행
□ Actions 전 Step 녹색 체크
□ http://49.247.139.238/api/v1/health → connected
```

---

## 10. 일상적인 사용 방법 (팀원용)

1. 기능 개발은 **feature 브랜치**에서 작업
2. Pull Request로 `main`에 merge
3. merge = 자동 배포 시작 (Actions 탭에서 확인)
4. 5~30분 후 (용량에 따라) 운영 사이트 확인
5. 문제 있으면 Actions 로그 또는 수동 배포 매뉴얼 참고

**main에 직접 push하면 곧바로 운영에 반영됩니다.**  
테스트가 끝난 코드만 merge하세요.

---

## 11. 관련 파일

| 파일 | 설명 |
|------|------|
| `.github/workflows/deploy.yml` | 자동 배포 워크플로 정의 |
| `deploy/scripts/pack-release.py` | Actions에서 사용하는 압축 스크립트 |
| `deploy/scripts/remote-setup.sh` | 서버에서 npm·systemd·nginx 처리 |
| `docs/MANUAL-DEPLOY.md` | 수동 배포 상세 매뉴얼 |

---

## 12. FAQ

**Q. 다른 브랜치에서도 자동 배포되나요?**  
A. 기본은 **`main`만**입니다. 변경하려면 `deploy.yml`의 `branches: [main]` 수정.

**Q. 배포 중 사이트가 잠깐 끊기나요?**  
A. API 재시작(`systemctl restart`) 시 **수 초** 502가 날 수 있습니다. Nginx는 유지됩니다.

**Q. 이미지(3GB)도 매번 전부 올라가나요?**  
A. 네. 현재는 **전체 tarball** 방식입니다. push마다 업로드 시간이 길 수 있습니다.

**Q. GitHub Actions 무료 한도는?**  
A. Public repo는 일반적으로 넉넉합니다. Private repo는 월 사용량 제한 확인.

**Q. `.env`를 로컬에서만 바꿨는데 운영 DB가 안 바뀌어요.**  
A. CD는 **`PROD_ENV_FILE` Secret**을 씁니다. Secret을 수정하고 다시 배포하세요.

---

## 13. 용어 설명

| 용어 | 뜻 |
|------|-----|
| **GitHub Actions** | GitHub에서 제공하는 자동 작업(빌드·배포) |
| **Workflow** | Actions 실행 규칙 파일 (`deploy.yml`) |
| **Secret** | Actions에서만 쓰는 암호화된 환경 변수 |
| **SCP** | 원격 서버로 파일 복사 |
| **SSH** | 원격 서버에서 명령 실행 |
| **main** | 운영에 반영하는 기본 브랜치 |

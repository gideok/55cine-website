# 55cine Continuous Deployment (CD) — 요약

> **비전문가용 상세 매뉴얼:** [AUTO-DEPLOY.md](./AUTO-DEPLOY.md)  
> **수동 배포:** [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md)

`main` 브랜치 push 시 GitHub Actions가 운영 서버에 자동 배포합니다.
## 워크플로

파일: `.github/workflows/deploy.yml`

1. `api` TypeScript 빌드 (`npm ci && npm run build`)
2. `deploy/scripts/pack-release.py` 로 tarball 생성
3. SCP로 서버 `/root` 업로드
4. SSH로 압축 해제 + `remote-setup.sh` (의존성 설치, API 재시작, Nginx reload)
5. 헬스 체크 (`/api/v1/health`)

## GitHub Secrets 설정

Repository → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | 설명 | 예시 |
|--------|------|------|
| `DEPLOY_HOST` | 서버 IP 또는 호스트명 | `49.247.139.238` |
| `DEPLOY_USER` | SSH 사용자 | `root` |
| `DEPLOY_PASSWORD` | SSH 비밀번호 (키 미사용 시) | *(서버 비밀번호)* |
| `DEPLOY_SSH_KEY` | SSH 개인키 (권장, 비밀번호 대신) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_PORT` | SSH 포트 (선택, 기본 22) | `22` |
| `PROD_ENV_FILE` | 운영 `.env` 전체 내용 | 아래 참고 |

### `PROD_ENV_FILE` 예시

```env
DB_SERVER=ms1201.gabiadb.com
DB_PORT=1433
DB_DATABASE=cine55
DB_USER=dbadmin
DB_PASSWORD=<RDS 비밀번호>
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
API_HOST=0.0.0.0
API_PORT=3000
API_PREFIX=/api/v1
TZ=Asia/Seoul
```

> 비밀번호·키는 GitHub Secrets에만 저장하고, 저장소에 커밋하지 마세요.

## SSH 키 방식 (권장)

서버에서:

```bash
ssh-keygen -t ed25519 -C "github-actions-55cine" -f /root/.ssh/github_actions -N ""
cat /root/.ssh/github_actions.pub >> /root/.ssh/authorized_keys
cat /root/.ssh/github_actions   # → DEPLOY_SSH_KEY secret
```

`DEPLOY_PASSWORD`는 비우고 `DEPLOY_SSH_KEY`만 설정해도 됩니다 (`appleboy/ssh-action`·`scp-action`은 key 우선).

## 수동 배포 트리거

GitHub → **Actions → Deploy to Production → Run workflow**

## 로컬에서 CI와 동일한 패키징

```bash
cd api && npm ci && npm run build && cd ..
python deploy/scripts/pack-release.py
# → release/55cine-deploy.tar.gz
```

## 서버 사전 준비 (1회)

CD 전에 서버에 Nginx·Node가 있어야 합니다. 최초 1회:

```bash
bash deploy/scripts/server-bootstrap.sh
```

또는 [DEPLOY.md](./DEPLOY.md) 1~2절 참고.

## 배포 실패 시

1. Actions 로그에서 SSH/SCP 오류 확인
2. 서버: `journalctl -u 55cine-api -n 50`
3. `curl http://127.0.0.1/api/v1/health` 로 API 상태 확인
4. RDS 보안 그룹에 **운영 서버 IP** 허용 여부 확인

## 브랜치 정책

- 자동 배포: `main` push
- 다른 브랜치 배포가 필요하면 `deploy.yml`의 `on.push.branches` 수정

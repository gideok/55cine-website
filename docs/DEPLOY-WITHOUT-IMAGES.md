# images 제외 서버 배포 매뉴얼

> **대상:** HTML·CSS·JS·API만 빠르게 반영하고, **`images/` 는 서버에 그대로 두고 싶을 때**  
> **관련:** [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) (전체 배포) · [IMAGES-DEPLOY.md](./IMAGES-DEPLOY.md) (images만 올리기)

---

## 1. 이 방식을 쓰는 이유

| 문제 | images 제외 배포 |
|------|------------------|
| 전체 tarball이 **2~3GB** — 압축·업로드 10~20분 | **수십 MB 수준**으로 단축 |
| 코드만 고쳤는데 이미지까지 매번 업로드 | `images/` **서버 유지** |
| CD `main` push는 기본적으로 images 포함 | **수동**으로 images 제외 배포 가능 |

**포함:** `index.html`, `css/`, `js/`, `api/`, `magazine/`, `movies/`, `partials/`, `deploy/` 등  
**제외:** 프로젝트 루트 `images/` **전체**

---

## 2. 전체 배포와의 차이

| 항목 | 전체 배포 | **images 제외 배포** |
|------|-----------|----------------------|
| 스크립트 | `deploy-from-local.py` | `deploy-from-local.py --no-images` |
| tarball | `55cine-deploy.tar.gz` | `55cine-deploy-no-images.tar.gz` |
| 서버 `/var/www/55cine` | 폴더 **통째 교체** (`.bak` 백업) | 기존 위에 **덮어쓰기(overlay)** |
| 서버 `images/` | tarball 내용으로 갱신 | **변경 없음** |
| stash/merge | 실행 (업로드 이미지 보호) | **불필요** (images 미포함) |

> **주의:** images 제외 배포 후 **새 이미지 파일**이 Git에 추가됐다면, 서버에는 반영되지 않습니다.  
> 그때는 [IMAGES-DEPLOY.md](./IMAGES-DEPLOY.md)의 `rsync-images` 를 사용하세요.

---

## 3. 사전 준비

[MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) 1장과 동일합니다.

| 항목 | 확인 |
|------|------|
| Python 3 | `python --version` |
| paramiko | `pip install paramiko` |
| Node.js 20 | API 빌드용 |
| 프로젝트 `.env` | DB·API 설정 (서버 업로드용) |
| 서버 SSH | `root@49.247.139.238` (또는 `DEPLOY_HOST`) |

---

## 4. 일반적인 배포 (매번 하는 작업)

### 4-1. 프로젝트 폴더로 이동

```bash
cd C:/Projects/55cine-website
```

### 4-2. API 빌드 (자동)

`deploy-from-local.py` 실행 시 `api/dist` 가 없으면 자동으로 `npm run build` 합니다.  
미리 하려면:

```bash
cd api
npm ci
npm run build
cd ..
```

### 4-3. 환경 변수 설정

**Git Bash / Linux:**

```bash
export DEPLOY_HOST=49.247.139.238
export DEPLOY_USER=root
export DEPLOY_PASSWORD='<서버 비밀번호>'
```

**Windows CMD:**

```cmd
set DEPLOY_HOST=49.247.139.238
set DEPLOY_USER=root
set DEPLOY_PASSWORD=서버비밀번호
```

### 4-4. images 제외 배포 실행 (한 줄)

```bash
python deploy/scripts/deploy-from-local.py --no-images --env .env
```

**PowerShell:**

```powershell
$env:DEPLOY_PASSWORD='<서버 비밀번호>'
python deploy/scripts/deploy-from-local.py --no-images --env .env
```

### 4-5. 로그에서 확인할 메시지

| 메시지 | 의미 |
|--------|------|
| `[pack:no-images]` | images 제외 압축 중 |
| `[pack:no-images] done (XX MB)` | tarball 크기 (전체보다 훨씬 작음) |
| `[deploy] overlay mode` | 서버 `images/` 유지 모드 |
| `[remote-setup]` | API 재시작·Nginx reload |
| `[deploy] complete` | 완료 |

### 4-6. 배포 성공 확인

1. 브라우저: `http://49.247.139.238/` — 변경한 화면 확인  
2. **강력 새로고침:** `Ctrl + Shift + R`  
3. API: `http://49.247.139.238/api/v1/health`

---

## 5. 압축만 만들기 (업로드는 나중에)

CI와 동일한 파일명으로 로컬에 생성:

```bash
cd api && npm ci && npm run build && cd ..
python deploy/scripts/pack-release.py --no-images
```

생성 위치:

```text
release/55cine-deploy-no-images.tar.gz
```

이미 만든 tarball로만 배포:

```bash
export DEPLOY_HOST=49.247.139.238
export DEPLOY_USER=root
export DEPLOY_PASSWORD='<비밀번호>'

python deploy/scripts/deploy-from-local.py \
  --tar release/55cine-deploy-no-images.tar.gz \
  --no-images \
  --env .env
```

> `--no-images` 는 **서버 overlay 모드**를 켭니다. tarball과 함께 반드시 지정하세요.

---

## 6. GitHub Actions(CD)와의 관계

**기본 CD** (`main` push)는 **images 포함 전체 tarball** 입니다.

- 평소 코드만 수정하고 images 제외로 올리려면 → **이 문서의 수동 배포** 사용  
- CD도 images 제외로 바꾸려면 `.github/workflows/deploy.yml` 의 pack 단계를  
  `python3 deploy/scripts/pack-release.py --no-images` 로 변경 (팀 합의 후)

---

## 7. images는 언제 따로 올리나?

| 상황 | 방법 |
|------|------|
| 새 포스터·썸네일을 Git에 추가함 | [IMAGES-DEPLOY.md](./IMAGES-DEPLOY.md) → `rsync-images.sh` |
| 관리자 화면에서 서버에 업로드 | 배포 불필요 (이미 서버에 있음) |
| 코드 + images 둘 다 반영 | 전체 배포 [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) 또는 images rsync 추가 |

---

## 8. 자주 나는 문제

### Q1. 배포는 됐는데 새 이미지가 안 보임

**원인:** images 제외 배포는 `images/` 를 올리지 않습니다.  
**해결:** `bash deploy/scripts/rsync-images.sh` 또는 `python deploy/scripts/rsync-images.py`

### Q2. `--no-images` 없이 no-images tarball만 올림

**원인:** 서버가 폴더 통째 교체 모드면 `images/` 가 `.bak` 으로 사라질 수 있음.  
**해결:** 항상 **`--no-images` 플래그와 no-images tarball을 쌍으로** 사용하세요.

### Q3. API만 502

서버 SSH 후:

```bash
systemctl status 55cine-api
journalctl -u 55cine-api -n 50
```

### Q4. tarball이 여전히 큼

로컬 `images/` 가 아닌 다른 대용량이 포함됐을 수 있습니다.  
`release/55cine-deploy-no-images.tar.gz` 크기와 `[pack:no-images] done` 로그를 확인하세요.

---

## 9. 체크리스트 (인쇄용)

```
□ api/dist 빌드 완료
□ DEPLOY_HOST / DEPLOY_USER / DEPLOY_PASSWORD 설정
□ python deploy/scripts/deploy-from-local.py --no-images --env .env
□ [pack:no-images] · [deploy] overlay mode 로그 확인
□ 브라우저에서 화면·API health 확인
□ (필요 시) rsync-images 로 images만 추가 반영
```

---

## 10. 관련 파일

| 파일 | 설명 |
|------|------|
| `deploy/scripts/deploy-from-local.py` | 수동 배포 (`--no-images`) |
| `deploy/scripts/pack-release.py` | tarball만 생성 (`--no-images`) |
| `deploy/scripts/pack_lib.py` | images 제외 패키징 공통 로직 |
| `docs/IMAGES-DEPLOY.md` | images만 부분 배포 |
| `docs/MANUAL-DEPLOY.md` | images 포함 전체 수동 배포 |

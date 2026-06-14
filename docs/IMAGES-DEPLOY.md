# images/ 배포 — 부분 동기화 · CD 보호

> **관련 문서:** [DEPLOY.md](./DEPLOY.md) · [MANUAL-DEPLOY.md](./MANUAL-DEPLOY.md) · [AUTO-DEPLOY.md](./AUTO-DEPLOY.md)

운영 서버 `/var/www/55cine/images/` 는 **Git 정적 자산**과 **관리자/API 업로드**가 함께 있습니다.  
전체 tarball 배포만 쓰면 용량·시간 부담이 크고, 수동 전체 배포는 서버 전용 파일이 사라질 수 있습니다.

이 문서는 다음 두 가지를 다룹니다.

1. **`images/` 만 부분 배포** (rsync / SFTP)
2. **CD·수동 전체 배포 시 서버 업로드 이미지 보호** (stash → merge)

---

## 1. 배포 방식 비교

| 방식 | 스크립트 | images 처리 | 서버 업로드 보호 |
|------|----------|-------------|------------------|
| **CD (main push)** | `.github/workflows/deploy.yml` | tarball 포함분 덮어쓰기 | **stash → merge 자동** |
| **수동 전체** | `deploy-from-local.py` | 로컬 전체 tarball | **stash → merge 기본 ON** |
| **수동 (images 제외)** | `deploy-from-local.py --no-images` | 서버 images 유지·overlay | 해당 없음 |
| **images만** | `rsync-images.sh` / `rsync-images.py` | 로컬 → 서버 동기화 | 해당 경로만 갱신 |

---

## 2. images/ 부분 배포

코드·HTML·CSS만 바꾸고 **이미지 폴더만** 올릴 때 사용합니다.

### 2-1. Git Bash / Linux / macOS (rsync, 권장)

```bash
export DEPLOY_HOST=49.247.139.238
export DEPLOY_USER=root

# 미리보기 (실제 업로드 없음)
bash deploy/scripts/rsync-images.sh --dry-run

# 업로드
bash deploy/scripts/rsync-images.sh
```

SSH 키 사용 시 비밀번호 없이:

```bash
ssh-add ~/.ssh/id_ed25519   # 1회
bash deploy/scripts/rsync-images.sh
```

**서버에만 있는 파일까지 삭제**하려면 (주의):

```bash
bash deploy/scripts/rsync-images.sh --delete
```

### 2-2. Windows (rsync 없을 때 — SFTP)

```bash
pip install paramiko
export DEPLOY_HOST=49.247.139.238
export DEPLOY_USER=root
export DEPLOY_PASSWORD='<서버 비밀번호>'

python deploy/scripts/rsync-images.py --dry-run
python deploy/scripts/rsync-images.py
```

### 2-3. 제외 패턴

`deploy/config/images-rsync-exclude.txt` — `.psd`, `.ai`, `.zip`, 디자인 시안 등  
(`.gitignore` 와 유사, **부분 배포 전용**)

### 2-4. 동작

- **대상:** 로컬 `images/` → 서버 `/var/www/55cine/images/`
- **기본:** 같은 경로 파일 **덮어쓰기**, 서버에만 있는 파일 **유지** (`--delete` 없을 때)
- **완료 후:** `chown www-data:www-data` (서버)

---

## 3. CD 시 서버 업로드 이미지 보호

### 3-1. 왜 필요한가

| 상황 | tarball만 쓸 때 |
|------|-----------------|
| 관리자가 서버에 새 이미지 업로드 (Git 미반영) | CD는 **삭제하지 않음** (tar는 없는 파일을 지우지 않음) |
| tarball에 **구버전** 이미지, 서버에 **신버전** (같은 경로) | tar 풀 때 **구버전으로 덮어씀** ← **보호 필요** |
| 수동 `deploy-from-local.py` (폴더 통째 교체) | 서버 전용 파일 **소실 가능** ← **stash/merge 필수** |

### 3-2. 보호 절차 (자동)

**CD** (`.github/workflows/deploy.yml`):

```
1. stash  — 배포 전 보호 경로를 /root/55cine-image-stash 에 백업
2. tar -xzf  — 전체 배포
3. merge  — stash 중 서버 파일이 더 새면 복원 (rsync --update)
4. remote-setup.sh
```

**수동 전체** (`deploy-from-local.py`):

```
1. stash (기존 /var/www/55cine 에서)
2. /var/www/55cine → .bak 이동 후 tarball 압축 해제
3. merge
4. remote-setup.sh
```

stash 생략:

```bash
python deploy/scripts/deploy-from-local.py --no-preserve-images ...
```

### 3-3. 보호 경로 설정

`deploy/config/server-protected-image-dirs.txt`

```
images/special/sp          # 기획전·행사 관리자 업로드
images/special/_tmp        # 업로드 임시
images/magazine/body       # 매거진 본문·썸네일
images/magazine/_tmp
images/magazine/past-articles
images/movies/wp           # 상영작 포스터·썸네일
```

경로 추가·변경 후 **다음 CD/수동 배포**부터 적용됩니다.

### 3-4. 서버에서 수동 실행

```bash
ssh root@49.247.139.238

# 배포 직전 (운영자가 tarball 풀기 전)
bash /var/www/55cine/deploy/scripts/server-images-guard.sh stash

# tarball 압축 해제 후
bash /var/www/55cine/deploy/scripts/server-images-guard.sh merge

# stash 상태 확인
bash /var/www/55cine/deploy/scripts/server-images-guard.sh status
```

환경 변수:

```bash
APP_ROOT=/var/www/55cine STASH_ROOT=/root/55cine-image-stash bash deploy/scripts/server-images-guard.sh stash
```

---

## 4. 운영 시나리오

### A. HTML/CSS/JS만 수정 → 평소

```text
main push → CD 자동 배포 (images 보호 포함)
```

### B. 로컬에서 images 추가·교체 → 코드 배포 없이

```bash
bash deploy/scripts/rsync-images.sh
# 또는
python deploy/scripts/rsync-images.py
```

### C. 로컬 전체 + images 대량 반영

```bash
cd api && npm run build && cd ..
python deploy/scripts/deploy-from-local.py
# stash/merge 기본 적용
```

### D. 관리자가 운영 중 업로드한 이미지 유지가 최우선

1. **전체 배포:** CD 또는 `deploy-from-local.py` (**`--no-preserve-images` 사용 금지**)
2. **긴급:** 서버에서 `stash` → 작업 → `merge`
3. **특정 파일만 복구:** `/var/www/55cine.bak/images/...` (수동 배포 직후) 또는 `/root/55cine-image-stash` (stash 직후 merge 전)

---

## 5. 파일 목록

| 파일 | 역할 |
|------|------|
| `deploy/scripts/rsync-images.sh` | rsync 부분 배포 (Unix/Git Bash) |
| `deploy/scripts/rsync-images.py` | SFTP 부분 배포 (Windows 등) |
| `deploy/scripts/server-images-guard.sh` | stash / merge / status |
| `deploy/config/server-protected-image-dirs.txt` | CD 보호 경로 |
| `deploy/config/images-rsync-exclude.txt` | 부분 배포 제외 패턴 |
| `.github/workflows/deploy.yml` | CD에 stash/merge 연동 |

---

## 6. FAQ

**Q. CD마다 images 3GB도 tarball에 포함되나요?**  
A. Git에 커밋된 파일은 포함됩니다. **images만** 올릴 때는 `rsync-images` 를 쓰면 tarball 없이 빠릅니다.

**Q. 부분 배포가 서버 업로드 파일을 지우나요?**  
A. 기본(**`--delete` 없음**)은 **지우지 않습니다**. 같은 경로만 덮어씁니다.

**Q. 보호 목록에 없는 `images/ui/` 는?**  
A. tarball에 있으면 CD 시 **항상 tarball 버전**으로 갱신됩니다. 서버 전용으로 두려면 `server-protected-image-dirs.txt` 에 추가하세요.

**Q. merge 후에도 이미지가 구버전이면?**  
A. stash 시점의 서버 파일 mtime 이 tarball 파일보다 새로워야 복원됩니다. Git에서 의도적으로 구버전을 배포한 경우 서버 신버전이 유지될 수 있습니다. **Git 신버전을 강제**하려면 해당 경로를 보호 목록에서 빼거나, `rsync-images.sh --delete` 로 동기화하세요.

---

## 7. 체크리스트

**images 부분 배포**

- [ ] `deploy/scripts/rsync-images.sh --dry-run` 으로 대상 확인
- [ ] 업로드 후 브라우저에서 이미지 URL 직접 확인
- [ ] 필요 시 `Ctrl+Shift+R` 강력 새로고침 (캐시 7일 — `55cine.conf`)

**CD 보호**

- [ ] `server-protected-image-dirs.txt` 에 업로드 경로 포함
- [ ] Actions 로그에 `server-images-guard stash` / `merge done` 확인
- [ ] 관리자 업로드 후 CD → 이미지 유지 확인

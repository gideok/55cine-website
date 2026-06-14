#!/usr/bin/env bash
# 로컬 images/ → 운영 서버 부분 배포 (rsync)
#
# 사용 (Git Bash / Linux / macOS — rsync·ssh 필요):
#   export DEPLOY_HOST=49.247.139.238
#   export DEPLOY_USER=root
#   bash deploy/scripts/rsync-images.sh
#
#   bash deploy/scripts/rsync-images.sh --dry-run
#   bash deploy/scripts/rsync-images.sh --delete   # 서버에만 있는 파일 삭제 (주의)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${DEPLOY_HOST:-49.247.139.238}"
USER="${DEPLOY_USER:-root}"
PORT="${DEPLOY_PORT:-22}"
REMOTE="${APP_ROOT:-/var/www/55cine}/images/"
EXCLUDE_FILE="$ROOT/deploy/config/images-rsync-exclude.txt"

DRY=""
DELETE=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY="--dry-run" ;;
    --delete) DELETE="--delete" ;;
    -h|--help)
      echo "Usage: DEPLOY_HOST=... DEPLOY_USER=root bash deploy/scripts/rsync-images.sh [--dry-run] [--delete]"
      exit 0
      ;;
  esac
done

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync not found. Windows: Git Bash 또는 WSL. 또는: python deploy/scripts/rsync-images.py" >&2
  exit 1
fi

if [[ ! -d "$ROOT/images" ]]; then
  echo "missing: $ROOT/images" >&2
  exit 1
fi

RSYNC_OPTS=(-avz --progress --human-readable)
[[ -n "$DRY" ]] && RSYNC_OPTS+=("$DRY")
[[ -n "$DELETE" ]] && RSYNC_OPTS+=("--delete")
[[ -f "$EXCLUDE_FILE" ]] && RSYNC_OPTS+=(--exclude-from="$EXCLUDE_FILE")

echo "[rsync-images] $ROOT/images/ -> ${USER}@${HOST}:${REMOTE}"
rsync "${RSYNC_OPTS[@]}" -e "ssh -p ${PORT}" "$ROOT/images/" "${USER}@${HOST}:${REMOTE}"

ssh -p "$PORT" "${USER}@${HOST}" "chown -R www-data:www-data ${APP_ROOT:-/var/www/55cine}/images 2>/dev/null || true"
echo "[rsync-images] done"

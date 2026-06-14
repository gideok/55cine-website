#!/usr/bin/env bash
# 운영 서버 — CD/전체 배포 전후 서버 업로드 images 보호 (stash → merge)
#
# 사용 (서버):
#   bash deploy/scripts/server-images-guard.sh stash
#   bash deploy/scripts/server-images-guard.sh merge
#   bash deploy/scripts/server-images-guard.sh status
#
# 환경 변수 (선택):
#   APP_ROOT   기본 /var/www/55cine
#   STASH_ROOT 기본 /root/55cine-image-stash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/55cine}"
STASH_ROOT="${STASH_ROOT:-/root/55cine-image-stash}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${CONFIG:-$SCRIPT_DIR/../config/server-protected-image-dirs.txt}"

log() { echo "[server-images-guard] $*"; }

read_protected_dirs() {
  if [[ ! -f "$CONFIG" ]]; then
    log "config not found: $CONFIG" >&2
    exit 1
  fi
  grep -v '^\s*#' "$CONFIG" | grep -v '^\s*$' || true
}

sync_dir_to_stash() {
  local rel="$1"
  local src="$APP_ROOT/$rel"
  local dest="$STASH_ROOT/$rel"
  if [[ ! -d "$src" ]]; then
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a "$src/" "$dest/"
  else
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -a "$src/." "$dest/"
  fi
  log "stashed $rel"
}

merge_dir_from_stash() {
  local rel="$1"
  local src="$STASH_ROOT/$rel"
  local dest="$APP_ROOT/$rel"
  if [[ ! -d "$src" ]]; then
    return 0
  fi
  mkdir -p "$dest"
  if command -v rsync >/dev/null 2>&1; then
    # stash(배포 전 서버)가 더 새로우면 덮어씀 — tarball 구버전 방지
    rsync -a --update "$src/" "$dest/"
  else
    # rsync 없음: stash 파일 중 대상 없거나 stash가 더 새면 복사
    while IFS= read -r -d '' f; do
      local base="${f#$src/}"
      local target="$dest/$base"
      if [[ ! -e "$target" ]] || [[ "$f" -nt "$target" ]]; then
        mkdir -p "$(dirname "$target")"
        cp -a "$f" "$target"
      fi
    done < <(find "$src" -type f -print0 2>/dev/null || true)
  fi
  log "merged $rel"
}

cmd_stash() {
  rm -rf "$STASH_ROOT"
  mkdir -p "$STASH_ROOT"
  local count=0
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    sync_dir_to_stash "$rel"
    count=$((count + 1))
  done < <(read_protected_dirs)
  log "stash done ($count dirs) -> $STASH_ROOT"
}

cmd_merge() {
  if [[ ! -d "$STASH_ROOT" ]]; then
    log "no stash at $STASH_ROOT — skip merge"
    return 0
  fi
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    merge_dir_from_stash "$rel"
  done < <(read_protected_dirs)
  chown -R www-data:www-data "$APP_ROOT/images" 2>/dev/null || true
  rm -rf "$STASH_ROOT"
  log "merge done; stash removed"
}

cmd_status() {
  log "APP_ROOT=$APP_ROOT STASH_ROOT=$STASH_ROOT"
  if [[ -d "$STASH_ROOT" ]]; then
    du -sh "$STASH_ROOT" 2>/dev/null || true
    find "$STASH_ROOT" -type f 2>/dev/null | wc -l | xargs -r echo "  files:"
  else
    log "no active stash"
  fi
}

usage() {
  echo "Usage: $0 {stash|merge|status}" >&2
  exit 1
}

case "${1:-}" in
  stash) cmd_stash ;;
  merge) cmd_merge ;;
  status) cmd_status ;;
  *) usage ;;
esac

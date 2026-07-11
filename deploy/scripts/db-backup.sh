#!/usr/bin/env bash
# MS SQL DB 논리 백업 — .env 기준, 4시간 systemd timer에서 호출
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/55cine}"
BACKUP_ROOT="${DB_BACKUP_DIR:-/var/backups/55cine/db}"
RETAIN="${DB_BACKUP_RETAIN:-42}"
LOG_FILE="${DB_BACKUP_LOG:-/var/log/55cine-db-backup.log}"

mkdir -p "$BACKUP_ROOT"
touch "$LOG_FILE"
chmod 640 "$LOG_FILE" 2>/dev/null || true

log() {
  echo "[$(date -Is)] $*"
}

run_backup() {
  local stamp work archive
  stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  work="${BACKUP_ROOT}/.work-${stamp}"
  archive="${BACKUP_ROOT}/${stamp}.tar.gz"

  mkdir -p "$work"
  export DB_BACKUP_OUT_DIR="$work"

  cd "${APP_ROOT}/api"
  /usr/bin/node scripts/db-backup.mjs

  tar -czf "$archive" -C "$BACKUP_ROOT" ".work-${stamp}"
  rm -rf "$work"

  mapfile -t archives < <(ls -1t "${BACKUP_ROOT}"/*.tar.gz 2>/dev/null || true)
  if ((${#archives[@]} > RETAIN)); then
    for old in "${archives[@]:RETAIN}"; do
      rm -f "$old"
      log "removed old backup: $(basename "$old")"
    done
  fi

  local size_mb
  size_mb="$(du -m "$archive" | awk '{print $1}')"
  log "backup complete: $(basename "$archive") (${size_mb} MB, retain=${RETAIN})"
}

{
  log "backup start (host=$(hostname -s), db dir=${BACKUP_ROOT})"
  run_backup
} >>"$LOG_FILE" 2>&1

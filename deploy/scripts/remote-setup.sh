#!/usr/bin/env bash
# 서버에서 앱 배포 후 실행: Nginx·systemd 등록 및 API 기동
set -euo pipefail

APP_ROOT="/var/www/55cine"
REPO_DEPLOY_DIR="${1:-}"

install_nginx_site_config() {
  local src="${REPO_DEPLOY_DIR}/deploy/nginx/55cine.conf"
  [[ -f "$src" ]] || return 0

  if ! command -v nginx >/dev/null 2>&1; then
    echo "[remote-setup] ERROR: nginx가 설치되어 있지 않습니다." >&2
    echo "[remote-setup] 서버에서 1회 실행: bash ${APP_ROOT}/deploy/scripts/server-bootstrap.sh" >&2
    exit 1
  fi

  if [[ ! -d /etc/nginx ]]; then
    echo "[remote-setup] ERROR: /etc/nginx 디렉터리가 없습니다. server-bootstrap.sh를 먼저 실행하세요." >&2
    exit 1
  fi

  if [[ -d /etc/nginx/sites-available ]]; then
    cp "$src" /etc/nginx/sites-available/55cine.conf
    mkdir -p /etc/nginx/sites-enabled
    ln -sf /etc/nginx/sites-available/55cine.conf /etc/nginx/sites-enabled/55cine.conf
    rm -f /etc/nginx/sites-enabled/default
    return 0
  fi

  if [[ -d /etc/nginx/conf.d ]]; then
    echo "[remote-setup] sites-available 없음 — conf.d/55cine.conf 로 설치"
    cp "$src" /etc/nginx/conf.d/55cine.conf
    rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
    return 0
  fi

  echo "[remote-setup] nginx 사이트 설정 경로를 찾을 수 없습니다. server-bootstrap.sh를 실행하세요." >&2
  exit 1
}

if [[ -n "$REPO_DEPLOY_DIR" && -d "$REPO_DEPLOY_DIR/deploy" ]]; then
  install_nginx_site_config
  cp "$REPO_DEPLOY_DIR/deploy/systemd/55cine-api.service" /etc/systemd/system/55cine-api.service
  cp "$REPO_DEPLOY_DIR/deploy/systemd/55cine-db-backup.service" /etc/systemd/system/55cine-db-backup.service
  cp "$REPO_DEPLOY_DIR/deploy/systemd/55cine-db-backup.timer" /etc/systemd/system/55cine-db-backup.timer
fi

mkdir -p /var/backups/55cine/db
touch /var/log/55cine-db-backup.log
chown -R www-data:www-data /var/backups/55cine
chown www-data:www-data /var/log/55cine-db-backup.log
chmod 750 /var/backups/55cine /var/backups/55cine/db
chmod 640 /var/log/55cine-db-backup.log

chown -R www-data:www-data "$APP_ROOT"
chmod 640 "$APP_ROOT/.env" || true

# 접속 통계 SQLite (MSSQL 비사용)
mkdir -p "$APP_ROOT/data"
touch "$APP_ROOT/data/analytics.sqlite" 2>/dev/null || true
chown -R www-data:www-data "$APP_ROOT/data"
chmod 775 "$APP_ROOT/data"
chmod 664 "$APP_ROOT/data/analytics.sqlite" 2>/dev/null || true

cd "$APP_ROOT/api"
npm ci --omit=dev

systemctl daemon-reload
systemctl enable 55cine-api
systemctl restart 55cine-api

systemctl enable 55cine-db-backup.timer
systemctl start 55cine-db-backup.timer

nginx -t
systemctl reload nginx

echo "[remote-setup] API status:"
systemctl --no-pager status 55cine-api | head -15

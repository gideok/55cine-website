#!/usr/bin/env python3
"""접속통계(analytics) + 최신 API dist 실서버 배포.

pageKey 영화제목 표시 등 API/수집 JS 변경 시 이 스크립트로 배포하세요.
일반 정적 배포만으로는 api/dist·systemd 재기동이 빠질 수 있습니다.
"""
from __future__ import annotations

import getpass
import os
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[2]
HOST = os.environ.get("DEPLOY_HOST", "49.247.207.161")
USER = os.environ.get("DEPLOY_USER", "root")
APP = "/var/www/55cine"
DIST = ROOT / "api" / "dist"

ENV_LINES = {
    "ANALYTICS_ENABLED": "true",
    "ANALYTICS_DB_PATH": f"{APP}/data/analytics.sqlite",
    "ANALYTICS_ALLOW_LOCAL": "false",
}


def run(client: paramiko.SSHClient, cmd: str, *, check: bool = True) -> str:
    print(f"$ {cmd}")
    _stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    code = stdout.channel.recv_exit_status()
    text = (out or "") + (("\n" + err) if err.strip() else "")
    if text.strip():
        print(text.rstrip())
    if check and code != 0:
        raise RuntimeError(f"exit {code}: {cmd}")
    return out


def pack() -> Path:
    need = [
        DIST / "index.js",
        DIST / "routes" / "analytics.js",
        DIST / "services" / "analytics.service.js",
        DIST / "db" / "analytics-db.js",
        ROOT / "js" / "analytics-pageview.js",
        ROOT / "js" / "site-root.js",
        ROOT / "js" / "admin" / "analytics-page.js",
        ROOT / "js" / "admin" / "layout.js",
        ROOT / "js" / "admin" / "api.js",
        ROOT / "js" / "admin" / "dashboard-page.js",
        ROOT / "admin" / "analytics.html",
        ROOT / "css" / "admin.css",
        ROOT / "deploy" / "scripts" / "remote-setup.sh",
        ROOT / "deploy" / "scripts" / "db-backup.sh",
    ]
    for p in need:
        if not p.is_file():
            raise SystemExit(f"missing {p}")

    fd, name = tempfile.mkstemp(suffix=".tar.gz", prefix="55cine-analytics-")
    os.close(fd)
    tar_path = Path(name)
    with tarfile.open(tar_path, "w:gz") as tf:
        for path in DIST.rglob("*"):
            if path.is_file():
                tf.add(path, arcname=f"dist/{path.relative_to(DIST).as_posix()}")

        extras = [
            ("js/analytics-pageview.js", ROOT / "js" / "analytics-pageview.js"),
            ("js/site-root.js", ROOT / "js" / "site-root.js"),
            ("js/now-playing-movie-detail-page.js", ROOT / "js" / "now-playing-movie-detail-page.js"),
            ("js/magazine-preview-detail-page.js", ROOT / "js" / "magazine-preview-detail-page.js"),
            ("js/magazine-serial-detail-page.js", ROOT / "js" / "magazine-serial-detail-page.js"),
            ("js/magazine-gv-moment-detail-page.js", ROOT / "js" / "magazine-gv-moment-detail-page.js"),
            ("js/magazine-past-article-detail-page.js", ROOT / "js" / "magazine-past-article-detail-page.js"),
            ("special/exhibition/js/exhibition-detail-page.js", ROOT / "special" / "exhibition" / "js" / "exhibition-detail-page.js"),
            ("special/event/js/event-detail-page.js", ROOT / "special" / "event" / "js" / "event-detail-page.js"),
            ("js/admin/analytics-page.js", ROOT / "js" / "admin" / "analytics-page.js"),
            ("js/admin/layout.js", ROOT / "js" / "admin" / "layout.js"),
            ("js/admin/api.js", ROOT / "js" / "admin" / "api.js"),
            ("js/admin/dashboard-page.js", ROOT / "js" / "admin" / "dashboard-page.js"),
            ("admin/analytics.html", ROOT / "admin" / "analytics.html"),
            ("css/admin.css", ROOT / "css" / "admin.css"),
            ("deploy/scripts/remote-setup.sh", ROOT / "deploy" / "scripts" / "remote-setup.sh"),
            ("deploy/scripts/db-backup.sh", ROOT / "deploy" / "scripts" / "db-backup.sh"),
            ("api/package.json", ROOT / "api" / "package.json"),
        ]
        for arc, src in extras:
            if src.is_file():
                tf.add(src, arcname=arc)
    print(f"[pack] {tar_path} ({tar_path.stat().st_size / 1024:.1f} KB)")
    return tar_path


def merge_env(client: paramiko.SSHClient) -> None:
    remote_env = f"{APP}/.env"
    sftp = client.open_sftp()
    try:
        with sftp.open(remote_env, "r") as rf:
            text = rf.read().decode("utf-8")
    except OSError:
        text = ""
    sftp.close()

    lines = text.splitlines()
    keys_seen = set()
    out: list[str] = []
    for line in lines:
        if not line.strip() or line.strip().startswith("#") or "=" not in line:
            out.append(line)
            continue
        key = line.split("=", 1)[0].strip()
        if key in ENV_LINES:
            out.append(f"{key}={ENV_LINES[key]}")
            keys_seen.add(key)
        else:
            out.append(line)
    missing = [k for k in ENV_LINES if k not in keys_seen]
    if missing:
        if out and out[-1].strip():
            out.append("")
        out.append("# 접속 통계 (로컬 SQLite — MSSQL 미사용)")
        for k in missing:
            out.append(f"{k}={ENV_LINES[k]}")

    payload = ("\n".join(out).rstrip() + "\n").encode("utf-8")
    tmp = "/tmp/55cine.env.analytics"
    sftp = client.open_sftp()
    with sftp.open(tmp, "w") as wf:
        wf.write(payload)
    sftp.close()
    run(
        client,
        f"cp -f {tmp} {remote_env} && rm -f {tmp} && "
        f"chown www-data:www-data {remote_env} && chmod 640 {remote_env} && "
        f"grep -E '^ANALYTICS_' {remote_env}",
    )


def ensure_api_build() -> None:
    print("[build] npm run build (api)")
    subprocess.check_call(
        ["npm", "run", "build"],
        cwd=ROOT / "api",
        shell=os.name == "nt",
    )
    need = [
        DIST / "routes" / "analytics.js",
        DIST / "services" / "analytics.service.js",
        DIST / "services" / "movies.service.js",
    ]
    for p in need:
        if not p.is_file():
            raise SystemExit(f"missing after build: {p}")
    movies_js = (DIST / "services" / "movies.service.js").read_text(encoding="utf-8")
    analytics_js = (DIST / "services" / "analytics.service.js").read_text(encoding="utf-8")
    if "getMovieTitlesBySlugs" not in movies_js:
        raise SystemExit("dist movies.service.js missing getMovieTitlesBySlugs")
    if "enrichMoviePageKeys" not in analytics_js:
        raise SystemExit("dist analytics.service.js missing enrichMoviePageKeys")
    print("[build] pageKey title enrichment markers ok")


def main() -> None:
    ensure_api_build()

    tar_path = pack()
    password = os.environ.get("DEPLOY_PASSWORD")
    if not password:
        password = getpass.getpass(f"SSH password for {USER}@{HOST}: ")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[ssh] connect {USER}@{HOST}")
    client.connect(HOST, username=USER, password=password, timeout=30)

    remote_tar = "/root/55cine-analytics.tar.gz"
    sftp = client.open_sftp()
    sftp.put(str(tar_path), remote_tar)
    sftp.close()
    tar_path.unlink(missing_ok=True)

    print("\n=== node version ===")
    run(client, "node -v", check=False)

    print("\n=== extract ===")
    run(
        client,
        f"mkdir -p /tmp/55cine-an && tar -xzf {remote_tar} -C /tmp/55cine-an && rm -f {remote_tar} && "
        f"rsync -a --delete /tmp/55cine-an/dist/ {APP}/api/dist/ && "
        f"cp -f /tmp/55cine-an/api/package.json {APP}/api/package.json && "
        f"cp -f /tmp/55cine-an/js/analytics-pageview.js {APP}/js/ && "
        f"cp -f /tmp/55cine-an/js/site-root.js {APP}/js/ && "
        f"cp -f /tmp/55cine-an/js/now-playing-movie-detail-page.js {APP}/js/ && "
        f"cp -f /tmp/55cine-an/js/magazine-preview-detail-page.js {APP}/js/ && "
        f"cp -f /tmp/55cine-an/js/magazine-serial-detail-page.js {APP}/js/ && "
        f"cp -f /tmp/55cine-an/js/magazine-gv-moment-detail-page.js {APP}/js/ && "
        f"cp -f /tmp/55cine-an/js/magazine-past-article-detail-page.js {APP}/js/ && "
        f"cp -f /tmp/55cine-an/special/exhibition/js/exhibition-detail-page.js "
        f"{APP}/special/exhibition/js/ && "
        f"cp -f /tmp/55cine-an/special/event/js/event-detail-page.js {APP}/special/event/js/ && "
        f"cp -f /tmp/55cine-an/js/admin/analytics-page.js {APP}/js/admin/ && "
        f"cp -f /tmp/55cine-an/js/admin/layout.js {APP}/js/admin/ && "
        f"cp -f /tmp/55cine-an/js/admin/api.js {APP}/js/admin/ && "
        f"cp -f /tmp/55cine-an/js/admin/dashboard-page.js {APP}/js/admin/ && "
        f"cp -f /tmp/55cine-an/admin/analytics.html {APP}/admin/ && "
        f"cp -f /tmp/55cine-an/css/admin.css {APP}/css/ && "
        f"cp -f /tmp/55cine-an/deploy/scripts/remote-setup.sh {APP}/deploy/scripts/ && "
        f"cp -f /tmp/55cine-an/deploy/scripts/db-backup.sh {APP}/deploy/scripts/ && "
        f"sed -i 's/\\r$//' {APP}/deploy/scripts/*.sh && "
        f"mkdir -p {APP}/data && touch {APP}/data/analytics.sqlite && "
        f"chown -R www-data:www-data {APP}/api/dist {APP}/js {APP}/admin {APP}/css "
        f"{APP}/special {APP}/data {APP}/deploy/scripts && "
        f"chmod 775 {APP}/data && chmod 664 {APP}/data/analytics.sqlite && "
        f"test -f {APP}/api/dist/routes/analytics.js && echo 'analytics route ok' && "
        f"grep -q getMovieTitlesBySlugs {APP}/api/dist/services/movies.service.js && "
        f"grep -q enrichMoviePageKeys {APP}/api/dist/services/analytics.service.js && "
        f"grep -q isMovieDetailPath {APP}/js/analytics-pageview.js && "
        f"echo 'pageKey title patch ok' && "
        f"rm -rf /tmp/55cine-an",
    )

    print("\n=== merge .env analytics ===")
    merge_env(client)

    print("\n=== restart API ===")
    run(client, "systemctl restart 55cine-api", check=False)
    run(
        client,
        "for i in 1 2 3 4 5 6 7 8 9 10; do "
        "st=$(systemctl is-active 55cine-api 2>/dev/null || true); "
        "echo \"try $i: $st\"; "
        "if [ \"$st\" = active ]; then exit 0; fi; "
        "if [ \"$st\" = failed ] || [ \"$st\" = inactive ]; then "
        "journalctl -u 55cine-api -n 40 --no-pager; exit 1; fi; "
        "sleep 1; done; "
        "journalctl -u 55cine-api -n 60 --no-pager; exit 1",
    )

    print("\n=== verify ===")
    run(
        client,
        "curl -sS -o /dev/null -w 'pageview_post=%{http_code}\\n' -X POST "
        "http://127.0.0.1:3000/api/v1/analytics/pageview "
        "-H 'Content-Type: application/json' "
        "-d '{\"path\":\"/index.html\"}'; "
        "curl -sS --max-time 10 -X POST http://127.0.0.1:3000/api/v1/analytics/pageview "
        "-H 'Content-Type: application/json' -d '{\"path\":\"/now-playing.html\"}'; echo; "
        "curl -sS -o /dev/null -w 'js=%{http_code} admin_html=%{http_code}\\n' "
        f"https://55cine.com/js/analytics-pageview.js "
        f"https://55cine.com/admin/analytics.html",
        check=False,
    )

    client.close()
    print("\n[done] analytics deploy complete")
    print("관리자: https://55cine.com/admin/analytics.html")


if __name__ == "__main__":
    main()

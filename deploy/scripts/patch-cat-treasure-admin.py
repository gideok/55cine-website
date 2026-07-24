#!/usr/bin/env python3
"""고양이 이벤트 관리자(읽기전용) 페이지 + API dist 실서버 배포."""
from __future__ import annotations

import getpass
import os
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
        DIST / "services" / "cat-treasure-event.service.js",
        DIST / "routes" / "admin" / "index.js",
        ROOT / "admin" / "cat-treasure.html",
        ROOT / "js" / "admin" / "cat-treasure-page.js",
        ROOT / "js" / "admin" / "layout.js",
        ROOT / "js" / "admin" / "api.js",
        ROOT / "css" / "admin.css",
    ]
    for p in need:
        if not p.is_file():
            raise SystemExit(f"missing {p}")

    fd, name = tempfile.mkstemp(suffix=".tar.gz", prefix="55cine-cat-admin-")
    os.close(fd)
    tar_path = Path(name)
    with tarfile.open(tar_path, "w:gz") as tf:
        for path in DIST.rglob("*"):
            if path.is_file():
                tf.add(path, arcname=f"dist/{path.relative_to(DIST).as_posix()}")
        extras = [
            ("admin/cat-treasure.html", ROOT / "admin" / "cat-treasure.html"),
            ("js/admin/cat-treasure-page.js", ROOT / "js" / "admin" / "cat-treasure-page.js"),
            ("js/admin/layout.js", ROOT / "js" / "admin" / "layout.js"),
            ("js/admin/api.js", ROOT / "js" / "admin" / "api.js"),
            ("css/admin.css", ROOT / "css" / "admin.css"),
        ]
        for arc, src in extras:
            tf.add(src, arcname=arc)
    print(f"[pack] {tar_path} ({tar_path.stat().st_size / 1024:.1f} KB)")
    return tar_path


def main() -> None:
    tar_path = pack()
    password = os.environ.get("DEPLOY_PASSWORD")
    if not password:
        password = getpass.getpass(f"SSH password for {USER}@{HOST}: ")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[ssh] connect {USER}@{HOST}")
    client.connect(HOST, username=USER, password=password, timeout=30)

    remote_tar = "/root/55cine-cat-admin.tar.gz"
    sftp = client.open_sftp()
    sftp.put(str(tar_path), remote_tar)
    sftp.close()
    tar_path.unlink(missing_ok=True)

    run(
        client,
        f"mkdir -p /tmp/55cine-cta && tar -xzf {remote_tar} -C /tmp/55cine-cta && rm -f {remote_tar} && "
        f"rsync -a --delete /tmp/55cine-cta/dist/ {APP}/api/dist/ && "
        f"cp -f /tmp/55cine-cta/admin/cat-treasure.html {APP}/admin/ && "
        f"cp -f /tmp/55cine-cta/js/admin/cat-treasure-page.js {APP}/js/admin/ && "
        f"cp -f /tmp/55cine-cta/js/admin/layout.js {APP}/js/admin/ && "
        f"cp -f /tmp/55cine-cta/js/admin/api.js {APP}/js/admin/ && "
        f"cp -f /tmp/55cine-cta/css/admin.css {APP}/css/ && "
        f"chown -R www-data:www-data {APP}/api/dist {APP}/admin/cat-treasure.html "
        f"{APP}/js/admin {APP}/css/admin.css && "
        f"grep -q getCatTreasureAdminDetail {APP}/api/dist/services/cat-treasure-event.service.js && "
        f"test -f {APP}/admin/cat-treasure.html && echo 'cat-treasure admin ok' && "
        f"rm -rf /tmp/55cine-cta",
    )

    run(client, "systemctl restart 55cine-api", check=False)
    run(
        client,
        "for i in 1 2 3 4 5 6 7 8 9 10 12 15; do "
        "st=$(systemctl is-active 55cine-api 2>/dev/null || true); "
        "echo \"try $i: $st\"; "
        "if [ \"$st\" = active ]; then exit 0; fi; "
        "if [ \"$st\" = failed ]; then journalctl -u 55cine-api -n 40 --no-pager; exit 1; fi; "
        "sleep 1; done; "
        "journalctl -u 55cine-api -n 50 --no-pager; exit 1",
    )

    print("\n=== verify ===")
    run(
        client,
        "curl -sS -o /dev/null -w 'html=%{http_code} js=%{http_code}\\n' "
        "https://55cine.com/admin/cat-treasure.html "
        "https://55cine.com/js/admin/cat-treasure-page.js; "
        "curl -sS --max-time 5 http://127.0.0.1:3000/api/v1/health; echo",
        check=False,
    )

    client.close()
    print("\n[done] https://55cine.com/admin/cat-treasure.html")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""고양이 이벤트 API dist + 프론트 JS 핫픽스 배포."""
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
        DIST / "routes" / "cat-treasure-event.js",
        DIST / "index.js",
        ROOT / "js" / "cat-treasure-event.js",
        ROOT / "data" / "cat-treasure-event.json",
    ]
    for p in need:
        if not p.is_file():
            raise SystemExit(f"missing {p}")

    fd, name = tempfile.mkstemp(suffix=".tar.gz", prefix="55cine-cat-treasure-")
    os.close(fd)
    tar_path = Path(name)
    with tarfile.open(tar_path, "w:gz") as tf:
        for path in DIST.rglob("*"):
            if path.is_file():
                tf.add(path, arcname=f"dist/{path.relative_to(DIST).as_posix()}")
        tf.add(ROOT / "js" / "cat-treasure-event.js", arcname="js/cat-treasure-event.js")
        tf.add(ROOT / "css" / "cat-treasure-event.css", arcname="css/cat-treasure-event.css")
        tf.add(ROOT / "data" / "cat-treasure-event.json", arcname="data/cat-treasure-event.json")
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

    remote_tar = "/root/55cine-cat-treasure.tar.gz"
    sftp = client.open_sftp()
    sftp.put(str(tar_path), remote_tar)
    sftp.close()
    tar_path.unlink(missing_ok=True)

    run(
        client,
        f"mkdir -p /tmp/55cine-ct && tar -xzf {remote_tar} -C /tmp/55cine-ct && rm -f {remote_tar} && "
        f"rsync -a --delete /tmp/55cine-ct/dist/ {APP}/api/dist/ && "
        f"cp -f /tmp/55cine-ct/js/cat-treasure-event.js {APP}/js/ && "
        f"cp -f /tmp/55cine-ct/css/cat-treasure-event.css {APP}/css/ && "
        f"cp -f /tmp/55cine-ct/data/cat-treasure-event.json {APP}/data/ && "
        f"chown -R www-data:www-data {APP}/api/dist {APP}/js/cat-treasure-event.js "
        f"{APP}/css/cat-treasure-event.css {APP}/data/cat-treasure-event.json && "
        f"chmod 664 {APP}/data/cat-treasure-event.json && "
        f"rm -rf /tmp/55cine-ct && "
        f"test -f {APP}/api/dist/routes/cat-treasure-event.js && echo 'route ok'",
    )
    run(client, "systemctl restart 55cine-api && sleep 2 && systemctl is-active 55cine-api")

    print("\n=== verify ===")
    run(
        client,
        "curl -sS --max-time 10 http://127.0.0.1:3000/api/v1/events/cat-treasure; echo; "
        "curl -sS --max-time 10 https://55cine.com/api/v1/events/cat-treasure; echo",
        check=False,
    )
    client.close()
    print("\n[done] cat-treasure API + JS deployed")


if __name__ == "__main__":
    main()

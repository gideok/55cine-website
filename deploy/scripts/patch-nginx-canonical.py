#!/usr/bin/env python3
"""nginx conf만 서버에 반영 (www→apex 301 + HSTS)."""
from __future__ import annotations

import getpass
import os
import sys
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
LOCAL_CONF = ROOT / "deploy" / "nginx" / "55cine.conf"


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


def main() -> None:
    if not LOCAL_CONF.is_file():
        raise SystemExit(f"missing {LOCAL_CONF}")

    password = os.environ.get("DEPLOY_PASSWORD")
    if not password:
        password = getpass.getpass(f"SSH password for {USER}@{HOST}: ")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[ssh] connect {USER}@{HOST}")
    client.connect(HOST, username=USER, password=password, timeout=30)

    remote_tmp = "/tmp/55cine.conf"
    print(f"[sftp] upload {LOCAL_CONF.name}")
    sftp = client.open_sftp()
    sftp.put(str(LOCAL_CONF), remote_tmp)
    sftp.put(str(LOCAL_CONF), f"{APP}/deploy/nginx/55cine.conf")
    sftp.close()

    run(
        client,
        f"cp {remote_tmp} /etc/nginx/sites-available/55cine.conf && "
        f"rm -f {remote_tmp} && "
        "nginx -t && systemctl reload nginx",
    )

    print("\n=== verify redirects / HSTS ===")
    run(
        client,
        "curl -sI --max-time 10 https://www.55cine.com/ | head -12; echo; "
        "curl -sI --max-time 10 https://www.55cine.com/now-playing.html | head -8; echo; "
        "curl -sI --max-time 10 https://55cine.com/ | grep -iE '^(HTTP/|strict-transport|location:)' ; echo; "
        "curl -sI --max-time 10 http://www.55cine.com/ | head -8",
        check=False,
    )

    client.close()
    print("\n[done] nginx www→apex + HSTS applied")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""55cine-api 장애 진단 + 필요 시 재기동."""
from __future__ import annotations

import getpass
import os
import sys

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    sys.exit(1)

HOST = os.environ.get("DEPLOY_HOST", "49.247.207.161")
USER = os.environ.get("DEPLOY_USER", "root")
APP = "/var/www/55cine"


def run(client: paramiko.SSHClient, cmd: str) -> str:
    print(f"$ {cmd}")
    _stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    text = (out or "") + (("\n" + err) if err.strip() else "")
    if text.strip():
        print(text.rstrip())
    return text


def main() -> None:
    password = os.environ.get("DEPLOY_PASSWORD")
    if not password:
        password = getpass.getpass(f"SSH password for {USER}@{HOST}: ")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=password, timeout=30)

    run(client, "node -v; systemctl is-active 55cine-api || true")
    run(client, "systemctl --no-pager -l status 55cine-api | head -40")
    run(client, "journalctl -u 55cine-api -n 80 --no-pager")
    run(
        client,
        f"cd {APP}/api && sudo -u www-data /usr/bin/node -e \"import('node:sqlite').then(()=>console.log('sqlite ok')).catch(e=>console.error('sqlite fail',e))\" 2>&1 || true",
    )
    run(
        client,
        f"cd {APP}/api && timeout 8 sudo -u www-data /usr/bin/node dist/index.js 2>&1 || true",
    )

    client.close()


if __name__ == "__main__":
    main()

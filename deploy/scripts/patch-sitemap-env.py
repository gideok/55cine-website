#!/usr/bin/env python3
"""SSH로 sitemap dist 업로드 + SITE_URL .env 반영 + nginx/API 점검."""
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
SITE_URL = "https://55cine.com"
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


def pack_dist() -> Path:
    if not (DIST / "routes" / "sitemap.js").is_file():
        raise SystemExit(
            f"missing {DIST / 'routes' / 'sitemap.js'} — run: cd api && npm run build"
        )
    fd, name = tempfile.mkstemp(suffix=".tar.gz", prefix="55cine-api-dist-")
    os.close(fd)
    tar_path = Path(name)
    with tarfile.open(tar_path, "w:gz") as tf:
        for path in DIST.rglob("*"):
            if path.is_file():
                tf.add(path, arcname=path.relative_to(DIST).as_posix())
        nginx = ROOT / "deploy" / "nginx" / "55cine.conf"
        if nginx.is_file():
            tf.add(nginx, arcname="__nginx__/55cine.conf")
        src_files = [
            ROOT / "api" / "src" / "routes" / "sitemap.ts",
            ROOT / "api" / "src" / "services" / "sitemap.service.ts",
            ROOT / "api" / "src" / "index.ts",
            ROOT / "api" / "src" / "config.ts",
        ]
        for src in src_files:
            if src.is_file():
                tf.add(src, arcname=f"__src__/{src.relative_to(ROOT / 'api' / 'src').as_posix()}")
    print(f"[pack] api/dist -> {tar_path} ({tar_path.stat().st_size / 1024:.1f} KB)")
    return tar_path


def main() -> None:
    tar_path = pack_dist()
    password = os.environ.get("DEPLOY_PASSWORD")
    if not password:
        password = getpass.getpass(f"SSH password for {USER}@{HOST}: ")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[ssh] connect {USER}@{HOST}")
    client.connect(HOST, username=USER, password=password, timeout=30)

    remote_tar = "/root/55cine-api-dist.tar.gz"
    print(f"[sftp] upload {tar_path.name}")
    sftp = client.open_sftp()
    sftp.put(str(tar_path), remote_tar)
    sftp.close()
    tar_path.unlink(missing_ok=True)

    print("\n=== extract dist + source + nginx ===")
    run(
        client,
        f"mkdir -p {APP}/api/dist /tmp/55cine-dist-upload && "
        f"tar -xzf {remote_tar} -C /tmp/55cine-dist-upload && "
        f"rm -f {remote_tar} && "
        f"rsync -a --delete /tmp/55cine-dist-upload/ "
        f"--exclude '__nginx__' --exclude '__src__' {APP}/api/dist/ && "
        f"cp -f /tmp/55cine-dist-upload/__nginx__/55cine.conf {APP}/deploy/nginx/55cine.conf && "
        f"mkdir -p {APP}/api/src/routes {APP}/api/src/services && "
        f"cp -f /tmp/55cine-dist-upload/__src__/routes/sitemap.ts {APP}/api/src/routes/ && "
        f"cp -f /tmp/55cine-dist-upload/__src__/services/sitemap.service.ts {APP}/api/src/services/ && "
        f"cp -f /tmp/55cine-dist-upload/__src__/index.ts {APP}/api/src/ && "
        f"cp -f /tmp/55cine-dist-upload/__src__/config.ts {APP}/api/src/ && "
        f"rm -rf /tmp/55cine-dist-upload && "
        f"test -f {APP}/api/dist/routes/sitemap.js && echo 'sitemap.js ok'",
    )

    print("\n=== nginx conf ===")
    run(
        client,
        f"cp {APP}/deploy/nginx/55cine.conf /etc/nginx/sites-available/55cine.conf && "
        "nginx -t && systemctl reload nginx && "
        "grep -n 'sitemap.xml\\|robots.txt' /etc/nginx/sites-available/55cine.conf",
    )

    print("\n=== ensure SITE_URL in .env ===")
    run(
        client,
        "python3 - <<'PY'\n"
        f"from pathlib import Path\n"
        f"p = Path('{APP}/.env')\n"
        f"text = p.read_text(encoding='utf-8') if p.exists() else ''\n"
        f"lines = text.splitlines()\n"
        f"key = 'SITE_URL'\n"
        f"val = '{SITE_URL}'\n"
        f"found = False\n"
        f"out = []\n"
        f"for line in lines:\n"
        f"    if line.startswith('SITE_URL=') or line.startswith('PUBLIC_SITE_URL='):\n"
        f"        if not found:\n"
        f"            out.append(f'{{key}}={{val}}')\n"
        f"            found = True\n"
        f"        continue\n"
        f"    out.append(line)\n"
        f"if not found:\n"
        f"    if out and out[-1].strip():\n"
        f"        out.append('')\n"
        f"    out.append('# 공개 사이트 URL (sitemap.xml · robots.txt)')\n"
        f"    out.append(f'{{key}}={{val}}')\n"
        f"p.write_text('\\n'.join(out).rstrip() + '\\n', encoding='utf-8')\n"
        f"print('SITE_URL set to', val)\n"
        f"print('--- .env keys (names only) ---')\n"
        f"for line in p.read_text(encoding='utf-8').splitlines():\n"
        f"    if not line.strip() or line.strip().startswith('#'): continue\n"
        f"    print(line.split('=',1)[0])\n"
        "PY",
    )

    print("\n=== ownership + restart API ===")
    run(
        client,
        f"chown -R www-data:www-data {APP}/api/dist {APP}/api/src {APP}/deploy/nginx && "
        f"chmod 640 {APP}/.env && "
        "systemctl restart 55cine-api && sleep 2 && systemctl is-active 55cine-api",
    )

    print("\n=== verify ===")
    run(client, "curl -sS --max-time 5 http://127.0.0.1:3000/api/v1/health", check=False)
    run(
        client,
        "echo '--- robots ---'; curl -sS --max-time 10 http://127.0.0.1:3000/api/v1/robots.txt; echo; "
        "echo '--- sitemap head ---'; "
        "curl -sS -o /tmp/sm.xml -w 'http=%{http_code} bytes=%{size_download}\\n' "
        "--max-time 60 http://127.0.0.1:3000/api/v1/sitemap.xml; "
        "head -c 500 /tmp/sm.xml; echo; "
        "echo -n 'url_count='; grep -c '<url>' /tmp/sm.xml || true",
        check=False,
    )
    run(
        client,
        "echo '--- public ---'; "
        "curl -sS -I --max-time 15 https://55cine.com/robots.txt | head -10; "
        "curl -sS -I --max-time 15 https://55cine.com/sitemap.xml | head -10; "
        "curl -sS --max-time 15 https://55cine.com/robots.txt | head -20",
        check=False,
    )

    client.close()
    print("\n[done] dist + SITE_URL + nginx sitemap/robots applied")


if __name__ == "__main__":
    main()

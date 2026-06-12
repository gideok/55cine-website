#!/usr/bin/env python3
"""로컬에서 운영 서버로 55cine 사이트 배포 (최초·수동)."""
from __future__ import annotations

import argparse
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
APP_ROOT = "/var/www/55cine"

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "documents",
    "tmp",
    ".claude",
    "deploy/.cache",
}
EXCLUDE_FILES = {".env", ".env.local"}


def should_skip(rel: str) -> bool:
    parts = Path(rel).parts
    if parts and parts[0] in EXCLUDE_DIRS:
        return True
    if "node_modules" in parts:
        return True
    if rel in EXCLUDE_FILES:
        return True
    if rel.endswith(".log"):
        return True
    if "/.cache" in rel or rel.startswith("api/.tmp"):
        return True
    return False


def build_tar(tar_path: Path) -> None:
    print(f"[pack] {ROOT} -> {tar_path}")
    with tarfile.open(tar_path, "w:gz") as tf:
        for path in ROOT.rglob("*"):
            if not path.is_file():
                continue
            rel = path.relative_to(ROOT).as_posix()
            if should_skip(rel):
                continue
            tf.add(path, arcname=rel)
    size_mb = tar_path.stat().st_size / (1024 * 1024)
    print(f"[pack] done ({size_mb:.1f} MB)")


def ssh_run(client: paramiko.SSHClient, cmd: str) -> None:
    print(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(err.rstrip(), file=sys.stderr)
    if stdout.channel.recv_exit_status() != 0:
        raise RuntimeError(f"command failed: {cmd}")


def upload_and_extract(
    host: str, user: str, password: str, tar_path: Path, env_path: Path | None
) -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[ssh] connect {user}@{host}")
    client.connect(host, username=user, password=password, timeout=30)

    ssh_run(client, f"mkdir -p {APP_ROOT}")
    ssh_run(client, f"rm -rf {APP_ROOT}.bak && mv {APP_ROOT} {APP_ROOT}.bak 2>/dev/null || true")
    ssh_run(client, f"mkdir -p {APP_ROOT}")
    ssh_run(client, "rm -f /root/55cine-deploy.tar.gz /tmp/55cine-deploy.tar.gz")

    # /tmp 는 tmpfs(약 480MB) — 대용량 tarball 은 디스크(/root)에 업로드
    remote_tar = "/root/55cine-deploy.tar.gz"
    size_mb = tar_path.stat().st_size / 1024 / 1024
    print(f"[sftp] upload {tar_path.name} ({size_mb:.1f} MB) -> {remote_tar}")

    def progress(sent: int, total: int) -> None:
        if total and sent % (64 * 1024 * 1024) < 1024 * 1024:
            print(f"  ... {sent * 100 // total}%")

    sftp = client.open_sftp()
    sftp.put(str(tar_path), remote_tar, callback=progress)
    sftp.close()

    ssh_run(client, f"tar -xzf {remote_tar} -C {APP_ROOT}")
    ssh_run(client, f"rm -f {remote_tar}")

    if env_path and env_path.is_file():
        print(f"[sftp] upload .env")
        sftp = client.open_sftp()
        sftp.put(str(env_path), f"{APP_ROOT}/.env")
        sftp.close()

    ssh_run(client, f"chmod +x {APP_ROOT}/deploy/scripts/*.sh")
    ssh_run(client, f"sed -i 's/\\r$//' {APP_ROOT}/deploy/scripts/*.sh")
    ssh_run(client, f"bash {APP_ROOT}/deploy/scripts/remote-setup.sh {APP_ROOT}")
    client.close()
    print("[deploy] complete")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", "49.247.139.238"))
    parser.add_argument("--user", default=os.environ.get("DEPLOY_USER", "root"))
    parser.add_argument("--password", default=os.environ.get("DEPLOY_PASSWORD"))
    parser.add_argument("--env", default=str(ROOT / ".env"))
    parser.add_argument("--skip-pack", action="store_true")
    parser.add_argument("--tar", default="")
    args = parser.parse_args()

    if not args.password:
        print("DEPLOY_PASSWORD 또는 --password 필요", file=sys.stderr)
        sys.exit(1)

    api_dist = ROOT / "api" / "dist"
    if not api_dist.is_dir():
        print("[build] npm run build (api)")
        subprocess.check_call(["npm", "run", "build"], cwd=ROOT / "api", shell=os.name == "nt")

    if args.tar:
        tar_path = Path(args.tar)
    elif args.skip_pack:
        print("--tar 필요 (--skip-pack)", file=sys.stderr)
        sys.exit(1)
    else:
        tmp = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False)
        tmp.close()
        tar_path = Path(tmp.name)
        build_tar(tar_path)

    env_path = Path(args.env) if args.env else None
    try:
        upload_and_extract(args.host, args.user, args.password, tar_path, env_path)
    finally:
        if not args.tar and tar_path.exists():
            tar_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()

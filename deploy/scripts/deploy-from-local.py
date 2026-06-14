#!/usr/bin/env python3
"""로컬에서 운영 서버로 55cine 사이트 배포 (최초·수동)."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = "/var/www/55cine"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack_lib import build_tarball  # noqa: E402


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
    host: str,
    user: str,
    password: str,
    tar_path: Path,
    env_path: Path | None,
    *,
    no_images: bool,
    no_preserve_images: bool,
) -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[ssh] connect {user}@{host}")
    client.connect(host, username=user, password=password, timeout=30)

    ssh_run(client, f"mkdir -p {APP_ROOT}")

    preserve = not no_preserve_images and not no_images
    if preserve:
        ssh_run(
            client,
            f"bash {APP_ROOT}/deploy/scripts/server-images-guard.sh stash "
            f"2>/dev/null || echo '[deploy] stash skip (first deploy or no guard script)'",
        )

    # images 제외 배포: 서버 images/ 유지 — 폴더 통째 교체(mv .bak) 하지 않음
    if no_images:
        print("[deploy] overlay mode (images/ on server preserved)")
    else:
        ssh_run(client, f"rm -rf {APP_ROOT}.bak && mv {APP_ROOT} {APP_ROOT}.bak 2>/dev/null || true")
        ssh_run(client, f"mkdir -p {APP_ROOT}")

    remote_tar = "/root/55cine-deploy.tar.gz"
    ssh_run(client, f"rm -f {remote_tar} /tmp/55cine-deploy.tar.gz")
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

    if preserve:
        ssh_run(client, f"bash {APP_ROOT}/deploy/scripts/server-images-guard.sh merge")

    if env_path and env_path.is_file():
        print("[sftp] upload .env")
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
    parser.add_argument(
        "--no-images",
        action="store_true",
        help="images/ 제외 패키징 + 서버 images/ 유지(overlay 배포)",
    )
    parser.add_argument(
        "--no-preserve-images",
        action="store_true",
        help="전체 배포 시 stash/merge 생략 (비권장)",
    )
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
        build_tarball(ROOT, tar_path, exclude_images=args.no_images)

    env_path = Path(args.env) if args.env else None
    try:
        upload_and_extract(
            args.host,
            args.user,
            args.password,
            tar_path,
            env_path,
            no_images=args.no_images,
            no_preserve_images=args.no_preserve_images,
        )
    finally:
        if not args.tar and tar_path.exists():
            tar_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()

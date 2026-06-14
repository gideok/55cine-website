#!/usr/bin/env python3
"""로컬 images/ → 운영 서버 부분 배포 (SFTP, Windows·rsync 미설치 환경용)."""
from __future__ import annotations

import argparse
import fnmatch
import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[2]
IMAGES = ROOT / "images"
APP_ROOT = "/var/www/55cine"
REMOTE_IMAGES = f"{APP_ROOT}/images"
EXCLUDE_FILE = ROOT / "deploy" / "config" / "images-rsync-exclude.txt"


def load_exclude_patterns() -> list[str]:
    patterns: list[str] = []
    if EXCLUDE_FILE.is_file():
        for line in EXCLUDE_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            patterns.append(line)
    return patterns


def should_exclude(rel_posix: str, patterns: list[str]) -> bool:
    name = Path(rel_posix).name
    for pat in patterns:
        if fnmatch.fnmatch(name, pat) or fnmatch.fnmatch(rel_posix, pat):
            return True
        if pat.endswith("/") and rel_posix.startswith(pat.rstrip("/")):
            return True
    return False


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    parts = remote_dir.strip("/").split("/")
    cur = ""
    for part in parts:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except OSError:
            sftp.mkdir(cur)


def upload_tree(
    sftp: paramiko.SFTPClient | None,
    local_root: Path,
    remote_root: str,
    patterns: list[str],
    dry_run: bool,
) -> tuple[int, int]:
    files = 0
    skipped = 0
    for path in local_root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(local_root).as_posix()
        if should_exclude(rel, patterns):
            skipped += 1
            continue
        remote = f"{remote_root}/{rel}".replace("//", "/")
        if dry_run:
            print(f"  would upload {rel}")
        else:
            assert sftp is not None
            ensure_remote_dir(sftp, str(Path(remote).parent.as_posix()).replace("\\", "/"))
            sftp.put(str(path), remote)
            print(f"  uploaded {rel}")
        files += 1
    return files, skipped


def ssh_run(client: paramiko.SSHClient, cmd: str) -> None:
    print(f"$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    if stdout.channel.recv_exit_status() != 0:
        raise RuntimeError(f"command failed: {cmd}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync local images/ to production server")
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", "49.247.139.238"))
    parser.add_argument("--user", default=os.environ.get("DEPLOY_USER", "root"))
    parser.add_argument("--password", default=os.environ.get("DEPLOY_PASSWORD"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("DEPLOY_PORT", "22")))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not IMAGES.is_dir():
        print(f"missing: {IMAGES}", file=sys.stderr)
        sys.exit(1)
    if not args.password and not os.environ.get("DEPLOY_SSH_KEY"):
        print("DEPLOY_PASSWORD 또는 SSH 키 필요", file=sys.stderr)
        sys.exit(1)

    patterns = load_exclude_patterns()
    print(f"[rsync-images] {IMAGES} -> {args.user}@{args.host}:{REMOTE_IMAGES}/")
    if args.dry_run:
        files, skipped = upload_tree(None, IMAGES, REMOTE_IMAGES, patterns, True)
        print(f"[rsync-images] dry-run done ({files} files, {skipped} excluded)")
        return

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kw: dict = {
        "hostname": args.host,
        "username": args.user,
        "port": args.port,
        "timeout": 60,
    }
    if args.password:
        connect_kw["password"] = args.password
    client.connect(**connect_kw)

    sftp = client.open_sftp()
    ensure_remote_dir(sftp, REMOTE_IMAGES)
    files, skipped = upload_tree(sftp, IMAGES, REMOTE_IMAGES, patterns, False)
    sftp.close()

    ssh_run(client, f"chown -R www-data:www-data {REMOTE_IMAGES} 2>/dev/null || true")
    client.close()
    print(f"[rsync-images] done ({files} uploaded, {skipped} excluded)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""고양이 이벤트 API dist + 프론트 핫픽스 배포.

기본: data/cat-treasure-event.json 의 currentWinners·winners 는 서버 값을 유지.
전체 설정 덮어쓰기: FORCE_EVENT_CONFIG=1
"""
from __future__ import annotations

import getpass
import json
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
FORCE_EVENT_CONFIG = os.environ.get("FORCE_EVENT_CONFIG", "").strip() in ("1", "true", "yes")


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
        DIST / "services" / "cat-treasure-event.service.js",
        DIST / "index.js",
        ROOT / "js" / "cat-treasure-event.js",
        ROOT / "css" / "cat-treasure-event.css",
        ROOT / "data" / "cat-treasure-event.json",
    ]
    for p in need:
        if not p.is_file():
            raise SystemExit(f"missing {p} — run: cd api && npm run build")

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


def merge_event_config(client: paramiko.SSHClient, local_cfg_path: str, remote_cfg: str) -> None:
    """로컬 설정 반영 + 서버 winners/currentWinners 보존."""
    sftp = client.open_sftp()
    try:
        with sftp.open(remote_cfg, "r") as rf:
            remote = json.loads(rf.read().decode("utf-8"))
    except OSError:
        remote = {}
    with open(local_cfg_path, encoding="utf-8") as lf:
        local = json.load(lf)

    merged = dict(local)
    if not FORCE_EVENT_CONFIG:
        if "currentWinners" in remote:
            merged["currentWinners"] = remote.get("currentWinners", 0)
        if isinstance(remote.get("winners"), list):
            merged["winners"] = remote["winners"]
        print(
            f"[config] preserve server currentWinners={merged.get('currentWinners')} "
            f"winners={len(merged.get('winners') or [])}"
        )
    else:
        print("[config] FORCE_EVENT_CONFIG=1 — overwrite entire JSON")

    tmp = "/tmp/cat-treasure-event.merged.json"
    payload = (json.dumps(merged, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    with sftp.open(tmp, "w") as wf:
        wf.write(payload)
    sftp.close()

    run(
        client,
        f"cp -f {tmp} {remote_cfg} && rm -f {tmp} && "
        f"chown www-data:www-data {remote_cfg} && chmod 664 {remote_cfg}",
    )


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
        f"chown -R www-data:www-data {APP}/api/dist {APP}/js/cat-treasure-event.js "
        f"{APP}/css/cat-treasure-event.css && "
        f"test -f {APP}/api/dist/routes/cat-treasure-event.js && "
        f"grep -q winners {APP}/api/dist/services/cat-treasure-event.service.js && echo 'route+winners ok' && "
        f"rm -rf /tmp/55cine-ct",
    )

    # 설정 병합 (당첨 기록 보존)
    # tar에서 꺼낸 로컬 JSON은 이미 삭제됐으므로 워크스페이스 파일 사용
    merge_event_config(client, str(ROOT / "data" / "cat-treasure-event.json"), f"{APP}/data/cat-treasure-event.json")

    run(client, "systemctl restart 55cine-api && sleep 2 && systemctl is-active 55cine-api")

    print("\n=== verify ===")
    run(
        client,
        "curl -sS --max-time 10 http://127.0.0.1:3000/api/v1/events/cat-treasure; echo; "
        "curl -sS --max-time 10 https://55cine.com/api/v1/events/cat-treasure; echo; "
        f"python3 -c \"import json; d=json.load(open('{APP}/data/cat-treasure-event.json')); "
        "print('winners_key', 'winners' in d, 'count', len(d.get('winners') or []), "
        "'current', d.get('currentWinners'))\"",
        check=False,
    )
    client.close()
    print("\n[done] cat-treasure winners logging ready on server")


if __name__ == "__main__":
    main()

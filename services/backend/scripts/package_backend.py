from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


PACKAGE_NAME = "lmctrlf-backend"


def build_command(dist_root: Path, work_root: Path, spec_root: Path, entrypoint: Path) -> list[str]:
    return [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onedir",
        "--name",
        PACKAGE_NAME,
        "--distpath",
        str(dist_root),
        "--workpath",
        str(work_root),
        "--specpath",
        str(spec_root),
        "--paths",
        str(entrypoint.parents[1]),
        "--collect-all",
        "fastapi",
        "--collect-all",
        "httpx",
        "--collect-all",
        "lancedb",
        "--collect-all",
        "peewee",
        "--collect-all",
        "pydantic",
        "--collect-all",
        "pydantic_core",
        "--collect-all",
        "pypdf",
        "--collect-all",
        "pyarrow",
        "--collect-all",
        "starlette",
        "--collect-all",
        "uvicorn",
        str(entrypoint),
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Package the Python sidecar for Electron release builds.")
    parser.add_argument("--platform", choices=("macos", "windows"), required=True)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    dist_root = repo_root / "apps" / "desktop" / "dist" / "backend"
    work_root = repo_root / "services" / "backend" / "build" / f"pyinstaller-{args.platform}"
    spec_root = repo_root / "services" / "backend" / "build" / "spec"
    entrypoint = repo_root / "services" / "backend" / "app" / "main.py"

    shutil.rmtree(dist_root, ignore_errors=True)
    shutil.rmtree(work_root, ignore_errors=True)
    spec_root.mkdir(parents=True, exist_ok=True)
    dist_root.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        build_command(dist_root=dist_root, work_root=work_root, spec_root=spec_root, entrypoint=entrypoint),
        check=True,
        cwd=repo_root,
    )


if __name__ == "__main__":
    main()

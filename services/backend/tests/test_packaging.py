from pathlib import Path

from scripts.package_backend import resolve_packaging_paths


def test_resolve_packaging_paths_uses_repository_root() -> None:
    script_path = Path("/workspace/LMCtrlF/services/backend/scripts/package_backend.py")

    dist_root, work_root, spec_root, entrypoint = resolve_packaging_paths(
        script_path=script_path,
        platform="macos",
    )

    assert dist_root == Path("/workspace/LMCtrlF/apps/desktop/dist/backend")
    assert work_root == Path("/workspace/LMCtrlF/services/backend/build/pyinstaller-macos")
    assert spec_root == Path("/workspace/LMCtrlF/services/backend/build/spec")
    assert entrypoint == Path("/workspace/LMCtrlF/services/backend/app/main.py")

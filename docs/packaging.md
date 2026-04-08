# Packaging

## Requirements

- macOS packaging requires macOS, Conda, the `lmctrlf-dev` environment, Node.js, and `pnpm`
- Windows packaging requires Windows (or Windows CI), Conda, the `lmctrlf-dev` environment, Node.js, and `pnpm`
- `PyInstaller` must be available inside the Conda environment because the desktop package bundles a frozen Python sidecar
- Packaging scripts prefer an installed `electron-builder` binary and fall back to `pnpm dlx electron-builder@26.0.12` when one is not available

## Release Outputs

- macOS packaging produces an unpacked `.app` through the Electron `dir` target
- Windows packaging is prepared to produce an NSIS installer
- build intermediates live under `apps/desktop/dist`
- packaged release outputs live under `apps/desktop/release`

## Commands

Run macOS packaging from the repository root:

```bash
pnpm package:desktop:mac
```

Run Windows packaging from a Windows machine or CI worker:

```powershell
pnpm package:desktop:win
```

If `pnpm dlx electron-builder` is unstable on the local machine, install `electron-builder` on the host first so the packaging scripts can use the direct binary path.

## Packaging Flow

1. Build the React renderer into `apps/desktop/dist/renderer`
2. Build the Electron main and preload bundles into `apps/desktop/dist/electron`
3. Freeze the Python backend into `apps/desktop/dist/backend/lmctrlf-backend`
4. Package the desktop application with `electron-builder`

Renderer assets that come from `apps/desktop/public` must be referenced through Vite's base-aware asset paths. Root-absolute paths such as `/asset.png` work in development but break in packaged `file://` builds.

The packaged preload bridge runs inside Electron's sandboxed preload runtime. Keep it free of Node-only imports such as `node:path` so the file-path bridge continues to load in release builds.

## Current Constraints

- This repository does not yet configure code signing, notarization, or certificate-based release signing
- The packaged application is expected to start its bundled backend automatically unless `LMCTRLF_BACKEND_URL` is explicitly provided for debugging
- Packaged SQLite and LanceDB data are written under Electron's `userData` directory, not inside the repository

# Electron Development

## Purpose

Use this note when working on the desktop shell or renderer startup flow.

## Baseline Workflow

1. Start the Python sidecar or ensure the Electron main process can spawn it.
2. Start the renderer dev server.
3. Launch Electron against the running renderer dev server.

## Expectations

- Keep Electron-specific logic inside the main process or preload layer.
- Avoid placing native or process-management logic in renderer code.
- Expose only minimal native APIs through preload.

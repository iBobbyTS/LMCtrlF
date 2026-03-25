# Packaging

## Purpose

Use this note when bundling the desktop app and Python sidecar.

## Baseline Workflow

1. Build the renderer assets.
2. Package or freeze the Python sidecar.
3. Bundle the desktop shell with the packaged backend.

## Expectations

- Development and release workflows should stay separate.
- Do not require end users to install conda.
- Document every packaging prerequisite in `docs/packaging.md`.

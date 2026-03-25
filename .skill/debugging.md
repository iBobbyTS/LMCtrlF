# Debugging

## Purpose

Use this note for common integration failures across the desktop shell and sidecar.

## Quick Checks

1. Confirm the backend is reachable on the expected local URL.
2. Confirm the renderer received the backend base URL from preload.
3. Confirm the `/health` response matches the shared contract.

## Expectations

- Reproduce failures with the smallest possible path.
- Prefer test coverage for fixed regressions.
- Record any repeatable workflow in this folder after resolving it.

# Python Sidecar

## Purpose

Use this note when working on the FastAPI sidecar.

## Baseline Workflow

1. Activate the `lmctrlf-dev` conda environment.
2. Run the FastAPI app locally.
3. Validate the `/health` endpoint before testing Electron integration.

## Expectations

- Keep API contracts explicit and small.
- Add tests for every new endpoint.
- Prefer predictable JSON responses over implicit behavior.

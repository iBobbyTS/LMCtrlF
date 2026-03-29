# Architecture

## Repository Structure

The repository is organized as a lightweight monorepo:

- `apps/desktop`: Electron shell and React renderer
- `packages/shared`: shared frontend/backend contracts
- `services/backend`: FastAPI sidecar
- `docs`: project documentation
- `.skill`: project-local workflow notes

## Runtime Overview

The desktop application is split into three layers:

1. Electron main process
2. Electron preload bridge
3. Python FastAPI sidecar

During development:

- the renderer runs through Vite
- the Electron main process reads the renderer URL from `LMCTRLF_RENDERER_URL`
- the Electron main process starts the Python sidecar locally unless `LMCTRLF_BACKEND_URL` is already provided

## Current Scope

The current implementation provides:

- a shared contract package
- a backend `/health` endpoint
- an Electron shell with preload access to the backend base URL
- a React renderer with a desktop navigation shell
- a high-fidelity document management page
- placeholder routes for chat and configuration pages

The repository does not yet include:

- real document ingestion
- indexing
- vector storage integration
- live chat workflows
- persistent settings storage

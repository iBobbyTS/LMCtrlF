# Architecture

## Repository Structure

The repository is organized as a lightweight monorepo:

- `apps/desktop`: Electron shell and React renderer
- `packages/shared`: shared frontend/backend contracts
- `services/backend`: FastAPI sidecar
- `docs`: project documentation

## Runtime Overview

The desktop application is split into three layers:

1. Electron main process
2. Electron preload bridge
3. Python FastAPI sidecar

During development:

- the renderer runs through Vite
- the Electron main process reads the renderer URL from `LMCTRLF_RENDERER_URL`
- the Electron main process starts the Python sidecar locally unless `LMCTRLF_BACKEND_URL` is already provided
- the Electron main process probes for a free localhost backend port starting at `8000`, passes the selected port to the sidecar, and waits for a healthy `/health` response before creating the desktop window
- the desktop window keeps a minimum width large enough to preserve the project chat header layout

## Current Scope

The current implementation provides:

- a shared contract package
- a backend `/health` endpoint plus SQLite-backed project, document, and model-settings APIs
- an Electron shell with preload access to the backend base URL
- an Electron preload helper that resolves absolute file paths for imported renderer files
- a Projects home screen backed by persisted project records
- a project workspace with three focused surfaces: `File management`, `Chat`, and `Import Files`
- a file-management view that locks page scrolling and keeps overflow inside the table region
- a document import flow with drag-and-drop selection, a warning dialog, backend persistence, and polling progress updates
- backend connectivity handling that blocks the UI behind a retry-only `Backend Unreachable` dialog whenever the sidecar cannot be reached
- a chat view with a floating `Threads` button that controls a pinned panel on wide layouts, a temporary drawer on narrow layouts, and internal-only scrolling for threads and messages
- a Settings surface with persisted provider selection, embedding/chat model fields, and local accessibility toggles

## Renderer Behavior

The renderer now loads projects, documents, and model settings from the local FastAPI sidecar instead of seeding a mock workspace inside the UI.

The backend persists document metadata in SQLite and vectorized chunks in LanceDB. A single in-process background worker consumes queued documents, extracts PDF text page-by-page, requests embeddings from the selected LM Studio-compatible provider, and writes chunk vectors to the shared LanceDB table.

The top-level UI exposes two primary tabs:

- `Projects`
- `Settings`

Inside a project, the top-level tabs are replaced by focused project surfaces:

- `File management`
- `Chat`
- `Import Files`

The repository does not yet include:

- OCR or image extraction for PDFs
- multi-worker or distributed indexing
- live retrieval or answer synthesis against the stored vectors
- persisted accessibility settings

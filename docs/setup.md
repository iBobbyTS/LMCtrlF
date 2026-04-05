# Local Setup

## Requirements

- Node.js 24 or newer
- `pnpm`
- Conda

## Python Environment

Create the development environment from the repository root:

```bash
conda env create -f environment.yml
conda activate lmctrlf-dev
```

The backend project is located in `services/backend`.

By default the backend stores SQLite data in `services/backend/data/lmctrlf.sqlite3`.
Override this location with `LMCTRLF_DATABASE_PATH` if you need a different local database path.

By default LanceDB stores chunk vectors in `services/backend/data/lancedb`.
Override this location with `LMCTRLF_LANCEDB_PATH` if you need a different local vector store path.

The indexing flow requires additional Python packages declared in `environment.yml` / `services/backend/pyproject.toml`, including `pypdf` and `lancedb`. Recreate or update the Conda environment after pulling these changes.

## Node Dependencies

Install workspace dependencies from the repository root:

```bash
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install
```

## Running the Renderer and Electron Shell

Use the desktop package from the repository root:

```bash
pnpm --filter @lmctrlf/desktop dev
```

The Electron main process starts the Python sidecar automatically in development unless `LMCTRLF_BACKEND_URL` is already set.

If `127.0.0.1:8000` is already occupied, the Electron main process probes the next local ports and starts the sidecar on the first available one. The desktop window is only created after the chosen backend answers `/health`, so a failed sidecar launch no longer opens the UI against a stale or missing local service.

## Local Indexing Dependencies

The default provider profile targets LM Studio's OpenAI-compatible server at `http://127.0.0.1:1234/v1`.

To exercise the indexing flow locally:

1. Start LM Studio's local server.
2. Ensure an embedding model such as `text-embedding-embeddinggemma-300m` is loaded.
3. Run the desktop app and import a text-based PDF.

## Local Chat Dependencies

The chat flow uses LM Studio's native `POST /api/v1/chat` endpoint instead of the OpenAI-compatible `/v1/chat/completions` route.

To exercise the chat flow locally:

1. Start LM Studio's local server.
2. Ensure the selected `Chatting model` is downloaded and loaded in LM Studio.
3. Keep the provider set to `LM Studio` in the desktop `Settings` page.
4. Open a project thread and send a message.

If the stored base URL ends with `/v1`, the backend automatically derives the matching native LM Studio chat URL by replacing that suffix with `/api/v1/chat`.

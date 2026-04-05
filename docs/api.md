# API Contracts

## Shared Contracts

The shared contract package currently exposes:

- `HealthResponse`
- `ApiError`
- `ConnectionStatus`
- `DocumentStatus`
- `ProjectRecord`
- `DocumentRecord`
- `ProviderSettingsRecord`
- `ModelSettingsResponse`
- `UpdateModelSettingsRequest`
- `CreateProjectRequest`
- `ImportDocumentItem`
- `ImportDocumentsRequest`

## Backend HTTP API

### `GET /health`

Returns the current backend health status.

The desktop renderer uses this endpoint during startup. If the request fails, the app blocks the workspace behind a retry-only `Backend Unreachable` dialog until `/health` succeeds.

Example response:

```json
{
  "status": "ok"
}
```

### `GET /projects`

Returns every persisted project ordered by the most recent update timestamp.

Example response:

```json
[
  {
    "id": "project-123",
    "name": "Field Notes",
    "accent": "#c2410c",
    "createdAt": "2026-04-03T12:00:00Z",
    "updatedAt": "2026-04-03T12:00:00Z"
  }
]
```

### `POST /projects`

Creates a project record in SQLite.

Example request:

```json
{
  "name": "Field Notes",
  "accent": "#c2410c"
}
```

### `GET /projects/{projectId}/documents`

Returns all persisted documents for a project.

Each document now includes:

- `status`
- `progress`

`progress` is an integer from `0` to `100`. The desktop app renders `indexing` rows as `Indexing XX%`.

### `POST /projects/{projectId}/documents/import`

Imports document metadata for a project, computes an MD5 hash from the source file, stores the current document status, and queues new documents for background indexing.

Example request:

```json
{
  "items": [
    {
      "name": "launch-overview.pdf",
      "filePath": "/absolute/path/to/launch-overview.pdf"
    }
  ]
}
```

`DocumentStatus` currently supports:

- `queued`
- `indexing`
- `paused`
- `ready`
- `file_changed`

The current implementation writes newly imported documents as `queued`, then performs PDF text extraction, LM Studio embedding requests, and LanceDB writes in a local background worker.

### `DELETE /projects/{projectId}/documents/{documentId}`

Deletes a persisted document record from SQLite.

### `POST /projects/{projectId}/documents/{documentId}/reindex`

Deletes the existing LanceDB chunks for the selected document, resets the document to `queued`, and schedules a fresh indexing run.

### `GET /settings/model`

Returns the persisted provider settings used by the desktop app and backend indexing flow.

Example response:

```json
{
  "selectedProviderId": "lm-studio",
  "providers": [
    {
      "id": "lm-studio",
      "name": "LM Studio",
      "baseUrl": "http://127.0.0.1:1234/v1",
      "embeddingModel": "text-embedding-embeddinggemma-300m",
      "chattingModel": "qwen/qwen3-8b",
      "apiKey": "lm-studio"
    }
  ]
}
```

### `PUT /settings/model`

Replaces the persisted provider settings payload.

The indexing worker reads the selected provider's `baseUrl`, `embeddingModel`, and `apiKey` at runtime before requesting embeddings.

## Preload Bridge

The preload layer exposes a browser bridge for backend access and Electron file path resolution:

```ts
window.lmctrlf?.getBackendBaseUrl(): string
window.lmctrlf?.getPathForFile(file: File): string
```

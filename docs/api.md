# API Contracts

## Shared Contracts

The shared contract package currently exposes:

- `HealthResponse`
- `ApiError`
- `ConnectionStatus`
- `DocumentStatus`
- `ProjectRecord`
- `DocumentRecord`
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

### `POST /projects/{projectId}/documents/import`

Imports document metadata for a project, computes an MD5 hash from the source file, and stores the current document status.

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

The current implementation writes newly imported documents as `queued`. Queue execution, indexing progress, and pause/resume behavior are not implemented yet.

### `DELETE /projects/{projectId}/documents/{documentId}`

Deletes a persisted document record from SQLite.

## Preload Bridge

The preload layer exposes a browser bridge for backend access and Electron file path resolution:

```ts
window.lmctrlf?.getBackendBaseUrl(): string
window.lmctrlf?.getPathForFile(file: File): string
```

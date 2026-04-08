# API Contracts

## Shared Contracts

The shared contract package currently exposes:

- `HealthResponse`
- `ApiError`
- `ConnectionStatus`
- `DocumentStatus`
- `ChatSenderType`
- `CitationRecord`
- `ProjectRecord`
- `DocumentRecord`
- `ChatThreadRecord`
- `ChatMessageRecord`
- `ProviderSettingsRecord`
- `ModelSettingsResponse`
- `UpdateModelSettingsRequest`
- `CreateProjectRequest`
- `ImportDocumentItem`
- `ImportDocumentsRequest`
- `CreateChatThreadRequest`
- `SendChatMessageRequest`
- `ChatStreamEvent`

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

The chat runtime also reads the selected provider's `baseUrl`, `chattingModel`, and `apiKey`. Chat requests are only implemented for the `lm-studio` provider. Other providers return `501 Not Implemented` from the chat endpoint.

### `GET /projects/{projectId}/threads`

Returns every persisted chat thread for a project, ordered by the most recent thread update.

Example response:

```json
[
  {
    "id": "thread-123",
    "projectId": "project-123",
    "title": "Launch Notes",
    "summary": "Budget approval is still missing.",
    "createdAt": "2026-04-03T12:00:00Z",
    "updatedAt": "2026-04-03T12:05:00Z"
  }
]
```

`summary` is the latest assistant message content truncated to 100 characters. The renderer currently exposes it as a native tooltip on the thread item.

### `POST /projects/{projectId}/threads`

Creates a persisted thread record for the selected project.

New threads start with the provisional title `New thread N`, where `N` is the next project-local thread count.

### `GET /projects/{projectId}/threads/{threadId}/messages`

Returns the saved message history for a thread ordered by `createdAt`.

Example response:

```json
[
  {
    "id": "message-123",
    "threadId": "thread-123",
    "senderType": "user",
    "role": "User",
    "content": "What is still blocked?",
    "reasoningContent": "",
    "citations": [],
    "createdAt": "2026-04-03T12:04:00Z"
  },
  {
    "id": "message-124",
    "threadId": "thread-123",
    "senderType": "assistant",
    "role": "google/gemma-4-26b-a4b",
    "content": "Budget approval is still blocked.",
    "reasoningContent": "I should answer directly and mention the blocker first.",
    "citations": [
      {
        "documentId": "document-1",
        "documentName": "launch-overview.pdf",
        "pageNumber": 2,
        "chunkIndex": 1,
        "snippet": "Budget approval is still pending before launch.",
        "score": 0.12
      }
    ],
    "createdAt": "2026-04-03T12:05:00Z"
  }
]
```

The `role` field is an arbitrary text label. User messages store `User`. Assistant messages store the exact `chattingModel` value used for that response.

Each assistant message may also include `citations`, a list of retrieved document passages that were attached to that answer. The renderer shows these as numbered sources beneath the assistant bubble.

### `POST /projects/{projectId}/threads/{threadId}/messages/stream`

Starts a streamed LM Studio native chat request for the selected thread.

The backend:

- persists the user message in SQLite before contacting LM Studio
- embeds the user query with the selected embedding model and searches the current project's LanceDB chunks
- injects the top retrieved passages into the LM Studio request as grounded context
- uses `POST /api/v1/chat` against the selected LM Studio base URL
- keeps LM Studio continuation state in `lmstudio_last_response_id`
- falls back to a transcript-based retry when the stored `previous_response_id` is no longer valid
- stores the final assistant message, reasoning text, retrieved citations, updated thread summary, and refreshed thread title after the stream completes

The request body is:

```json
{
  "content": "What is still blocked?"
}
```

The response is `text/event-stream` and emits the following event types:

- `reasoning.delta`
- `reasoning.end`
- `message.delta`
- `message.end`
- `completed`
- `error`

The renderer relies on `completed` as the canonical persisted result for the final thread and message records.

## Preload Bridge

The preload layer exposes a browser bridge for backend access and Electron file path resolution:

```ts
window.lmctrlf?.getBackendBaseUrl(): string
window.lmctrlf?.getPathForFile(file: File): string
```

The packaged preload implementation is intentionally limited to browser-safe and Electron-safe modules. It must not depend on Node-only path helpers because release builds execute the preload bridge inside Electron's sandboxed preload runtime.

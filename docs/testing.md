# Testing

## Current Coverage

### Backend

- `/health` returns HTTP 200
- `/health` returns `{ "status": "ok" }`
- unknown routes return HTTP 404
- empty SQLite databases return an empty project list
- model settings can be loaded and saved from SQLite
- project creation persists records in SQLite
- document import persists `file_path`, `md5`, `queued`, and `progress`
- repeat imports of the same unchanged file do not create duplicates
- repeat imports of a changed file mark the document as `file_changed`
- document deletion removes persisted records
- SQLite-backed project and document data survives backend reinitialization
- PDF text extraction preserves page numbers and skips empty pages
- background indexing moves documents to `ready` and writes LanceDB chunks
- reindex replaces existing LanceDB chunks
- indexing failures fall back to `paused`
- empty projects return an empty persisted thread list
- creating a thread persists `New thread N`
- first chat turns persist both user and assistant messages
- assistant messages persist the exact `chattingModel` key in `role`
- assistant reasoning text is stored separately from visible message content
- thread summaries update from the latest assistant message
- follow-up turns reuse LM Studio `previous_response_id`
- invalid LM Studio `previous_response_id` values fall back to a transcript retry
- chat retrieval injects the top LanceDB passages into the LM Studio request
- assistant messages persist retrieved citations for later source display
- title-generation failures keep the provisional thread title
- non-LM Studio providers return `501` for chat

### Shared Package

- connection status values stay stable
- connection status validation accepts known values and rejects invalid ones
- document status values stay stable
- document status validation accepts known values and rejects invalid ones
- chat sender type values stay stable

### Desktop Package

- desktop runtime config resolves fallback values correctly
- renderer loads an empty Projects state from the backend
- startup health-check failures show a retry-only `Backend Unreachable` dialog
- later backend connection failures also reuse the retry-only `Backend Unreachable` dialog
- retrying after the backend recovers closes the dialog and loads the workspace
- creating a project requires a modal prompt for the project name
- creating a named project persists the record and opens an empty project workspace
- importing a document requires an explicit warning acknowledgement
- imported documents appear with `queued` status
- indexing rows render `Indexing XX%` while polling backend progress
- reindex sends a backend request and resets the document to `queued`
- deleting a document updates the backend-backed project table state
- selecting a file without a resolvable local path shows an inline error
- file-management locks page scrolling and keeps overflow inside the table region
- chat shows an empty state for projects without persisted threads and allows backend-backed thread creation
- chat streams saved user and assistant turns from the backend
- assistant messages show the exact chatting-model label
- assistant message bodies render Markdown formatting for the final visible reply
- assistant messages render retrieved source citations beneath the answer
- thread hover tooltips expose saved summaries
- saved reasoning defaults to collapsed whenever a thread is reopened
- non-LM Studio providers disable chat sending in the renderer
- model settings can be saved back to the backend
- accessibility switches update locally

## Local Commands

Run backend tests from the repository root:

```bash
conda run -n lmctrlf-dev pytest services/backend/tests
```

Run workspace Node tests from the repository root:

```bash
pnpm test
```

Run only the desktop package tests from the repository root:

```bash
pnpm --filter @lmctrlf/desktop test
```

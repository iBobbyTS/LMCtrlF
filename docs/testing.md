# Testing

## Current Coverage

### Backend

- `/health` returns HTTP 200
- `/health` returns `{ "status": "ok" }`
- unknown routes return HTTP 404
- empty SQLite databases return an empty project list
- project creation persists records in SQLite
- document import persists `file_path`, `md5`, and `queued` status
- repeat imports of the same unchanged file do not create duplicates
- repeat imports of a changed file mark the document as `file_changed`
- document deletion removes persisted records
- SQLite-backed project and document data survives backend reinitialization

### Shared Package

- connection status values stay stable
- connection status validation accepts known values and rejects invalid ones
- document status values stay stable
- document status validation accepts known values and rejects invalid ones

### Desktop Package

- desktop runtime config resolves fallback values correctly
- renderer loads an empty Projects state from the backend
- creating a project requires a modal prompt for the project name
- creating a named project persists the record and opens an empty project workspace
- importing a document requires an explicit warning acknowledgement
- imported documents appear with `queued` status
- deleting a document updates the backend-backed project table state
- selecting a file without a resolvable local path shows an inline error
- file-management locks page scrolling and keeps overflow inside the table region
- chat shows an empty state for projects without persisted threads and still allows local thread creation
- settings fields and accessibility switches update locally

## Local Commands

Run Python tests from the backend directory:

```bash
conda run -n lmctrlf-dev pytest
```

Run workspace Node tests from the repository root:

```bash
pnpm test
```

Run only the desktop package tests from the repository root:

```bash
pnpm --filter @lmctrlf/desktop test
```

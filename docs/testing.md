# Testing

## Current Coverage

### Backend

- `/health` returns HTTP 200
- `/health` returns `{ "status": "ok" }`
- unknown routes return HTTP 404

### Shared Package

- connection status values stay stable
- connection status validation accepts known values and rejects invalid ones

### Desktop Package

- desktop runtime config resolves fallback values correctly
- renderer shows the Projects page with direct project cards and no backend fetches
- creating a project requires a modal prompt for the project name
- closing the modal dismisses project creation without state changes
- creating a named project opens an empty project workspace
- clicking a project card opens the file-management page
- document actions update project table state
- file-management locks page scrolling and keeps overflow inside the table region
- chat view switches between project threads from the left-hand list
- chat renders the `Threads` control as a floating button instead of a header item
- chat locks page scrolling and keeps overflow inside thread and message containers
- narrow chat layouts open threads in a temporary drawer and close it after selection
- wide chat layouts can collapse and restore the pinned thread panel
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

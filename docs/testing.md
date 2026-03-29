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
- renderer shell renders the document management page by default
- renderer shell exposes navigation for document, chat, and settings routes
- chat route renders the mock conversation workspace through the shared shell
- settings route renders local/cloud configuration mockups through the shared shell
- initial renderer load does not trigger backend fetch calls

## Local Commands

Run Python tests from the backend directory:

```bash
conda run -n lmctrlf-dev pytest
```

Run workspace Node tests from the repository root:

```bash
pnpm test
```

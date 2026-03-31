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
- renderer shell renders the expected heading and backend URL

## Local Commands

Run Python tests from the backend directory:

```bash
conda run -n lmctrlf-dev pytest
```

Run workspace Node tests from the repository root:

```bash
pnpm test
```

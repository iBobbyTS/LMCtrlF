# API Contracts

## Shared Contracts

The shared contract package currently exposes:

- `HealthResponse`
- `ApiError`
- `ConnectionStatus`

## Backend HTTP API

### `GET /health`

Returns the current backend health status.

Example response:

```json
{
  "status": "ok"
}
```

## Preload Bridge

The preload layer exposes a minimal browser bridge:

```ts
window.lmctrlf?.getBackendBaseUrl(): string
```

The current UI prototype no longer consumes this value directly, but the bridge remains available for future backend integration.

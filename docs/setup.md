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

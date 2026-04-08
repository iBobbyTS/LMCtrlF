#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DESKTOP_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(CDPATH= cd -- "$DESKTOP_ROOT/../.." && pwd)

if [ "$(uname -s)" != "Darwin" ]; then
  echo "The macOS packaging script must be run on macOS." >&2
  exit 1
fi

cd "$DESKTOP_ROOT"
pnpm run build

cd "$REPO_ROOT"
conda run -n lmctrlf-dev python services/backend/scripts/package_backend.py --platform macos

cd "$DESKTOP_ROOT"
export CSC_IDENTITY_AUTO_DISCOVERY=false
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=8192"

if command -v electron-builder >/dev/null 2>&1; then
  electron-builder --config ./electron-builder.json --publish never --mac dir
else
  pnpm dlx electron-builder@26.0.12 --config ./electron-builder.json --publish never --mac dir
fi

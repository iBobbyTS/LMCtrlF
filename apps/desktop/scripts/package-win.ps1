$ErrorActionPreference = "Stop"

if (-not $IsWindows) {
  throw "The Windows packaging script must be run on Windows or Windows CI."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopRoot = Resolve-Path (Join-Path $scriptDir "..")
$repoRoot = Resolve-Path (Join-Path $desktopRoot "../..")

Set-Location $desktopRoot
pnpm run build

Set-Location $repoRoot
conda run -n lmctrlf-dev python services/backend/scripts/package_backend.py --platform windows

Set-Location $desktopRoot
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
pnpm dlx electron-builder@26.0.12 --config .\electron-builder.json --publish never --win nsis

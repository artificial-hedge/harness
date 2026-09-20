#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DshHome = Join-Path $Root "dsh-home"
$ProfileDir = Join-Path $DshHome "profiles\web"
$DshVersion = "0.1.2-rc.1"
. (Join-Path $Root "windows-lib.ps1")

function Assert-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw @"
Node.js is not on PATH.
Install Node 22.19+ or 24+ from https://nodejs.org (Windows x64 MSI),
then close and reopen PowerShell.
"@
  }
  $raw = (node -v).Trim().TrimStart("v")
  $parts = $raw.Split(".")
  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  $ok = (($major -eq 22) -and ($minor -ge 19)) -or ($major -ge 24)
  if (-not $ok) {
    throw "Node $raw is too old. DSH needs ^22.19.0 or >=24.0.0. You have $raw."
  }
  Write-Host "Node $raw OK"
}

function Ensure-Pnpm {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host "pnpm $((pnpm -v).Trim()) OK"
    return
  }
  Write-Host "Installing pnpm (npm/npx often OOM on @deepseek-ai/dsh)..."
  npm install -g pnpm
  Refresh-SessionPath
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm install failed. Reopen PowerShell and rerun."
  }
}

function Install-DshCli {
  $env:PNPM_CONFIG_AUTO_INSTALL_PEERS = "true"
  $env:NODE_OPTIONS = "--max-old-space-size=8192"
  Ensure-PnpmHomeOnPath
  Write-Host "Installing @deepseek-ai/dsh@$DshVersion globally via pnpm..."
  pnpm add -g "@deepseek-ai/dsh@$DshVersion"
  Refresh-SessionPath
  $dsh = Find-DshCommand -Root $Root
  if (-not $dsh) {
    $bins = @(Get-PnpmGlobalBinDirs)
    throw "dsh was installed but no shim was found. pnpm bins: $($bins -join '; ')"
  }
  Save-DshCommand -Root $Root -Path $dsh
  Write-Host "dsh CLI: $dsh"
}

function Install-WebProfile {
  $pkg = Join-Path $ProfileDir "package.json"
  if (-not (Test-Path $pkg)) {
    throw "Missing $pkg ; clone is incomplete."
  }
  $env:PNPM_CONFIG_AUTO_INSTALL_PEERS = "true"
  $env:NODE_OPTIONS = "--max-old-space-size=8192"
  Write-Host "Installing web profile plugins into $ProfileDir ..."
  Push-Location $ProfileDir
  try {
    pnpm install
  } finally {
    Pop-Location
  }
}

Assert-Node
Ensure-Pnpm
Install-DshCli
Install-WebProfile

Write-Host ""
Write-Host "Install finished. Start with:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$Root\start.ps1`""
Write-Host ""
Write-Host "Do not run dsh from $Root. cwd .env plus DSH_* names used to crash boot."
Write-Host "start.ps1 sets DSH_HOME and launches from D:\dipcatcher when that folder exists."

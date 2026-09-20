#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DshHome = Join-Path $Root "dsh-home"
$ProfileDir = Join-Path $DshHome "profiles\web"
. (Join-Path $Root "windows-lib.ps1")

$env:PNPM_CONFIG_AUTO_INSTALL_PEERS = "true"
$env:NODE_OPTIONS = "--max-old-space-size=8192"

function Assert-Node {
  $node = Find-Node
  if (-not $node) {
    throw @"
Node.js is not on PATH.
Install Node 22.19+ or 24+ from https://nodejs.org (Windows x64 MSI),
then close and reopen PowerShell.
"@
  }
  $raw = (& $node -v).Trim().TrimStart("v")
  $parts = $raw.Split(".")
  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  $ok = (($major -eq 22) -and ($minor -ge 19)) -or ($major -ge 24)
  if (-not $ok) {
    throw "Node $raw is too old. DSH needs ^22.19.0 or >=24.0.0. You have $raw."
  }
  Write-Host "Node $raw at $node"
}

function Ensure-Pnpm {
  Refresh-SessionPath
  $pnpm = Find-Pnpm
  if ($pnpm) {
    Write-Host "pnpm at $pnpm"
    return $pnpm
  }
  Write-Host "Installing pnpm with npm..."
  Invoke-Native "npm" @("install", "-g", "pnpm")
  Refresh-SessionPath
  $pnpm = Find-Pnpm
  if (-not $pnpm) {
    throw "pnpm install finished but pnpm.cmd was not found."
  }
  return $pnpm
}

function Install-LocalDsh {
  param([string]$Pnpm)
  $pkg = Join-Path $Root "package.json"
  if (-not (Test-Path $pkg)) {
    throw "Missing $pkg ; clone is incomplete."
  }
  Write-Host "Installing @deepseek-ai/dsh locally into $Root ..."
  Push-Location $Root
  try {
    Invoke-Native $Pnpm @("install")
  } finally {
    Pop-Location
  }
  $bin = Get-DshBinJs -Root $Root
  if (-not (Test-Path $bin)) {
    throw "pnpm install finished but $bin is missing."
  }
  Write-Host "dsh entry: $bin"
}

function Install-WebProfile {
  param([string]$Pnpm)
  $pkg = Join-Path $ProfileDir "package.json"
  if (-not (Test-Path $pkg)) {
    throw "Missing $pkg ; clone is incomplete."
  }
  Write-Host "Installing web profile plugins into $ProfileDir ..."
  Push-Location $ProfileDir
  try {
    Invoke-Native $Pnpm @("install")
  } finally {
    Pop-Location
  }
}

Assert-Node
$pnpm = Ensure-Pnpm
Install-LocalDsh -Pnpm $pnpm
Install-WebProfile -Pnpm $pnpm

Write-Host ""
Write-Host "Install finished. Start with:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$Root\start.ps1`""
Write-Host "This install does not use a global dsh PATH shim."

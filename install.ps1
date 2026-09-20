#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DshHome = Join-Path $Root "dsh-home"
$ProfileDir = Join-Path $DshHome "profiles\web"
. (Join-Path $Root "windows-lib.ps1")

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

function Install-LocalDsh {
  param([string]$Pnpm)
  $pkg = Join-Path $Root "package.json"
  if (-not (Test-Path $pkg)) {
    throw "Missing $pkg ; clone is incomplete."
  }
  Write-Host "Installing @deepseek-ai/dsh locally into $Root ..."
  Remove-Tree (Join-Path $Root "node_modules")
  Remove-Tree (Join-Path $Root "pnpm-lock.yaml")
  Push-Location $Root
  try {
    $env:PNPM_CONFIG_AUTO_INSTALL_PEERS = "true"
    Invoke-Native $Pnpm @(
      "install",
      "--config.auto-install-peers=true",
      "--config.node-linker=hoisted",
      "--config.shamefully-hoist=true",
      "--config.strict-peer-dependencies=false"
    )
  } finally {
    Pop-Location
  }
  $bin = Get-DshBinJs -Root $Root
  if (-not (Test-Path $bin)) {
    throw "pnpm install finished but $bin is missing."
  }
  Assert-DshRuntime -Root $Root
  Write-Host "dsh entry: $bin"
}

function Install-WebProfile {
  param([string]$Pnpm)
  $pkg = Join-Path $ProfileDir "package.json"
  if (-not (Test-Path $pkg)) {
    throw "Missing $pkg ; clone is incomplete."
  }
  $marker = Join-Path $ProfileDir "node_modules"
  if (Test-Path $marker) {
    Write-Host "Web profile already installed at $ProfileDir, skipping."
    Write-Host "Delete that node_modules folder if you want a full plugin reinstall."
    return
  }
  Write-Host "Installing web profile plugins into $ProfileDir ..."
  Push-Location $ProfileDir
  try {
    $env:PNPM_CONFIG_AUTO_INSTALL_PEERS = "false"
    Invoke-Native $Pnpm @("install", "--config.auto-install-peers=false")
  } finally {
    Pop-Location
  }
}

Assert-Node
$pnpm = Install-BundledPnpm -Root $Root
Write-Host "pnpm at $pnpm"
Install-LocalDsh -Pnpm $pnpm
Install-WebProfile -Pnpm $pnpm

Write-Host ""
Write-Host "Install finished. Start with:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$Root\start.ps1`""
Write-Host "This install does not use npm's pnpm.ps1 or a global dsh PATH shim."

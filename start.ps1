#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

. (Join-Path $Root "launch-env.ps1")

Get-Content (Join-Path $Root ".env") | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_.Split("=", 2)
  if ($name -match '^(DSH_|XDG_|DYLD_|PATH|HOME)$') { return }
  if (-not (Test-Path "Env:$name")) {
    Set-Item -Path "Env:$name" -Value $value
  }
}

if (-not (Get-Command dsh -ErrorAction SilentlyContinue)) {
  throw "dsh is not on PATH. Run install.ps1 first, then reopen PowerShell."
}

$workspace = if (Test-Path "D:\dipcatcher") { "D:\dipcatcher" } else { (Get-Location).Path }
Set-Location $workspace
Write-Host "DSH_HOME=$env:DSH_HOME"
Write-Host "cwd=$workspace"
Write-Host "Starting dsh web on http://127.0.0.1:3080 ..."
dsh web --no-open @args

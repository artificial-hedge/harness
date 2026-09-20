#Requires -Version 5.1
# Shared Windows helpers. ASCII only so Windows PowerShell 5.1 can parse the file.

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [string[]]$Arguments = @()
  )
  Write-Host ("> $File " + ($Arguments -join " "))
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$File failed with exit code $LASTEXITCODE"
  }
}

function Refresh-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($user) { $parts += $user }
  if ($machine) { $parts += $machine }
  $env:Path = ($parts -join ";")
}

function Find-Node {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $guesses = @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
  )
  foreach ($g in $guesses) {
    if ($g -and (Test-Path $g)) { return $g }
  }
  return $null
}

function Find-Pnpm {
  $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $guesses = @(
    (Join-Path $env:APPDATA "npm\pnpm.cmd"),
    (Join-Path $env:LOCALAPPDATA "pnpm\pnpm.cmd"),
    (Join-Path $env:APPDATA "npm\pnpm.exe")
  )
  foreach ($g in $guesses) {
    if (Test-Path $g) { return $g }
  }
  return $null
}

function Get-DshBinJs {
  param([string]$Root)
  return (Join-Path $Root "node_modules\@deepseek-ai\dsh\lib\bin.js")
}

function Assert-DshInstalled {
  param([string]$Root)
  $bin = Get-DshBinJs -Root $Root
  if (-not (Test-Path $bin)) {
    throw "Missing $bin . Run install.ps1."
  }
  return $bin
}

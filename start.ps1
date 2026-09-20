#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Root "windows-lib.ps1")
. (Join-Path $Root "launch-env.ps1")

Get-Content (Join-Path $Root ".env") | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_.Split("=", 2)
  if ($name -match '^(DSH_|XDG_|DYLD_|PATH|HOME)$') { return }
  if (-not (Test-Path "Env:$name")) {
    Set-Item -Path "Env:$name" -Value $value
  }
}

$node = Find-Node
if (-not $node) { throw "node.exe not found. Install Node 22.19+ and rerun." }
$bin = Assert-DshInstalled -Root $Root

$workspace = if (Test-Path "D:\dipcatcher") { "D:\dipcatcher" } else { (Get-Location).Path }
Set-Location $workspace
Write-Host "DSH_HOME=$env:DSH_HOME"
Write-Host "cwd=$workspace"
Write-Host "node=$node"
Write-Host "dsh=$bin"
Write-Host "Starting dsh web on http://127.0.0.1:3080 ..."
& $node $bin web --no-open @args
if ($LASTEXITCODE -ne 0) {
  throw "dsh web failed with exit code $LASTEXITCODE"
}

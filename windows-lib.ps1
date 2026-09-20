#Requires -Version 5.1
# Shared Windows helpers. ASCII only so Windows PowerShell 5.1 can parse the file.

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [string[]]$Arguments = @()
  )
  if ($File -like "*.ps1") {
    $cmdFile = [System.IO.Path]::ChangeExtension($File, ".cmd")
    if (Test-Path $cmdFile) { $File = $cmdFile }
    else {
      throw "Refusing to run $File . Use a .cmd or .exe (npm's pnpm.ps1 is broken on Windows PowerShell 5.1)."
    }
  }
  Write-Host ("> $File " + ($Arguments -join " "))
  $stamp = Get-Random
  $outFile = Join-Path $env:TEMP ("ah-dsh-out-" + $stamp + ".txt")
  $errFile = Join-Path $env:TEMP ("ah-dsh-err-" + $stamp + ".txt")
  $cwd = (Get-Location).Path
  $start = @{
    FilePath = $File
    WorkingDirectory = $cwd
    Wait = $true
    PassThru = $true
    NoNewWindow = $true
    RedirectStandardOutput = $outFile
    RedirectStandardError = $errFile
  }
  if ($Arguments.Count -gt 0) { $start.ArgumentList = $Arguments }
  $proc = Start-Process @start
  $out = ""
  $err = ""
  if (Test-Path $outFile) { $out = Get-Content $outFile -Raw -ErrorAction SilentlyContinue }
  if (Test-Path $errFile) { $err = Get-Content $errFile -Raw -ErrorAction SilentlyContinue }
  if ($out) { Write-Host $out }
  if ($err) { Write-Host $err }
  Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
  if ($proc.ExitCode -ne 0) {
    throw ("{0} exit {1}`nSTDOUT:`n{2}`nSTDERR:`n{3}" -f $File, $proc.ExitCode, $out, $err)
  }
}

function Find-Node {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -notlike "*.ps1") { return $cmd.Source }
  $guesses = @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
  )
  foreach ($g in $guesses) {
    if ($g -and (Test-Path $g)) { return $g }
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

function Assert-DshRuntime {
  param([string]$Root)
  $nm = Join-Path $Root "node_modules\@deepseek-ai"
  $need = @(
    "dsh",
    "dsh-app-boot",
    "cordis-plugin-group",
    "dsh-web-app",
    "dsh-host-webserver",
    "dsh-host-frontend-static",
    "dsh-shell-env",
    "dsh-system-prompt",
    "dsh-llm"
  )
  $missing = @()
  foreach ($n in $need) {
    $pkg = Join-Path $nm (Join-Path $n "package.json")
    if (-not (Test-Path $pkg)) { $missing += $n }
  }
  if ($missing.Count -gt 0) {
    throw ("Missing runtime packages: {0}. Delete node_modules and rerun install.ps1." -f ($missing -join ", "))
  }
}

function Remove-Tree {
  param([string]$Path)
  if (Test-Path $Path) {
    Write-Host "Removing $Path"
    Remove-Item $Path -Recurse -Force
  }
}

function Install-BundledPnpm {
  param([string]$Root)
  $tools = Join-Path $Root "tools"
  if (-not (Test-Path $tools)) {
    New-Item -ItemType Directory -Path $tools | Out-Null
  }
  $pnpmExe = Join-Path $tools "pnpm.exe"
  if (Test-Path $pnpmExe) {
    $len = (Get-Item $pnpmExe).Length
    if ($len -gt 1000000) { return $pnpmExe }
    Remove-Item $pnpmExe -Force
  }
  $url = "https://github.com/pnpm/pnpm/releases/download/v10.17.1/pnpm-win-x64.exe"
  Write-Host "Downloading pnpm.exe from $url"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $ProgressPreference = "SilentlyContinue"
  try {
    (New-Object System.Net.WebClient).DownloadFile($url, $pnpmExe)
  } catch {
    throw "Failed to download pnpm.exe: $_"
  }
  $bytes = [System.IO.File]::ReadAllBytes($pnpmExe)
  if ($bytes.Length -lt 1000000 -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) {
    $head = Get-Content $pnpmExe -TotalCount 5 -ErrorAction SilentlyContinue
    throw "Downloaded pnpm.exe is not a Windows EXE (got $head). Check TLS/proxy."
  }
  Write-Host "pnpm.exe saved ($($bytes.Length) bytes)"
  return $pnpmExe
}

#Requires -Version 5.1
# Shared Windows helpers. ASCII only so Windows PowerShell 5.1 can parse the file.

function Refresh-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $pnpmHome = [Environment]::GetEnvironmentVariable("PNPM_HOME", "User")
  if (-not $pnpmHome) { $pnpmHome = $env:PNPM_HOME }
  if ($pnpmHome) {
    $env:PNPM_HOME = $pnpmHome
  }
  $parts = @()
  if ($pnpmHome) { $parts += $pnpmHome }
  if ($user) { $parts += $user }
  if ($machine) { $parts += $machine }
  $env:Path = ($parts -join ";")
}

function Get-PnpmGlobalBinDirs {
  $dirs = New-Object System.Collections.Generic.List[string]
  $fromPnpm = $null
  try { $fromPnpm = (pnpm bin -g 2>$null | Select-Object -First 1) } catch {}
  if ($fromPnpm) { $dirs.Add($fromPnpm.Trim()) }
  if ($env:PNPM_HOME) { $dirs.Add($env:PNPM_HOME) }
  $localApp = [Environment]::GetFolderPath("LocalApplicationData")
  $roaming = [Environment]::GetFolderPath("ApplicationData")
  $dirs.Add((Join-Path $localApp "pnpm"))
  $dirs.Add((Join-Path $roaming "npm"))
  $dirs.Add((Join-Path $roaming "pnpm"))
  $uniq = New-Object System.Collections.Generic.List[string]
  foreach ($d in $dirs) {
    if ($d -and (Test-Path $d) -and -not $uniq.Contains($d)) { $uniq.Add($d) }
  }
  return $uniq
}

function Find-DshCommand {
  param([string]$Root)
  $names = @("dsh.cmd", "dsh.CMD", "dsh.exe", "dsh.ps1", "dsh")
  $hint = Join-Path $Root ".dsh-cmd"
  if (Test-Path $hint) {
    $saved = (Get-Content $hint -Raw).Trim()
    if ($saved -and (Test-Path $saved)) { return $saved }
  }
  $found = Get-Command dsh -ErrorAction SilentlyContinue
  if ($found) { return $found.Source }
  foreach ($dir in Get-PnpmGlobalBinDirs) {
    $env:Path = "$dir;$env:Path"
    foreach ($name in $names) {
      $candidate = Join-Path $dir $name
      if (Test-Path $candidate) { return $candidate }
    }
  }
  return $null
}

function Save-DshCommand {
  param([string]$Root, [string]$Path)
  Set-Content -Path (Join-Path $Root ".dsh-cmd") -Value $Path -Encoding ASCII
}

function Ensure-PnpmHomeOnPath {
  Refresh-SessionPath
  $localApp = [Environment]::GetFolderPath("LocalApplicationData")
  $defaultHome = Join-Path $localApp "pnpm"
  if (-not $env:PNPM_HOME) {
    $env:PNPM_HOME = $defaultHome
  }
  if (-not (Test-Path $env:PNPM_HOME)) {
    New-Item -ItemType Directory -Path $env:PNPM_HOME -Force | Out-Null
  }
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not $userPath) { $userPath = "" }
  if ($userPath -notlike "*$($env:PNPM_HOME)*") {
    [Environment]::SetEnvironmentVariable("PNPM_HOME", $env:PNPM_HOME, "User")
    [Environment]::SetEnvironmentVariable("Path", "$($env:PNPM_HOME);$userPath", "User")
  }
  Refresh-SessionPath
}

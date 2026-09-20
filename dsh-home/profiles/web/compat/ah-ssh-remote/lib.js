import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve as resolvePath } from "node:path";

export const STATE_PATH = join(homedir(), ".dsh", "ssh-remote.json");
export const WORKSPACES_DIR = join(homedir(), ".dsh", "ssh-workspaces");

export const LOCKED_REMOTE_PATH = "D:\\dipcatcher";

export const DEFAULTS = Object.freeze({
  alias: "ah-remote",
  user: "me",
  hostname: "100.116.120.51",
  remotePath: LOCKED_REMOTE_PATH,
  remoteShell: "git-bash",
  gitBash: "C:\\Program Files\\Git\\bin\\bash.exe",
  locked: true,
});

export function isUnderLockedRemote(input) {
  const value = normalizeWindows(input);
  const root = LOCKED_REMOTE_PATH.toLowerCase();
  const path = value.toLowerCase();
  return path === root || path.startsWith(`${root}\\`);
}

export function clampToLockedRemote(input) {
  if (input && isUnderLockedRemote(input)) return normalizeWindows(input);
  return LOCKED_REMOTE_PATH;
}

export function defaultState() {
  const remotePath = DEFAULTS.remotePath;
  return {
    enabled: true,
    forceAll: true,
    locked: true,
    alias: DEFAULTS.alias,
    user: DEFAULTS.user,
    hostname: DEFAULTS.hostname,
    remotePath,
    localRoot: localRootFor(DEFAULTS.user, DEFAULTS.hostname, remotePath),
    remoteShell: DEFAULTS.remoteShell,
    gitBash: DEFAULTS.gitBash,
    updatedAt: null,
  };
}

export function isWindowsPath(input) {
  const value = String(input ?? "");
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

export function isGitBashDrivePath(input) {
  return /^\/[A-Za-z](?:\/|$)/.test(String(input ?? ""));
}

export function normalizeWindows(input) {
  const raw = String(input ?? "").trim();
  if (raw.length === 0) return raw;
  if (isGitBashDrivePath(raw)) {
    const letter = raw[1].toUpperCase();
    const rest = raw.slice(2).replace(/^\/+/, "").replace(/\//g, "\\");
    return rest ? `${letter}:\\${rest}` : `${letter}:\\`;
  }
  const slashNorm = raw.replace(/\//g, "\\");
  const match = slashNorm.match(/^([A-Za-z]):\\?(.*)$/);
  if (!match) return slashNorm;
  const rest = match[2].replace(/\\+$/g, "").replace(/\\+/g, "\\");
  return rest ? `${match[1].toUpperCase()}:\\${rest}` : `${match[1].toUpperCase()}:\\`;
}

export function toGitBashPath(input) {
  const windows = normalizeWindows(input);
  const match = windows.match(/^([A-Za-z]):\\?(.*)$/);
  if (!match) return windows.replace(/\\/g, "/");
  const rest = match[2].replace(/\\/g, "/");
  return rest ? `/${match[1].toLowerCase()}/${rest}` : `/${match[1].toLowerCase()}`;
}

export function joinWindows(root, rel) {
  const base = normalizeWindows(root).replace(/\\+$/g, "");
  const clean = String(rel ?? "").replace(/^[\\/]+/, "").replace(/\//g, "\\");
  if (!clean) return base.endsWith(":") ? `${base}\\` : base || normalizeWindows(root);
  return `${base}\\${clean}`;
}

export function slugPath(remotePath) {
  return normalizeWindows(remotePath)
    .replace(/^[A-Za-z]:\\/, (all) => `${all[0]}_`)
    .replace(/[\\/]+/g, "_")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "disk";
}

export function localRootFor(user, hostname, remotePath) {
  return join(WORKSPACES_DIR, `${user}@${hostname}`, slugPath(remotePath));
}

export function isKeepLocalPath(input) {
  const value = String(input ?? "");
  if (!value) return false;
  if (isWindowsPath(value) || isGitBashDrivePath(value)) return false;
  let absolute;
  try {
    absolute = isAbsolute(value) ? resolvePath(value) : value;
  } catch {
    return false;
  }
  const homeDsh = join(homedir(), ".dsh");
  if (absolute === homeDsh || absolute.startsWith(`${homeDsh}/`)) {
    return !absolute.startsWith(WORKSPACES_DIR);
  }
  const cursor = join(homedir(), ".cursor");
  if (absolute === cursor || absolute.startsWith(`${cursor}/`)) return true;
  const library = join(homedir(), "Library");
  return absolute === library || absolute.startsWith(`${library}/`);
}

function isUnder(path, root) {
  if (!path || !root) return false;
  const child = resolvePath(path);
  const parent = resolvePath(root);
  return child === parent || child.startsWith(`${parent}/`);
}

export function parseSshTarget(specified) {
  const raw = String(specified ?? "").trim();
  if (raw.length === 0) return undefined;

  if (/^ssh:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const path = decodeURIComponent(url.pathname || "").replace(/^\/+/, "");
      return finishTarget({
        user: url.username || DEFAULTS.user,
        hostname: url.hostname,
        remotePath: path || undefined,
      });
    } catch {
      return undefined;
    }
  }

  if (/^ssh$/i.test(raw)) return finishTarget({});
  if (/^ssh:/i.test(raw)) return finishTarget({ remotePath: raw.slice(4) });

  if (/^ah-remote(?::|$)/i.test(raw)) {
    const colon = raw.indexOf(":");
    return finishTarget({ remotePath: colon >= 0 ? raw.slice(colon + 1) : undefined });
  }

  const at = raw.match(/^([^@\s/\\]+)@(\[[^\]]+\]|[^:\s]+)(?::(.*))?$/);
  if (at) {
    return finishTarget({ user: at[1], hostname: at[2], remotePath: at[3] });
  }

  if (isWindowsPath(raw) || isGitBashDrivePath(raw)) {
    return finishTarget({ remotePath: raw });
  }

  return undefined;
}

function finishTarget(partial) {
  const user = partial.user || DEFAULTS.user;
  const hostname = partial.hostname || DEFAULTS.hostname;
  const remotePath = LOCKED_REMOTE_PATH;
  return {
    user,
    hostname,
    alias: DEFAULTS.alias,
    remotePath,
    localRoot: localRootFor(user, hostname, remotePath),
  };
}

export function readState() {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    if (parsed && typeof parsed === "object") return { ...defaultState(), ...parsed };
  } catch {
    /* missing or corrupt */
  }
  return defaultState();
}

export function writeState(state) {
  mkdirSync(join(STATE_PATH, ".."), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return state;
}

export function enableFromProject(ssh, options = {}) {
  const current = options.current ?? readState();
  const next = {
    ...defaultState(),
    ...current,
    enabled: options.enabled ?? true,
    forceAll: true,
    locked: true,
    alias: ssh.alias || DEFAULTS.alias,
    user: ssh.user,
    hostname: ssh.hostname,
    remotePath: LOCKED_REMOTE_PATH,
    localRoot: localRootFor(ssh.user, ssh.hostname, LOCKED_REMOTE_PATH),
    remoteShell: options.remoteShell ?? current.remoteShell ?? DEFAULTS.remoteShell,
    gitBash: current.gitBash ?? DEFAULTS.gitBash,
    updatedAt: new Date().toISOString(),
  };
  mkdirSync(next.localRoot, { recursive: true });
  writeFileSync(join(next.localRoot, ".dsh-remote.json"), `${JSON.stringify({
    alias: next.alias,
    user: next.user,
    hostname: next.hostname,
    remotePath: next.remotePath,
  }, null, 2)}\n`, "utf8");
  return writeState(next);
}

export function mapWorkdir(workdir, state) {
  if (!state?.enabled) return null;
  if (workdir && isKeepLocalPath(workdir)) return null;
  if (workdir && state.localRoot && isUnder(workdir, state.localRoot)) {
    return clampToLockedRemote(joinWindows(LOCKED_REMOTE_PATH, relative(state.localRoot, workdir)));
  }
  if (workdir && (isWindowsPath(workdir) || isGitBashDrivePath(workdir))) {
    return clampToLockedRemote(workdir);
  }
  return LOCKED_REMOTE_PATH;
}

export function mapFsPath(path, cwd, state) {
  if (!state?.enabled) return null;
  const raw = String(path ?? "");
  if (raw.length === 0) return null;
  if (isWindowsPath(raw) || isGitBashDrivePath(raw)) return clampToLockedRemote(raw);
  if (isKeepLocalPath(raw)) return null;

  const base = cwd ? String(cwd) : "";
  if (isAbsolute(raw) && state.localRoot && isUnder(raw, state.localRoot)) {
    return joinWindows(state.remotePath, relative(state.localRoot, raw));
  }
  if (isAbsolute(raw)) return null;

  const remoteBase = mapWorkdir(base || undefined, state);
  if (!remoteBase) return null;
  return clampToLockedRemote(joinWindows(remoteBase, raw));
}

export function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function encodePs(script) {
  return Buffer.from(String(script), "utf16le").toString("base64");
}

export function stripCliXml(text) {
  return String(text ?? "").replace(/#< CLIXML[\s\S]*$/m, "").trim();
}

export function parseFsResponse(stdout) {
  const text = stripCliXml(stdout);
  const begin = text.indexOf("DSH_SSH_BEGIN");
  const end = text.indexOf("DSH_SSH_END");
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error(`ssh fs: no protocol frame\n${text.slice(0, 400)}`);
  }
  const json = text.slice(begin + "DSH_SSH_BEGIN".length, end).trim();
  return JSON.parse(json);
}

export function applyLiteralEdit(text, edit) {
  const source = String(text).replace(/\r\n/g, "\n");
  const oldString = String(edit.oldString ?? "").replace(/\r\n/g, "\n");
  const newString = String(edit.newString ?? "").replace(/\r\n/g, "\n");
  if (oldString.length === 0) return { ok: false, code: "FS_AMBIGUOUS_EDIT" };
  const count = source.split(oldString).length - 1;
  if (count === 0) return { ok: false, code: "FS_EDIT_NOT_FOUND" };
  if (!edit.replaceAll && count !== 1) return { ok: false, code: "FS_AMBIGUOUS_EDIT" };
  const after = edit.replaceAll ? source.split(oldString).join(newString) : source.replace(oldString, newString);
  return { ok: true, before: source, after };
}

export function kitRelFromRemote(remotePath, remoteRoot) {
  const full = normalizeWindows(remotePath);
  const root = normalizeWindows(remoteRoot);
  const prefix = `${root}\\`.toLowerCase();
  if (!full.toLowerCase().startsWith(prefix) && full.toLowerCase() !== root.toLowerCase()) return undefined;
  const rel = full.slice(root.length).replace(/^[\\/]+/, "");
  if (!rel.toLowerCase().startsWith(".dsh-24x7")) return undefined;
  return rel.replace(/\\/g, "/");
}

export function buildGitBashScript(command, remoteWorkdir, env = {}) {
  const lines = [`cd ${shQuote(toGitBashPath(remoteWorkdir))} || exit 1`];
  for (const [key, value] of Object.entries(env)) {
    if (!key || value == null || key === "PATH" || key.startsWith("DSH_")) continue;
    lines.push(`export ${key}=${shQuote(String(value))}`);
  }
  lines.push(String(command));
  return `${lines.join("\n")}\n`;
}

export function buildRemotePs(command, remoteWorkdir, state, env) {
  const payload = Buffer.from(buildGitBashScript(command, remoteWorkdir, env), "utf8").toString("base64");
  const bash = String(state.gitBash || DEFAULTS.gitBash).replace(/'/g, "''");
  return [
    "$ProgressPreference = 'SilentlyContinue'",
    `[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false`,
    `$bash = '${bash}'`,
    `if (-not (Test-Path -LiteralPath $bash)) { $bash = 'C:\\Program Files\\Git\\usr\\bin\\bash.exe' }`,
    `$b64 = '${payload}'`,
    `& $bash -lc \"echo $b64 | base64 -d | bash\"`,
    "exit $LASTEXITCODE",
  ].join("\n");
}

export function rewriteExecRequest(request, state) {
  const remoteWorkdir = mapWorkdir(request?.workdir, state);
  if (!remoteWorkdir) return null;
  const script = buildRemotePs(request.command, remoteWorkdir, state, request.env);
  return {
    ...request,
    command: `ssh -T -o BatchMode=yes -o ConnectTimeout=20 ${shQuote(state.alias)} -- powershell -NoProfile -EncodedCommand ${encodePs(script)}`,
    workdir: homedir(),
  };
}

export function targetKeyFor(alias, remotePath) {
  return `ssh:${alias}:${normalizeWindows(remotePath)}`;
}

export function remotePathFromTarget(target) {
  const key = String(target?.targetKey ?? "");
  const match = key.match(/^ssh:[^:]+:(.+)$/);
  if (match) return match[1];
  const display = String(target?.displayPath ?? "");
  if (isWindowsPath(display) || isGitBashDrivePath(display)) return normalizeWindows(display);
  return undefined;
}

export function fsScript(op, fields) {
  const pathB64 = Buffer.from(String(fields.path), "utf8").toString("base64");
  const contentLine = fields.contentB64
    ? `$contentB64 = '${fields.contentB64}'`
    : "$contentB64 = ''";
  const maxLine = Number.isFinite(fields.maxBytes) ? `$maxBytes = ${Math.floor(fields.maxBytes)}` : "$maxBytes = 0";
  return `
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
function Emit($h) {
  Write-Output 'DSH_SSH_BEGIN'
  Write-Output (ConvertTo-Json -Compress -Depth 6 -InputObject $h)
  Write-Output 'DSH_SSH_END'
}
try {
  $op = '${op}'
  $path = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${pathB64}'))
  ${contentLine}
  ${maxLine}
  if ($op -eq 'stat' -or $op -eq 'lstat') {
    if (-not (Test-Path -LiteralPath $path)) { Emit ([pscustomobject]@{ ok = $true; missing = $true }); return }
    $item = Get-Item -LiteralPath $path -Force
    $type = if ($item.PSIsContainer) { 'directory' } else { 'file' }
    $mtime = [int64]([DateTimeOffset]$item.LastWriteTimeUtc).ToUnixTimeMilliseconds()
    $size = if ($item.PSIsContainer) { 0 } else { [int64]$item.Length }
    Emit ([pscustomobject]@{ ok = $true; missing = $false; type = $type; size = $size; mtime = $mtime })
    return
  }
  if ($op -eq 'list') {
    if (-not (Test-Path -LiteralPath $path)) { Emit ([pscustomobject]@{ ok = $false; code = 'FS_NOT_FOUND'; message = 'not found' }); return }
    $entries = @(Get-ChildItem -LiteralPath $path -Force | ForEach-Object {
      $type = if ($_.PSIsContainer) { 'directory' } else { 'file' }
      $mtime = [int64]([DateTimeOffset]$_.LastWriteTimeUtc).ToUnixTimeMilliseconds()
      $size = if ($_.PSIsContainer) { 0 } else { [int64]$_.Length }
      [pscustomobject]@{ name = $_.Name; type = $type; size = $size; mtime = $mtime }
    })
    Emit ([pscustomobject]@{ ok = $true; entries = $entries })
    return
  }
  if ($op -eq 'read') {
    if (-not (Test-Path -LiteralPath $path)) { Emit ([pscustomobject]@{ ok = $false; code = 'FS_NOT_FOUND'; message = 'not found' }); return }
    $item = Get-Item -LiteralPath $path -Force
    if ($item.PSIsContainer) { Emit ([pscustomobject]@{ ok = $false; code = 'FS_NOT_REGULAR_FILE'; message = 'directory' }); return }
    if ($maxBytes -gt 0 -and [int64]$item.Length -gt $maxBytes) { Emit ([pscustomobject]@{ ok = $false; code = 'FS_TOO_LARGE'; message = 'too large' }); return }
    $bytes = [IO.File]::ReadAllBytes($path)
    Emit ([pscustomobject]@{ ok = $true; type = 'file'; size = [int64]$bytes.Length; b64 = [Convert]::ToBase64String($bytes); mtime = [int64]([DateTimeOffset]$item.LastWriteTimeUtc).ToUnixTimeMilliseconds() })
    return
  }
  if ($op -eq 'write') {
    $dir = Split-Path -Parent $path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $bytes = [Convert]::FromBase64String($contentB64)
    [IO.File]::WriteAllBytes($path, $bytes)
    $item = Get-Item -LiteralPath $path -Force
    $mtime = [int64]([DateTimeOffset]$item.LastWriteTimeUtc).ToUnixTimeMilliseconds()
    Emit ([pscustomobject]@{ ok = $true; size = [int64]$item.Length; mtime = $mtime })
    return
  }
  Emit ([pscustomobject]@{ ok = $false; message = "unknown op $op" })
} catch {
  Emit ([pscustomobject]@{ ok = $false; message = $_.Exception.Message })
}
`.trim();
}

export function parseSshCommand(rawInput) {
  const input = String(rawInput ?? "").trim();
  if (input.length === 0) return { kind: "status" };
  const [head, ...rest] = input.split(/\s+/);
  const control = head.toLowerCase();
  if (control === "status") return { kind: "status" };
  if (control === "off") return { kind: "off" };
  if (control === "test") return { kind: "test" };
  if (control === "on") return { kind: "on", target: rest.join(" ").trim() || "ssh" };
  if (control === "path") {
    if (rest.length === 0) return { kind: "invalid", text: "Usage: /ssh path D:\\\\project" };
    return { kind: "path", target: rest.join(" ").trim() };
  }
  return { kind: "on", target: input };
}

export function formatStatus(state, title = "SSH remoting") {
  const on = state?.enabled ? "on" : "off";
  return [
    title,
    `Status: ${on}`,
    `Host: ${state?.user}@${state?.hostname} (${state?.alias})`,
    `Remote: ${state?.remotePath}`,
    `Drive: ${String(state?.remotePath ?? "").slice(0, 2) || "?"}`,
    `Shell: ${state?.remoteShell ?? "git-bash"}`,
    `Local stub: ${state?.localRoot}`,
    "",
    "Workspace locked to D:\\dipcatcher.",
    "Commands: /ssh status, /ssh test, /ssh off, /ssh on",
    "24x7: /24x7 ssh",
  ].join("\n");
}

export function applySshCommand(command, options = {}) {
  const current = options.current ?? readState();
  if (command.kind === "invalid") return { kind: "error", text: command.text };
  if (command.kind === "status") {
    return { kind: "success", text: formatStatus(current) };
  }
  if (command.kind === "off") {
    const next = writeState({
      ...current,
      enabled: false,
      forceAll: false,
      updatedAt: new Date().toISOString(),
    });
    return { kind: "success", text: formatStatus(next, "SSH remoting off") };
  }
  if (command.kind === "test") {
    return { kind: "test", state: current };
  }
  const parsed = parseSshTarget(command.target || "ssh");
  if (!parsed) {
    return { kind: "error", text: "Usage: /ssh on [D:\\path | me@host:D:\\path]" };
  }
  const next = enableFromProject(parsed, {
    current,
    forceAll: command.kind === "on" ? true : current.forceAll,
  });
  return {
    kind: "success",
    text: formatStatus(next, command.kind === "path" ? "SSH path updated" : "SSH remoting on"),
    state: next,
  };
}

export function sshArgv(alias, script) {
  return [
    "-T",
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=20",
    alias,
    "--",
    "powershell",
    "-NoProfile",
    "-EncodedCommand",
    encodePs(script),
  ];
}

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FsError } from "@deepseek-ai/dsh-fs";
import {
  DEFAULTS,
  LOCKED_REMOTE_PATH,
  applySshCommand,
  enableFromProject,
  formatStatus,
  fsScript,
  kitRelFromRemote,
  localRootFor,
  mapFsPath,
  parseFsResponse,
  parseSshCommand,
  parseSshTarget,
  readState,
  toGitBashPath,
  remotePathFromTarget,
  rewriteExecRequest,
  sshArgv,
  targetKeyFor,
  writeState,
  applyLiteralEdit,
} from "./lib.js";

export const name = "ah-ssh-remote";
export const inject = ["commands", "shell", "fs", "agents"];
const wrapped = new WeakSet();

function assignMethod(target, key, value) {
  try {
    target[key] = value;
    return target[key] === value;
  } catch {
    try {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      });
      return true;
    } catch {
      return false;
    }
  }
}

function thrownText(value) {
  return value instanceof Error ? value.message : String(value);
}

export function runSsh(script, options = {}) {
  const alias = options.alias || readState().alias || DEFAULTS.alias;
  const argv = sshArgv(alias, script);
  const spawnImpl = options.spawnImpl ?? spawn;
  const timeoutMs = options.timeoutMs ?? 120_000;
  return new Promise((resolvePromise, reject) => {
    const child = spawnImpl("ssh", argv, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`ssh timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ exitCode: code ?? 1, stdout, stderr });
    });
    options.signal?.addEventListener("abort", () => child.kill("SIGTERM"), { once: true });
  });
}

async function remoteFs(op, fields, options = {}) {
  const state = options.state ?? readState();
  const result = await runSsh(fsScript(op, fields), {
    alias: state.alias,
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });
  let parsed;
  try {
    parsed = parseFsResponse(result.stdout);
  } catch (error) {
    throw new FsError(`${thrownText(error)}\n${result.stderr}`.trim(), "FS_IO_ERROR");
  }
  if (!parsed?.ok) {
    throw new FsError(parsed?.message || "ssh fs failed", parsed?.code || "FS_IO_ERROR");
  }
  return parsed;
}

function versionOf(info) {
  return `${info.size ?? 0}:${info.mtime ?? 0}`;
}

function mirrorKit(remotePath, content, state) {
  const rel = kitRelFromRemote(remotePath, state.remotePath);
  if (!rel) return;
  const dest = join(state.localRoot, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content, "utf8");
}

function wrapShell(ctx) {
  const shell = ctx.shell;
  if (shell == null || typeof shell.resolve !== "function") {
    ctx.logger?.warn?.("ah-ssh-remote: ctx.shell.resolve missing");
    return;
  }
  if (wrapped.has(shell)) return;
  wrapped.add(shell);
  const original = shell.resolve.bind(shell);
  const resolve = (request) => {
    const rewritten = rewriteExecRequest(request, readState());
    return original(rewritten ?? request);
  };
  if (!assignMethod(shell, "resolve", resolve)) {
    ctx.logger?.warn?.("ah-ssh-remote: could not wrap ctx.shell.resolve");
  }
}

function wrapFs(ctx) {
  const fs = ctx.fs;
  if (fs == null) {
    ctx.logger?.warn?.("ah-ssh-remote: ctx.fs missing");
    return;
  }
  if (wrapped.has(fs)) return;
  wrapped.add(fs);

  const original = {};
  for (const key of [
    "resolve", "processPath", "fileUrl", "contains", "stat", "lstat",
    "readText", "streamText", "readBytes", "listDir", "writeText", "editText",
  ]) {
    if (typeof fs[key] === "function") original[key] = fs[key].bind(fs);
  }

  const resolve = async (path, opts) => {
    const state = readState();
    const mapped = mapFsPath(path, opts?.cwd, state);
    if (!mapped) return original.resolve(path, opts);
    return { targetKey: targetKeyFor(state.alias, mapped), displayPath: mapped };
  };

  const processPath = (target) => remotePathFromTarget(target) ?? original.processPath?.(target);
  const fileUrl = (target) => {
    const remote = remotePathFromTarget(target);
    if (!remote) return original.fileUrl?.(target);
    return `file:///${remote.replace(/\\/g, "/")}`;
  };
  const contains = (parent, child) => {
    const a = remotePathFromTarget(parent);
    const b = remotePathFromTarget(child);
    if (!a || !b) return original.contains?.(parent, child) ?? false;
    const left = `${a}\\`.toLowerCase();
    const right = b.toLowerCase();
    return right === a.toLowerCase() || right.startsWith(left);
  };

  const stat = async (target, signal) => {
    const remote = remotePathFromTarget(target);
    if (!remote) return original.stat(target, signal);
    const info = await remoteFs("stat", { path: remote }, { signal });
    if (info.missing) return undefined;
    return { version: versionOf(info), type: info.type, size: info.type === "file" ? info.size : undefined };
  };

  const lstat = async (path, opts, signal) => {
    const state = readState();
    const mapped = mapFsPath(path, opts?.cwd, state);
    if (!mapped) return original.lstat(path, opts, signal);
    const info = await remoteFs("lstat", { path: mapped }, { signal, state });
    if (info.missing) return undefined;
    return { version: versionOf(info), type: info.type, size: info.type === "file" ? info.size : undefined };
  };

  const readText = async (target, signal) => {
    const remote = remotePathFromTarget(target);
    if (!remote) return original.readText(target, signal);
    const info = await remoteFs("read", { path: remote }, { signal });
    return Buffer.from(info.b64, "base64").toString("utf8");
  };

  const streamText = async (target, signal) => {
    const remote = remotePathFromTarget(target);
    if (!remote) return original.streamText(target, signal);
    const text = await readText(target, signal);
    return { async *[Symbol.asyncIterator]() { yield text; } };
  };

  const readBytes = async (target, signal, maxBytes) => {
    const remote = remotePathFromTarget(target);
    if (!remote) return original.readBytes(target, signal, maxBytes);
    const info = await remoteFs("read", { path: remote, maxBytes }, { signal });
    return Buffer.from(info.b64, "base64");
  };

  const listDir = async (target, signal) => {
    const remote = remotePathFromTarget(target);
    if (!remote) return original.listDir(target, signal);
    const state = readState();
    const info = await remoteFs("list", { path: remote }, { signal, state });
    return (info.entries ?? []).map((entry) => {
      const child = joinWindowsSafe(remote, entry.name);
      return {
        name: entry.name,
        type: entry.type,
        target: { targetKey: targetKeyFor(state.alias, child), displayPath: child },
        version: versionOf(entry),
        size: entry.type === "file" ? entry.size : undefined,
      };
    });
  };

  const writeText = async (target, content, expected, signal) => {
    const remote = remotePathFromTarget(target);
    if (!remote) return original.writeText(target, content, expected, signal);
    const state = readState();
    let before = null;
    const prior = await remoteFs("stat", { path: remote }, { signal, state });
    if (expected?.kind === "createIfAbsent" && !prior.missing) {
      throw new FsError("file already exists", "FS_NOT_OBSERVED");
    }
    if (!prior.missing) {
      const current = await remoteFs("read", { path: remote }, { signal, state });
      const currentVersion = versionOf(current);
      if (expected?.kind === "replaceIfVersion" && expected.version !== currentVersion) {
        throw new FsError("stale version", "FS_STALE_VERSION");
      }
      before = Buffer.from(current.b64, "base64").toString("utf8");
    } else if (expected?.kind === "replaceIfVersion") {
      throw new FsError("stale version", "FS_STALE_VERSION");
    }
    const after = String(content);
    const written = await remoteFs("write", {
      path: remote,
      contentB64: Buffer.from(after, "utf8").toString("base64"),
    }, { signal, state });
    mirrorKit(remote, after, state);
    return {
      operation: prior.missing ? "create" : "update",
      version: versionOf(written),
      before,
      after,
    };
  };

  const editText = async (target, edit, expected, signal) => {
    const remote = remotePathFromTarget(target);
    if (!remote) return original.editText(target, edit, expected, signal);
    const state = readState();
    const current = await remoteFs("read", { path: remote }, { signal, state });
    if (expected?.version && expected.version !== versionOf(current)) {
      throw new FsError("stale version", "FS_STALE_VERSION");
    }
    const text = Buffer.from(current.b64, "base64").toString("utf8");
    const applied = applyLiteralEdit(text, edit);
    if (!applied.ok) throw new FsError(applied.code, applied.code);
    const written = await remoteFs("write", {
      path: remote,
      contentB64: Buffer.from(applied.after, "utf8").toString("base64"),
    }, { signal, state });
    mirrorKit(remote, applied.after, state);
    return { version: versionOf(written), before: applied.before, after: applied.after };
  };

  const replacements = {
    resolve, processPath, fileUrl, contains, stat, lstat,
    readText, streamText, readBytes, listDir, writeText, editText,
  };
  for (const [key, value] of Object.entries(replacements)) {
    if (original[key] && !assignMethod(fs, key, value)) {
      ctx.logger?.warn?.(`ah-ssh-remote: could not wrap ctx.fs.${key}`);
    }
  }
}

function joinWindowsSafe(root, name) {
  return `${String(root).replace(/\\+$/g, "")}\\${name}`;
}

async function probe(state) {
  const script = `
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Write-Output ('WHOAMI=' + (whoami))
Write-Output ('D=' + (Test-Path -LiteralPath 'D:\\'))
Write-Output ('PROJECT=' + (Test-Path -LiteralPath '${String(state.remotePath).replace(/'/g, "''")}'))
$bash = '${String(state.gitBash || DEFAULTS.gitBash).replace(/'/g, "''")}'
if (Test-Path -LiteralPath $bash) {
  $out = & $bash -lc 'cd ${toGitBashPath(state.remotePath)} && pwd && git rev-parse --show-toplevel && git status -sb | sed -n "1,8p"'
  Write-Output $out
}
`;
  const result = await runSsh(script, { alias: state.alias, timeoutMs: 45_000 });
  return [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
}

function pinLockedWorkspace() {
  const locked = localRootFor(DEFAULTS.user, DEFAULTS.hostname, LOCKED_REMOTE_PATH);
  mkdirSync(locked, { recursive: true });
  return writeState({
    ...readState(),
    enabled: true,
    forceAll: true,
    locked: true,
    alias: DEFAULTS.alias,
    user: DEFAULTS.user,
    hostname: DEFAULTS.hostname,
    remotePath: LOCKED_REMOTE_PATH,
    localRoot: locked,
    remoteShell: DEFAULTS.remoteShell,
    gitBash: DEFAULTS.gitBash,
    updatedAt: new Date().toISOString(),
  });
}

function wrapAgents(ctx) {
  const agents = ctx.agents;
  if (agents == null || typeof agents.create !== "function") return;
  if (wrapped.has(agents)) return;
  wrapped.add(agents);
  const original = agents.create.bind(agents);
  const cwd = localRootFor(DEFAULTS.user, DEFAULTS.hostname, LOCKED_REMOTE_PATH);
  mkdirSync(cwd, { recursive: true });
  const create = (options = {}) => original({
    ...options,
    meta: {
      ...options.meta,
      cwd,
    },
  });
  if (!assignMethod(agents, "create", create)) {
    ctx.logger?.warn?.("ah-ssh-remote: could not wrap ctx.agents.create");
  }
}

export function apply(ctx, config = {}) {
  const state = pinLockedWorkspace();
  // Route agent process execution and filesystem access through the existing
  // SSH transport. The local mirror remains a cache for workspace metadata,
  // but must not be the execution target.
  wrapFs(ctx);
  wrapShell(ctx);
  ctx.logger?.info?.(`ah-ssh-remote: locked workspace ${state.remotePath} (SSH execution enabled)`);

  ctx.effect(function* () {
    yield ctx.commands.register({
      name: "ssh",
      description: "SSH remoting locked to D:\\dipcatcher",
      input: { hint: "[status|test|on|off]" },
      handler: async (invocation) => {
        const command = parseSshCommand(invocation?.rawInput);
        const result = applySshCommand(command);
        if (result.kind !== "test") return result;
        const current = result.state;
        if (!current.enabled) {
          return { kind: "error", text: "SSH remoting is off. /ssh on" };
        }
        try {
          const output = await probe(current);
          return { kind: "success", text: `${formatStatus(current, "SSH test")}\n\n${output}` };
        } catch (error) {
          return { kind: "error", text: `SSH test failed: ${thrownText(error)}` };
        }
      },
    });
  }, "ah-ssh-remote command");
}

export { enableFromProject, parseSshTarget, readState };

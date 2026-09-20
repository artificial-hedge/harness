import test from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DEFAULTS,
  applyLiteralEdit,
  applySshCommand,
  buildGitBashScript,
  isGitBashDrivePath,
  isWindowsPath,
  joinWindows,
  kitRelFromRemote,
  localRootFor,
  mapFsPath,
  mapWorkdir,
  normalizeWindows,
  parseFsResponse,
  parseSshCommand,
  parseSshTarget,
  rewriteExecRequest,
  toGitBashPath,
} from "./lib.js";

test("D: drive paths normalize and map to Git Bash /d", () => {
  assert.equal(isWindowsPath("D:\\dipcatcher"), true);
  assert.equal(isWindowsPath("D:/dipcatcher/src"), true);
  assert.equal(isWindowsPath("/Users/vaithianathan/dipcatcher"), false);
  assert.equal(normalizeWindows("d:/dipcatcher/src"), "D:\\dipcatcher\\src");
  assert.equal(normalizeWindows("D:\\"), "D:\\");
  assert.equal(normalizeWindows("/d/dipcatcher"), "D:\\dipcatcher");
  assert.equal(toGitBashPath("D:\\dipcatcher\\src"), "/d/dipcatcher/src");
  assert.equal(toGitBashPath("C:\\Users\\me"), "/c/Users/me");
  assert.equal(joinWindows("D:\\dipcatcher", "src/lib"), "D:\\dipcatcher\\src\\lib");
});

test("Git Bash single-letter drives do not swallow /Users", () => {
  assert.equal(isGitBashDrivePath("/d/dipcatcher"), true);
  assert.equal(isGitBashDrivePath("/d"), true);
  assert.equal(isGitBashDrivePath("/Users/vaithianathan"), false);
  assert.equal(isGitBashDrivePath("/dev/null"), false);
});

test("parseSshTarget defaults to D:\\dipcatcher", () => {
  const bare = parseSshTarget("ssh");
  assert.equal(bare.remotePath, "D:\\dipcatcher");
  assert.equal(bare.user, "me");
  assert.equal(bare.hostname, "100.116.120.51");
  assert.equal(bare.localRoot, localRootFor("me", "100.116.120.51", "D:\\dipcatcher"));

  const drive = parseSshTarget("D:\\dipcatcher");
  assert.equal(drive.remotePath, "D:\\dipcatcher");

  const other = parseSshTarget("ssh:D:\\GLOC");
  assert.equal(other.remotePath, "D:\\dipcatcher");

  const at = parseSshTarget("me@100.116.120.51:D:\\dipcatcher");
  assert.equal(at.remotePath, "D:\\dipcatcher");
  assert.equal(at.user, "me");

  assert.equal(parseSshTarget("/Users/vaithianathan/dipcatcher"), undefined);
});

test("mapWorkdir sends D: and ssh stubs remote, keeps ~/.dsh local", () => {
  const localRoot = join(homedir(), ".dsh", "ssh-workspaces", "me@host", "D_dipcatcher");
  const state = {
    enabled: true,
    forceAll: false,
    remotePath: "D:\\dipcatcher",
    localRoot,
    alias: "ah-remote",
  };
  assert.equal(mapWorkdir("D:\\dipcatcher\\src", state), "D:\\dipcatcher\\src");
  assert.equal(mapWorkdir("/d/dipcatcher", state), "D:\\dipcatcher");
  assert.equal(mapWorkdir(join(localRoot, "src"), state), "D:\\dipcatcher\\src");
  assert.equal(mapWorkdir(join(homedir(), ".dsh", "profiles"), state), null);
  assert.equal(mapWorkdir("/Users/vaithianathan/dipcatcher", state), "D:\\dipcatcher");
  assert.equal(mapWorkdir("D:\\GLOC", state), "D:\\dipcatcher");
  assert.equal(mapWorkdir(undefined, { ...state, forceAll: true }), "D:\\dipcatcher");
});

test("mapFsPath maps relative files onto D: when remoting", () => {
  const localRoot = join(homedir(), ".dsh", "ssh-workspaces", "me@host", "D_dipcatcher");
  const state = {
    enabled: true,
    forceAll: true,
    remotePath: "D:\\dipcatcher",
    localRoot,
    alias: "ah-remote",
  };
  assert.equal(mapFsPath("README.md", localRoot, state), "D:\\dipcatcher\\README.md");
  assert.equal(mapFsPath("D:\\dipcatcher\\pyproject.toml", localRoot, state), "D:\\dipcatcher\\pyproject.toml");
  assert.equal(mapFsPath(join(homedir(), ".dsh", "settings.yaml"), localRoot, state), null);
});

test("rewriteExecRequest uses EncodedCommand so cmd.exe cannot eat Git Bash pipes", () => {
  const request = rewriteExecRequest({
    command: "pwd && ls",
    workdir: "D:\\dipcatcher",
  }, {
    enabled: true,
    alias: "ah-remote",
    remotePath: "D:\\dipcatcher",
    gitBash: DEFAULTS.gitBash,
  });
  assert.match(request.command, /ssh -T .*ah-remote/);
  assert.match(request.command, /EncodedCommand/);
  assert.equal(request.workdir, homedir());
  assert.equal(rewriteExecRequest({ command: "echo", workdir: join(homedir(), ".dsh") }, {
    enabled: true,
    remotePath: "D:\\dipcatcher",
    localRoot: join(homedir(), ".dsh", "ssh-workspaces", "x"),
  }), null);
});

test("buildGitBashScript cds to /d/dipcatcher", () => {
  const script = buildGitBashScript("pytest -q", "D:\\dipcatcher");
  assert.match(script, /cd '\/d\/dipcatcher'/);
  assert.match(script, /pytest -q/);
});

test("applyLiteralEdit and fs protocol parser", () => {
  const edited = applyLiteralEdit("alpha\r\nbeta\r\n", { oldString: "beta", newString: "gamma", replaceAll: false });
  assert.equal(edited.ok, true);
  assert.equal(edited.after, "alpha\ngamma\n");
  const parsed = parseFsResponse("junk\nDSH_SSH_BEGIN\n{\"ok\":true,\"missing\":false,\"type\":\"file\",\"size\":4}\nDSH_SSH_END\n#< CLIXML");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.size, 4);
  assert.equal(kitRelFromRemote("D:\\dipcatcher\\.dsh-24x7\\PROOF.md", "D:\\dipcatcher"), ".dsh-24x7/PROOF.md");
});

test("parseSshCommand and applySshCommand off/status", () => {
  assert.deepEqual(parseSshCommand(""), { kind: "status" });
  assert.deepEqual(parseSshCommand("on D:\\GLOC"), { kind: "on", target: "D:\\GLOC" });
  assert.deepEqual(parseSshCommand("path D:\\dipcatcher"), { kind: "path", target: "D:\\dipcatcher" });
  const off = applySshCommand({ kind: "off" }, {
    current: { ...parseSshTarget("ssh"), enabled: true, forceAll: true, remoteShell: "git-bash" },
  });
  assert.equal(off.kind, "success");
  assert.match(off.text, /off/i);
});

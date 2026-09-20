import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKickoffPrompt,
  buildObjective,
  hasHonestProof,
  isMixedProviderError,
  parseCommand,
  resolveProject,
  rewriteTwentyFourLine,
} from "./lib.js";

test("parseCommand treats a path as start", () => {
  assert.deepEqual(parseCommand("lightspeed extra notes"), {
    kind: "start",
    project: "lightspeed",
    notes: "extra notes",
  });
  assert.deepEqual(parseCommand("start ~/code/app keep going"), {
    kind: "start",
    project: "~/code/app",
    notes: "keep going",
  });
  assert.deepEqual(parseCommand("status"), { kind: "status" });
  assert.deepEqual(parseCommand("pause"), { kind: "pause" });
  assert.deepEqual(parseCommand("stop"), { kind: "stop" });
  assert.deepEqual(parseCommand("clear"), { kind: "stop" });
  assert.deepEqual(parseCommand(""), { kind: "status" });
});

test("isMixedProviderError matches CamelStream encrypted-history 400", () => {
  const failure = {
    status: 400,
    message: 'Your request contains encrypted reasoning or compaction content from multiple providers. No single provider can decrypt the mixed history. Start a new conversation without the encrypted items.',
    code: 400,
    metadata: {
      distinct_provider_slugs: "azure,meta",
      failed_routing_step: "Filter by Encrypted Payload Endpoint",
    },
  };
  assert.equal(isMixedProviderError(failure), true);
  assert.equal(isMixedProviderError({ failure }), true);
  assert.equal(isMixedProviderError(new Error(JSON.stringify(failure))), true);
  assert.equal(isMixedProviderError({ message: "rate limited" }), false);
});

test("resolveProject always locks to D:\\dipcatcher", () => {
  const ssh = resolveProject("ssh", process.cwd());
  assert.equal(ssh.ok, true);
  assert.equal(ssh.ssh.remotePath, "D:\\dipcatcher");
  assert.ok(ssh.path.includes("ssh-workspaces"));
  const drive = resolveProject("D:\\GLOC", process.cwd());
  assert.equal(drive.ok, true);
  assert.equal(drive.ssh.remotePath, "D:\\dipcatcher");
  const local = resolveProject("/Users/vaithianathan/dipcatcher", process.cwd());
  assert.equal(local.ok, true);
  assert.equal(local.ssh.remotePath, "D:\\dipcatcher");
});

test("hasHonestProof requires both bars and live URLs", () => {
  const dir = mkdtempSync(join(tmpdir(), "dsh-24x7-proof-"));
  mkdirSync(join(dir, ".dsh-24x7"));
  writeFileSync(join(dir, ".dsh-24x7", "PROOF.md"), [
    "## Industry-grade",
    "STATUS: PROVEN",
    "https://example.com/incumbent",
    "## SOTA",
    "STATUS: PROVEN",
    "https://arxiv.org/abs/1234.5678",
  ].join("\n"));
  assert.equal(hasHonestProof(dir), true);
  writeFileSync(join(dir, ".dsh-24x7", "PROOF.md"), [
    "## Industry-grade",
    "STATUS: WIP",
    "https://example.com/incumbent",
    "## SOTA",
    "STATUS: PROVEN",
    "https://arxiv.org/abs/1234.5678",
  ].join("\n"));
  assert.equal(hasHonestProof(dir), false);
  writeFileSync(join(dir, ".dsh-24x7", "PROOF.md"), [
    "## Industry-grade",
    "STATUS: PROVEN",
    "## SOTA",
    "STATUS: PROVEN",
    "https://arxiv.org/abs/1234.5678",
  ].join("\n"));
  assert.equal(hasHonestProof(dir), false);
});

test("buildObjective names both bars", () => {
  const text = buildObjective("/tmp/demo", "keep the API stable");
  assert.match(text, /industry-grade/i);
  assert.match(text, /SOTA/);
  assert.match(text, /keep the API stable/);
  assert.match(text, /PROOF\.md/);
});

test("rewriteTwentyFourLine aliases /24x7 onto the legal command name", () => {
  assert.equal(rewriteTwentyFourLine("/24x7 lightspeed"), "/x24x7 lightspeed");
  assert.equal(rewriteTwentyFourLine("/24x7 status"), "/x24x7 status");
  assert.equal(rewriteTwentyFourLine("/x24x7 status"), undefined);
  assert.equal(rewriteTwentyFourLine("24x7 job abc"), undefined);
});

test("kickoff prompt is not a slash command", () => {
  const text = buildKickoffPrompt({
    id: "24x7-test",
    project: "/tmp/demo",
    objective: "work",
  }, "start");
  assert.equal(text.startsWith("/24x7"), false);
});

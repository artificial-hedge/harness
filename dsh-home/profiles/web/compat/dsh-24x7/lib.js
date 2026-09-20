import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseSshTarget } from "../ah-ssh-remote/lib.js";

export const JOBS_DIR = join(homedir(), ".dsh", "24x7");
export const PROJECT_DIR_NAME = ".dsh-24x7";
export const MAX_GOAL_ROUNDS = 100_000;
export const MIXED_PROVIDER_MARKERS = [
  "encrypted reasoning or compaction content from multiple providers",
  "no single provider can decrypt the mixed history",
  "start a new conversation without the encrypted items",
  "filter by encrypted payload endpoint",
  "distinct_provider_slugs",
];

export function expandHome(input) {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return join(homedir(), input.slice(2));
  return input;
}

export const COMMAND_NAME = "x24x7";

export function rewriteTwentyFourLine(line) {
  const trimmed = String(line ?? "").trim();
  if (!/^\/24x7(?=$|[\t\n\r ])/iu.test(trimmed)) return undefined;
  return `/${COMMAND_NAME}${trimmed.replace(/^\/24x7/iu, "")}`;
}

export function parseCommand(rawInput) {
  const input = String(rawInput ?? "").trim();
  if (input.length === 0) return { kind: "status" };
  const [head, ...rest] = input.split(/\s+/);
  const control = head.toLowerCase();
  if (control === "status") return { kind: "status" };
  if (control === "pause") return { kind: "pause" };
  if (control === "resume") return { kind: "resume" };
  if (control === "stop" || control === "clear") return { kind: "stop" };
  if (control === "start") {
    if (rest.length === 0) return { kind: "invalid", text: "Usage: /24x7 start <project> [notes]" };
    return { kind: "start", project: rest[0], notes: rest.slice(1).join(" ").trim() };
  }
  return { kind: "start", project: head, notes: rest.join(" ").trim() };
}

export function isMixedProviderError(value) {
  const parts = [];
  const seen = new Set();
  const walk = (item, depth) => {
    if (item == null || depth > 6 || seen.has(item)) return;
    if (typeof item === "string" || typeof item === "number") {
      parts.push(String(item));
      return;
    }
    if (typeof item !== "object") return;
    seen.add(item);
    for (const key of ["message", "code", "status", "body", "error", "failure", "metadata"]) {
      if (key in item) walk(item[key], depth + 1);
    }
    if (item.metadata && typeof item.metadata === "object") {
      for (const [key, nested] of Object.entries(item.metadata)) {
        parts.push(key);
        walk(nested, depth + 1);
      }
    }
    if (item instanceof Error && item.cause) walk(item.cause, depth + 1);
  };
  walk(value, 0);
  try {
    parts.push(JSON.stringify(value));
  } catch {
    /* circular or BigInt payloads still have the walked fields */
  }
  const haystack = parts.join("\n").toLowerCase();
  return MIXED_PROVIDER_MARKERS.some((marker) => haystack.includes(marker));
}

export function resolveProject(specified, sessionCwd) {
  const raw = expandHome(String(specified ?? "").trim());
  if (raw.length === 0) return { ok: false, text: "Name a project directory: /24x7 ssh" };
  const ssh = parseSshTarget("ssh") ?? parseSshTarget(raw);
  if (!ssh) return { ok: false, text: "Workspace is locked to D:\\dipcatcher. Use /24x7 ssh" };
  return { ok: true, path: ssh.localRoot, ssh };
}

export function projectStateDir(projectPath) {
  return join(projectPath, PROJECT_DIR_NAME);
}

export function jobPath(jobId) {
  return join(JOBS_DIR, `${jobId}.json`);
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function writeJson(path, value) {
  ensureDir(join(path, ".."));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

export function listJobs() {
  try {
    return readdirSync(JOBS_DIR)
      .filter((name) => name.endsWith(".json"))
      .map((name) => readJson(join(JOBS_DIR, name)))
      .filter((job) => job && typeof job === "object" && typeof job.id === "string");
  } catch {
    return [];
  }
}

export function proofRoot(jobOrPath) {
  if (jobOrPath && typeof jobOrPath === "object") {
    return jobOrPath.localRoot ?? jobOrPath.project;
  }
  return jobOrPath;
}

export function saveJob(job) {
  const next = { ...job, updatedAt: new Date().toISOString() };
  ensureDir(JOBS_DIR);
  writeJson(jobPath(next.id), next);
  const kit = proofRoot(next);
  if (kit && !/^[A-Za-z]:[\\/]/.test(String(kit))) {
    writeJson(join(projectStateDir(kit), "job.json"), next);
  }
  return next;
}

export function proofPath(projectPath) {
  return join(projectStateDir(projectPath), "PROOF.md");
}

export function sectionBody(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const source = String(text);
  const headingMatch = source.match(new RegExp(`^##\\s*${escaped}\\b[^\\n]*\\n`, "im"));
  if (headingMatch?.index == null) return "";
  const body = source.slice(headingMatch.index + headingMatch[0].length);
  const next = body.search(/^##\s/m);
  return (next < 0 ? body : body.slice(0, next)).trim();
}

export function hasHonestProof(jobOrPath) {
  let text;
  try {
    text = readFileSync(proofPath(proofRoot(jobOrPath)), "utf8");
  } catch {
    return false;
  }
  const industry = sectionBody(text, "Industry-grade");
  const sota = sectionBody(text, "SOTA");
  const proven = (section) => /STATUS:\s*PROVEN/i.test(section);
  const cited = (section) => /https?:\/\/\S+/.test(section);
  return proven(industry) && proven(sota) && cited(industry) && cited(sota);
}

export function buildObjective(projectPath, notes, ssh) {
  const extra = notes ? `\n\nAdditional user notes:\n${notes}` : "";
  const remote = ssh
    ? `\nThis project is D:\\dipcatcher on the Windows SSH host. The session working directory is the synced copy of that tree. Edit files here; they are pushed back to D:\\dipcatcher. Do not switch to another project.`
    : "";
  return [
    `24x7 continuous work on ${projectPath} until both bars are honestly proven.`,
    "Bar 1 — industry-grade overperformance: beat real production systems on the project's actual quality bars (correctness, tests, latency, reliability, UX, security, operability). Compare against named incumbents, not vibes.",
    "Bar 2 — ultimate SOTA: match or beat the current published state of the art for this domain, with numbers, papers, repos, and rerunnable evals. If the project is not a research artifact, SOTA means the best public implementation of the same product class.",
    "Do not mark the goal complete until `.dsh-24x7/PROOF.md` exists with both `## Industry-grade` and `## SOTA` sections set to `STATUS: PROVEN`, each citing at least one live URL and a command whose output you captured.",
    "Self-praise is not proof. If evidence is missing, keep working. Persist progress in `.dsh-24x7/PROGRESS.md` and `.dsh-24x7/HANDOFF.md` after every meaningful round.",
    remote,
    extra,
  ].join("\n");
}

export function buildKickoffPrompt(job, reason) {
  const resume = reason === "mixed-provider-recovery"
    ? "This is a clean session. The previous conversation was abandoned because CamelStream mixed encrypted reasoning from multiple providers (azure/meta). Do not ask the user to log in or to paste history. Resume from the workspace and `.dsh-24x7/` files only."
    : reason === "startup-resume"
      ? "Harness restarted. Resume the same 24x7 job from workspace files. Do not restart from scratch if progress already exists."
      : "Start the 24x7 job now.";
  return [
    `24x7 job ${job.id}`,
    `Project: ${job.project}`,
    job.ssh ? `Remote SSH: ${job.ssh.user}@${job.ssh.hostname}:${job.ssh.remotePath}` : "",
    resume,
    "",
    job.objective,
    "",
    "Working contract:",
    job.ssh
      ? "1. Inspect this working tree (the synced D:\\\\dipcatcher project) and `.dsh-24x7/` before acting."
      : "1. Inspect the current tree and `.dsh-24x7/` before acting.",
    "2. Do concrete work every round: code, tests, evals, measurements, or a documented blocker that is truly external.",
    "3. Update `.dsh-24x7/PROGRESS.md` and `.dsh-24x7/HANDOFF.md` so a later clean session can continue without this chat.",
    "4. Leave the goal active until both bars are proven. Do not complete the goal without honest proof.",
    "5. If a turn fails with mixed-provider encrypted history, keep writing handoff files; a new session will pick them up.",
  ].join("\n");
}

export function renderJob(job, title = "24x7") {
  return [
    title,
    `Status: ${job.status}`,
    `Project: ${job.project}`,
    job.ssh ? `SSH: ${job.ssh.user}@${job.ssh.hostname}:${job.ssh.remotePath}` : "",
    `Session: ${job.sessionId ?? "(none)"}`,
    `Migrations: ${job.migrations ?? 0}`,
    `Proof: ${hasHonestProof(job) ? "both bars documented" : "not yet proven"}`,
    job.lastError ? `Last error: ${job.lastError}` : "",
    "",
    "Commands: /24x7 <project>, /x24x7 status, /x24x7 pause, /x24x7 resume, /x24x7 stop",
  ].filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1].length > 0)).join("\n");
}

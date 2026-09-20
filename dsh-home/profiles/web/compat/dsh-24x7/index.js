import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { enableFromProject } from "../ah-ssh-remote/lib.js";
import {
  COMMAND_NAME,
  MAX_GOAL_ROUNDS,
  buildKickoffPrompt,
  buildObjective,
  hasHonestProof,
  isMixedProviderError,
  listJobs,
  parseCommand,
  projectStateDir,
  proofRoot,
  renderJob,
  resolveProject,
  rewriteTwentyFourLine,
  saveJob,
} from "./lib.js";

export const name = "command-24x7";
export const inject = ["commands", "agents", "sessions", "goals", "timer"];

const USAGE = "Usage: /24x7 ssh [notes] | /x24x7 status | pause | resume | stop  (workspace is D:\\\\dipcatcher)";

function messageText(message) {
  if (!Array.isArray(message?.content)) return "";
  return message.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n");
}

function thrownText(value) {
  return value instanceof Error ? value.message : String(value);
}

function sessionCwd(agent) {
  return agent?.session?.header?.cwd;
}

function jobBySession(agent) {
  const sessionId = agent?.id;
  if (!sessionId) return undefined;
  return listJobs().find((job) => job.sessionId === sessionId);
}

function currentJob(agent) {
  const owned = jobBySession(agent);
  if (owned) return owned;
  const cwd = sessionCwd(agent);
  if (!cwd) return undefined;
  return listJobs().find((job) => (
    (job.status === "running" || job.status === "paused")
    && (job.project === cwd || job.localRoot === cwd)
  ));
}

function writeWorkspaceKit(job, reason) {
  const dir = projectStateDir(proofRoot(job));
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/HANDOFF.md`, [
    `# 24x7 handoff`,
    ``,
    `- job: ${job.id}`,
    `- status: ${job.status}`,
    `- reason: ${reason}`,
    `- session: ${job.sessionId ?? ""}`,
    `- updated: ${job.updatedAt}`,
    ``,
    job.objective,
    ``,
  ].join("\n"), "utf8");
}

function followup(agent, text) {
  agent.followup(createUserMessage({
    content: [{ type: "text", text }],
    source: { kind: "user" },
  }));
}

function ensureGoal(ctx, agent, objective) {
  const current = ctx.goals.get(agent);
  if (current && current.phase !== "complete") {
    if (current.phase === "paused" || current.phase === "blocked") {
      return ctx.goals.resume(agent, { id: current.id, revision: current.revision });
    }
    if (current.activation !== "armed") {
      try {
        return ctx.goals.resume(agent, { id: current.id, revision: current.revision });
      } catch {
        return current;
      }
    }
    return current;
  }
  return ctx.goals.create(agent, { objective, maxGoalRounds: MAX_GOAL_ROUNDS });
}

async function composeSetup(ctx, presetId) {
  const presets = ctx.get("agentPresets");
  if (presets === undefined) return {};
  const resolvedId = (await presets.resolve(presetId)).id;
  return {
    agentPreset: resolvedId,
    setup: async (agentCtx) => {
      await presets.mount(agentCtx, resolvedId);
    },
  };
}

function presetFor(ctx, agent) {
  try {
    const projected = ctx.sessionProjections?.stateOf?.(agent.session, "agentPreset");
    if (typeof projected === "string" && projected.length > 0) return projected;
  } catch {
    /* fall through */
  }
  return agent.session?.header?.agentPreset ?? "cordis-max";
}

function agentOptions(ctx) {
  try {
    const selection = ctx.agentDefaultModel?.currentSelection?.();
    if (selection?.provider && selection?.model) {
      return { provider: selection.provider, model: selection.model };
    }
  } catch {
    /* fall through */
  }
  return { provider: "camelstream", model: "auto" };
}

async function attachWorkspace(ctx, sourceAgent, sessionId) {
  const registry = ctx.get("workspaceRegistry");
  if (registry === undefined || sourceAgent === undefined) return;
  const workspaces = registry.list?.() ?? [];
  const sourceId = sourceAgent.session?.id;
  const match = workspaces.find((workspace) => workspace.sessionIds?.includes(sourceId));
  if (match?.attachSession) await match.attachSession(sessionId);
}

async function startSession(ctx, job, reason, sourceAgent) {
  if (job.localRoot) mkdirSync(job.localRoot, { recursive: true });
  if (job.ssh) {
    enableFromProject({
      ...job.ssh,
      localRoot: job.localRoot,
    }, { forceAll: false });
  }
  const sessionId = `session-24x7-${randomUUID()}`;
  const composition = await composeSetup(ctx, sourceAgent ? presetFor(ctx, sourceAgent) : "cordis-max");
  const handle = await ctx.agents.create({
    sessionId,
    agentOptions: agentOptions(ctx),
    meta: {
      cwd: job.localRoot ?? job.project,
      ...composition.agentPreset ? { agentPreset: composition.agentPreset } : {},
    },
    setup: composition.setup,
  });
  try {
    await attachWorkspace(ctx, sourceAgent, sessionId);
  } catch (error) {
    ctx.logger?.warn?.(`24x7: workspace attach failed for ${sessionId}: ${thrownText(error)}`);
  }
  const next = saveJob({
    ...job,
    sessionId,
    previousSessionIds: [...new Set([...(job.previousSessionIds ?? []), job.sessionId].filter(Boolean))],
    migrations: (job.migrations ?? 0) + (reason === "start" ? 0 : 1),
    status: "running",
    lastError: reason === "mixed-provider-recovery" ? "migrated after mixed-provider 400" : job.lastError ?? null,
  });
  writeWorkspaceKit(next, reason);
  ensureGoal(ctx, handle.agent, next.objective);
  followup(handle.agent, buildKickoffPrompt(next, reason));
  ctx.logger?.info?.(`24x7: ${reason} session ${sessionId} for ${next.id}`);
  return next;
}

async function withJobLock(ctx, job, recovering, work) {
  if (recovering.has(job.id)) return job;
  recovering.add(job.id);
  try {
    return await work();
  } finally {
    ctx.timeout(() => recovering.delete(job.id), 5_000);
  }
}

async function migrate(ctx, job, agent, error, recovering) {
  return withJobLock(ctx, job, recovering, async () => {
    const next = saveJob({
      ...job,
      lastError: thrownText(error).slice(0, 500),
    });
    writeWorkspaceKit(next, "mixed-provider-recovery");
    try {
      agent.cancel?.("plugin", { keepInbox: false });
    } catch {
      /* old session can stay failed */
    }
    return startSession(ctx, next, "mixed-provider-recovery", agent);
  });
}

async function execute(ctx, invocation, recovering) {
  const command = parseCommand(invocation.rawInput);
  const agent = invocation.agent;
  if (command.kind === "invalid") return { kind: "error", text: command.text };

  if (command.kind === "status") {
    const job = currentJob(agent) ?? listJobs().find((item) => item.status === "running");
    return {
      kind: "success",
      text: job ? renderJob(job) : `No 24x7 job is running.\n${USAGE}`,
    };
  }

  if (command.kind === "pause") {
    const job = currentJob(agent);
    if (job === undefined) return { kind: "error", text: `No 24x7 job to pause.\n${USAGE}` };
    const goal = ctx.goals.get(agent);
    if (goal && goal.phase === "active") {
      try {
        ctx.goals.pause(agent, { id: goal.id, revision: goal.revision });
      } catch (error) {
        return { kind: "error", text: thrownText(error) };
      }
    }
    return { kind: "success", text: renderJob(saveJob({ ...job, status: "paused" }), "24x7 paused") };
  }

  if (command.kind === "stop") {
    const job = currentJob(agent);
    if (job === undefined) return { kind: "success", text: "No 24x7 job to stop." };
    const goal = ctx.goals.get(agent);
    if (goal && goal.phase !== "complete") {
      try {
        ctx.goals.clear(agent, { id: goal.id, revision: goal.revision });
      } catch {
        /* job record is the source of truth */
      }
    }
    return { kind: "success", text: renderJob(saveJob({ ...job, status: "stopped" }), "24x7 stopped") };
  }

  if (command.kind === "resume") {
    const job = currentJob(agent) ?? listJobs().find((item) => item.status === "paused" || item.status === "running");
    if (job === undefined) return { kind: "error", text: `No 24x7 job to resume.\n${USAGE}` };
    const live = job.sessionId ? ctx.agents.get(job.sessionId) : undefined;
    if (live) {
      ensureGoal(ctx, live, job.objective);
      const next = saveJob({ ...job, status: "running" });
      followup(live, buildKickoffPrompt(next, "startup-resume"));
      return { kind: "success", text: renderJob(next, "24x7 resumed") };
    }
    const next = await withJobLock(ctx, job, recovering, () => (
      startSession(ctx, { ...job, status: "running" }, "startup-resume", agent)
    ));
    return { kind: "success", text: renderJob(next, "24x7 resumed in a new session") };
  }

  const resolved = resolveProject(command.project, sessionCwd(agent));
  if (!resolved.ok) return { kind: "error", text: resolved.text };
  const existing = listJobs().find((job) => {
    if (job.status !== "running" && job.status !== "paused") return false;
    if (resolved.ssh) {
      return job.ssh?.hostname === resolved.ssh.hostname && job.ssh?.remotePath === resolved.ssh.remotePath;
    }
    return job.project === resolved.path || job.localRoot === resolved.path;
  });
  if (existing) {
    return execute(ctx, { ...invocation, rawInput: "resume" }, recovering);
  }
  if (resolved.ssh) {
    mkdirSync(resolved.ssh.localRoot, { recursive: true });
    enableFromProject(resolved.ssh, { forceAll: false });
  }
  const projectPath = resolved.ssh?.remotePath ?? resolved.path;
  const job = saveJob({
    id: `24x7-${randomUUID()}`,
    status: "running",
    project: projectPath,
    localRoot: resolved.ssh?.localRoot,
    ssh: resolved.ssh
      ? {
          user: resolved.ssh.user,
          hostname: resolved.ssh.hostname,
          alias: resolved.ssh.alias,
          remotePath: resolved.ssh.remotePath,
        }
      : undefined,
    notes: command.notes,
    objective: buildObjective(projectPath, command.notes, resolved.ssh),
    sessionId: agent.id,
    previousSessionIds: [],
    createdAt: new Date().toISOString(),
    migrations: 0,
    lastError: null,
  });
  writeWorkspaceKit(job, "start");
  ensureGoal(ctx, agent, job.objective);
  followup(agent, buildKickoffPrompt(job, "start"));
  return { kind: "success", text: renderJob(job, "24x7 started") };
}

export function apply(ctx) {
  const recovering = new Set();

  ctx.effect(function* () {
    yield ctx.commands.register({
      name: COMMAND_NAME,
      description: "24x7: work a project until industry-grade and SOTA are honestly proven",
      input: { hint: "[<project> [notes]|status|pause|resume|stop]" },
      handler: (invocation) => execute(ctx, invocation, recovering),
    });
  }, "command-24x7 lifecycle");

  const originalExecute = ctx.commands.execute?.bind(ctx.commands);
  if (typeof originalExecute === "function") {
    ctx.commands.execute = (agent, line, images, signal) => (
      originalExecute(agent, rewriteTwentyFourLine(line) ?? line, images, signal)
    );
  }

  ctx.on("agent/created", ({ agent }) => {
    const original = agent.followup.bind(agent);
    try {
      agent.followup = (message) => {
        const rewritten = rewriteTwentyFourLine(messageText(message).trim());
        if (rewritten) {
          Promise.resolve(ctx.commands.execute(agent, rewritten, [], AbortSignal.timeout(60_000))).catch((error) => {
            ctx.logger?.warn?.(`24x7: alias dispatch failed: ${thrownText(error)}`);
          });
          return;
        }
        return original(message);
      };
    } catch {
      /* followup is not writable on this host build */
    }
  });

  ctx.on("agent/request-error", async (payload, next) => {
    if (!isMixedProviderError(payload?.failure) && !isMixedProviderError(payload)) {
      return next();
    }
    const job = jobBySession(payload.agent);
    if (job?.status === "running") {
      ctx.timeout(() => {
        migrate(ctx, job, payload.agent, payload.failure ?? payload, recovering).catch((error) => {
          ctx.logger?.warn?.(`24x7: mixed-provider recovery failed: ${thrownText(error)}`);
        });
      }, 0);
    }
    return undefined;
  });

  ctx.on("agent/error", ({ agent, error }) => {
    if (!isMixedProviderError(error)) return;
    const job = jobBySession(agent);
    if (job?.status !== "running" || recovering.has(job.id)) return;
    ctx.timeout(() => {
      migrate(ctx, job, agent, error, recovering).catch((err) => {
        ctx.logger?.warn?.(`24x7: mixed-provider recovery failed: ${thrownText(err)}`);
      });
    }, 50);
  });

  ctx.on("goal/changed", (payload) => {
    const change = payload?.change;
    const owner = payload?.agent;
    if (change?.operation !== "complete" || owner === undefined) return;
    const job = jobBySession(owner) ?? currentJob(owner);
    if (job === undefined || job.status !== "running") return;
    if (hasHonestProof(job)) {
      saveJob({ ...job, status: "complete" });
      return;
    }
    try {
      ensureGoal(ctx, owner, job.objective);
      followup(owner, [
        "24x7 rejected a completion: `.dsh-24x7/PROOF.md` does not yet prove both industry-grade overperformance and SOTA.",
        "Keep working. Write real evidence (commands, numbers, URLs) before completing the goal.",
      ].join("\n"));
    } catch (error) {
      ctx.logger?.warn?.(`24x7: could not reopen goal after unproven completion: ${thrownText(error)}`);
    }
  });

  ctx.timeout(() => {
    for (const job of listJobs().filter((item) => item.status === "running")) {
      const live = job.sessionId ? ctx.agents.get(job.sessionId) : undefined;
      if (live) {
        try {
          ensureGoal(ctx, live, job.objective);
        } catch (error) {
          ctx.logger?.warn?.(`24x7: could not rearm ${job.id}: ${thrownText(error)}`);
        }
        continue;
      }
      withJobLock(ctx, job, recovering, () => startSession(ctx, job, "startup-resume", undefined)).catch((error) => {
        ctx.logger?.warn?.(`24x7: startup resume failed for ${job.id}: ${thrownText(error)}`);
      });
    }
  }, 1500);

  ctx.interval(() => {
    for (const job of listJobs().filter((item) => item.status === "running")) {
      if (recovering.has(job.id) || hasHonestProof(job)) continue;
      const live = job.sessionId ? ctx.agents.get(job.sessionId) : undefined;
      if (!live) {
        withJobLock(ctx, job, recovering, () => startSession(ctx, job, "startup-resume", undefined)).catch((error) => {
          ctx.logger?.warn?.(`24x7: heartbeat resume failed for ${job.id}: ${thrownText(error)}`);
        });
        continue;
      }
      if (live.status !== "idle") continue;
      const goal = ctx.goals.get(live);
      if (goal?.phase === "paused") continue;
      if (goal?.phase === "active" && goal.activation === "armed") continue;
      try {
        ensureGoal(ctx, live, job.objective);
        followup(live, buildKickoffPrompt(job, "startup-resume"));
      } catch (error) {
        ctx.logger?.warn?.(`24x7: heartbeat rearm failed for ${job.id}: ${thrownText(error)}`);
      }
    }
  }, 120_000);
}

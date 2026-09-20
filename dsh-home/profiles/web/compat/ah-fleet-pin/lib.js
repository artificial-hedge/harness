import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const PIN_PATH = join(homedir(), ".dsh", "fleet-pin.json");
export const DEFAULT_MAX_REDRAWS = 3;
export const PEEK_BYTES = 16_384;

export const FLEET = Object.freeze({
  auto: {
    id: "auto",
    label: "CamelStream auto (no preference)",
    official: "whatever the mixer pairs",
  },
  luna: {
    id: "luna",
    label: "GPT Luna",
    official: "GPT Luna (5.6)",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek V4.1 Flash",
    official: "DeepSeek V4.1 Flash",
  },
  glm: {
    id: "glm",
    label: "GLM 5.3 Flash",
    official: "GLM 5.3 Flash",
  },
  muse: {
    id: "muse",
    label: "Muse Spark",
    official: "Muse Spark (1.3)",
  },
});

const ALIASES = Object.freeze({
  auto: "auto",
  default: "auto",
  any: "auto",
  luna: "luna",
  gpt: "luna",
  "gpt-luna": "luna",
  "gpt-5.6": "luna",
  "gpt-5.6-luna": "luna",
  deepseek: "deepseek",
  ds: "deepseek",
  "v4.1": "deepseek",
  "deepseek-v4": "deepseek",
  "deepseek-v4.1-flash": "deepseek",
  glm: "glm",
  "glm-5.3": "glm",
  "glm-5.3-flash": "glm",
  muse: "muse",
  spark: "muse",
  "muse-spark": "muse",
});

export function resolvePrefer(raw) {
  if (raw == null) return undefined;
  const key = String(raw).trim().toLowerCase();
  if (key.length === 0) return undefined;
  return ALIASES[key] ?? (Object.hasOwn(FLEET, key) ? key : undefined);
}

export function familyMatches(prefer, model) {
  const family = resolvePrefer(prefer) ?? "auto";
  if (family === "auto") return true;
  const text = String(model ?? "");
  if (text.length === 0) return false;
  if (family === "luna") return /luna|gpt-5\.6/i.test(text);
  if (family === "deepseek") return /deepseek/i.test(text);
  if (family === "glm") return /\bglm\b|z-ai/i.test(text);
  if (family === "muse") return /muse/i.test(text);
  return false;
}

export function extractServedModel(text) {
  if (typeof text !== "string" || text.length === 0) return undefined;
  const match = text.match(/"model"\s*:\s*"([^"]+)"/);
  return match?.[1];
}

export function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === "object" && typeof input.url === "string") return input.url;
  return "";
}

export function isCamelInferenceUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.hostname !== "stream.camelai.com") return false;
  return /\/v1\/(chat\/completions|responses|messages)$/.test(parsed.pathname);
}

export function emptyPin() {
  return {
    prefer: "auto",
    lastServed: null,
    lastPrefer: null,
    lastAt: null,
    updatedAt: null,
  };
}

export function readPin(path = PIN_PATH) {
  try {
    if (!existsSync(path)) return emptyPin();
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed == null || typeof parsed !== "object") return emptyPin();
    return {
      ...emptyPin(),
      ...parsed,
      prefer: resolvePrefer(parsed.prefer) ?? "auto",
    };
  } catch {
    return emptyPin();
  }
}

export function writePin(next, path = PIN_PATH) {
  const merged = {
    ...emptyPin(),
    ...readPin(path),
    ...next,
    prefer: resolvePrefer(next?.prefer) ?? resolvePrefer(readPin(path).prefer) ?? "auto",
  };
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(merged, null, 2)}\n`);
  renameSync(tmp, path);
  return merged;
}

export function currentPrefer(config, path = PIN_PATH) {
  return resolvePrefer(readPin(path).prefer) ?? resolvePrefer(config?.prefer) ?? "auto";
}

export function renderFleetStatus(pin, { justSet = false } = {}) {
  const prefer = resolvePrefer(pin?.prefer) ?? "auto";
  const family = FLEET[prefer];
  const lines = [
    justSet ? `Fleet preference set to ${family.label}.` : `Fleet preference: ${family.label}.`,
    "CamelStream's standard plan does not officially pin a model. Only `auto` (and the legacy `deepseek-v4-flash` alias) are accepted; those IDs are served by the mixer.",
    "This harness redraws a request when the first chunk's model is the wrong family. If the mixer keeps pairing something else, the last draw is used so work continues.",
    "",
    "Official mixer families:",
    `- luna      ${FLEET.luna.official}`,
    `- deepseek  ${FLEET.deepseek.official}`,
    `- glm       ${FLEET.glm.official}`,
    `- muse      ${FLEET.muse.official}`,
    `- auto      ${FLEET.auto.official}`,
    "",
    `Last served: ${pin?.lastServed ?? "unknown"}`,
    `Usage: /fleet auto|luna|deepseek|glm|muse|status`,
  ];
  return lines.join("\n");
}

export function handleFleetCommand(rawInput, io = { readPin, writePin }) {
  const token = String(rawInput ?? "").trim().split(/\s+/)[0] ?? "";
  if (token.length === 0 || token.toLowerCase() === "status") {
    return { kind: "success", text: renderFleetStatus(io.readPin()) };
  }
  const prefer = resolvePrefer(token);
  if (!prefer) {
    return {
      kind: "error",
      text: "Usage: /fleet auto|luna|deepseek|glm|muse|status",
    };
  }
  const pin = io.writePin({
    prefer,
    updatedAt: new Date().toISOString(),
  });
  return { kind: "success", text: renderFleetStatus(pin, { justSet: true }) };
}

export async function inspectResponse(response, { peekBytes = PEEK_BYTES } = {}) {
  const body = response.body;
  if (body == null || typeof body.getReader !== "function") {
    return { model: undefined, response };
  }
  const reader = body.getReader();
  const chunks = [];
  let seen = 0;
  let text = "";
  const decoder = new TextDecoder();
  let model;
  while (seen < peekBytes) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      seen += value.byteLength ?? value.length ?? 0;
      text += decoder.decode(value, { stream: true });
      model = extractServedModel(text);
      if (model) break;
    }
  }
  const replay = new ReadableStream({
    async pull(controller) {
      if (chunks.length > 0) {
        controller.enqueue(chunks.shift());
        return;
      }
      const next = await reader.read();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(next.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return {
    model,
    response: new Response(replay, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  };
}

export async function pinnedFetch(baseFetch, input, init, hooks = {}) {
  const url = requestUrl(input);
  if (!isCamelInferenceUrl(url)) return baseFetch(input, init);
  const prefer = resolvePrefer(hooks.getPrefer?.()) ?? "auto";
  const maxRedraws = Number.isFinite(hooks.maxRedraws) ? Math.max(0, Math.floor(hooks.maxRedraws)) : DEFAULT_MAX_REDRAWS;

  const run = async () => {
    const response = await baseFetch(input, init);
    if (!response.ok) return { pass: true, response, model: undefined };
    return { pass: false, ...(await inspectResponse(response)) };
  };

  if (prefer === "auto") {
    const first = await run();
    if (!first.pass) hooks.onServed?.(first.model, prefer, 0);
    return first.response;
  }

  let last;
  for (let attempt = 0; attempt <= maxRedraws; attempt += 1) {
    const inspected = await run();
    last = inspected;
    if (inspected.pass) return inspected.response;
    if (familyMatches(prefer, inspected.model) || attempt === maxRedraws) {
      if (!familyMatches(prefer, inspected.model)) {
        hooks.onGiveUp?.(inspected.model, prefer, attempt);
      } else {
        hooks.onServed?.(inspected.model, prefer, attempt);
      }
      return inspected.response;
    }
    hooks.onMiss?.(inspected.model, prefer, attempt + 1);
    try {
      await inspected.response.body?.cancel?.();
    } catch {
      /* slot release is best-effort */
    }
  }
  return last.response;
}

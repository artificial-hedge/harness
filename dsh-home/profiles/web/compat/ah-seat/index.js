// Artificial Hedge model seat: pin CamelStream auto and map company
// speed names onto output budgets. Reasoning effort stays on the
// think-level pill / table so ultrafast can still think.
export const name = "ah-seat";
export const inject = ["webServer"];

const SPEEDS = ["ultrafast", "fast", "standard", "high", "intense"];
const SPEED_BUDGET = {
  ultrafast: 4096,
  fast: 8192,
  standard: 16384,
  high: 32768,
  intense: 65536,
};

function normalizeSpeed(value) {
  const key = String(value ?? "intense").toLowerCase();
  return SPEEDS.includes(key) ? key : "intense";
}

function resolveSeat(config) {
  const speed = normalizeSpeed(config?.speed);
  return { speed, maxTokens: SPEED_BUDGET[speed] };
}

function isLoopbackRequest(request) {
  const address = request.socket?.remoteAddress;
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
  const host = request.headers?.host;
  if (typeof host !== "string") return false;
  let hostUrl;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return false;
  }
  const allowed = new Set(["127.0.0.1", "localhost", "[::1]", "harness.artificialhedge.co"]);
  if (!allowed.has(hostUrl.hostname)) return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function writeJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "referrer-policy": "no-referrer",
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) return undefined;
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function apply(ctx, config) {
  let current = () => config ?? {};
  try {
    ctx.on("settings/document-updated", (ns) => {
      if (String(ns) !== "ah-seat") return;
      try {
        const settings = ctx.settings;
        const view = settings?.get?.("ah-seat");
        if (view && typeof view === "object") current = () => view;
      } catch {
        /* keep last known seat */
      }
    });
  } catch {
    /* settings namespace is optional */
  }

  ctx.on(
    "agent/request",
    async (_payload, next) => {
      const resolved = await next();
      if (resolved == null || typeof resolved !== "object") return resolved;
      const seat = resolveSeat(current());
      const purpose = resolved.purpose;
      const pinned = {
        ...resolved,
        provider: "camelstream",
        model: "auto",
      };
      if (purpose === "compaction" || purpose === "session-title") return pinned;
      return { ...pinned, maxTokens: seat.maxTokens };
    },
    true,
  );

  const webServer = ctx.webServer;
  if (!webServer || typeof webServer.register !== "function") return;

  const dispose = webServer.register({
    kind: "exact",
    path: "/api/ah-seat/config",
    handler: async (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { error: "forbidden: loopback-only" });
        return;
      }
      const method = req.method ?? "GET";
      const seat = resolveSeat(current());
      if (method === "GET") {
        writeJson(res, 200, { status: "ready", value: seat, writable: true });
        return;
      }
      if (method !== "POST") {
        writeJson(res, 405, { error: `method not allowed: ${method}` });
        return;
      }
      const body = await readJsonBody(req);
      if (body === undefined || !("speed" in body)) {
        writeJson(res, 400, { error: "invalid payload: expected { speed }" });
        return;
      }
      const next = { ...(current() || {}), speed: normalizeSpeed(body.speed) };
      current = () => next;
      try {
        await ctx.settings?.update?.("ah-seat", next);
      } catch {
        /* in-memory seat still applies for this process */
      }
      writeJson(res, 200, { status: "ready", value: resolveSeat(next), writable: true });
    },
  });
  ctx.effect(() => () => dispose?.(), "ah-seat: config route");
}

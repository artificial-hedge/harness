import {
  DEFAULTS,
  createStreamGate,
  delayMsForAttempt,
  isTransientAutoRoutingFailure,
  nextLoopRetry,
  retryAsyncIterable,
  sleep,
  usesCamelStream,
} from "./lib.js";

export const name = "ah-camel-resilience";
export const inject = ["llm", "agents"];

const loopRetries = new WeakMap();

function resolveStreamLimit(config) {
  const raw = config?.streamLimit;
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULTS.streamLimit;
}

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

function streamRetryOptions(ctx, options, gate) {
  return {
    signal: options?.signal,
    gate: usesCamelStream(options) ? gate : undefined,
    onRetry: ({ attempt, maxAttempts, delayMs }) => {
      ctx.logger?.warn?.(
        `ah-camel-resilience: auto routing unavailable; stream retry ${attempt}/${maxAttempts} in ${delayMs}ms`,
      );
    },
  };
}

function wrapPrepared(prepared, ctx, gate) {
  if (prepared == null || typeof prepared.stream !== "function") return prepared;
  const inner = prepared.stream.bind(prepared);
  const stream = (options) => retryAsyncIterable(
    () => inner(options),
    streamRetryOptions(ctx, options, gate),
  );
  try {
    return Object.freeze({ ...prepared, stream });
  } catch {
    return { ...prepared, stream };
  }
}

export function apply(ctx, config = {}) {
  const streamLimit = resolveStreamLimit(config);
  const gate = createStreamGate(streamLimit);
  ctx.logger?.info?.(`ah-camel-resilience: CamelStream cap ${streamLimit} concurrent HTTP streams`);

  const llm = ctx.llm;
  if (llm == null) {
    ctx.logger?.warn?.("ah-camel-resilience: llm service missing; 503 auto-routing will not be retried");
  } else {
    const originalStream = typeof llm.stream === "function" ? llm.stream.bind(llm) : undefined;
    if (originalStream) {
      const stream = (options) => retryAsyncIterable(
        () => originalStream(options),
        streamRetryOptions(ctx, options, gate),
      );
      if (!assignMethod(llm, "stream", stream)) {
        ctx.logger?.warn?.("ah-camel-resilience: could not wrap llm.stream");
      }
    }

    const originalPrepare = typeof llm.prepareCall === "function" ? llm.prepareCall.bind(llm) : undefined;
    if (originalPrepare) {
      const prepareCall = async (config, signal) => wrapPrepared(await originalPrepare(config, signal), ctx, gate);
      if (!assignMethod(llm, "prepareCall", prepareCall)) {
        ctx.logger?.warn?.("ah-camel-resilience: could not wrap llm.prepareCall");
      }
    }
  }

  ctx.on("agent/request-error", async (payload, next) => {
    const failure = payload?.failure ?? payload;
    if (!isTransientAutoRoutingFailure(failure)) return next();
    const { count, exhausted } = nextLoopRetry(loopRetries, payload?.agent ?? payload, payload, DEFAULTS.maxLoopRetries);
    if (exhausted) {
      ctx.logger?.warn?.(`ah-camel-resilience: giving up after ${DEFAULTS.maxLoopRetries} loop retries`);
      return next();
    }
    const delayMs = delayMsForAttempt(count - 1);
    ctx.logger?.warn?.(
      `ah-camel-resilience: auto routing unavailable; loop retry ${count}/${DEFAULTS.maxLoopRetries} in ${delayMs}ms`,
    );
    if (!await sleep(delayMs, payload?.signal)) return next();
    return { kind: "retry" };
  });
}

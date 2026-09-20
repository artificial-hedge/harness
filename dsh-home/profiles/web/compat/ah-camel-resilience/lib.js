const MIXED_PROVIDER_MARKERS = [
  "encrypted reasoning or compaction content from multiple providers",
  "no single provider can decrypt the mixed history",
  "start a new conversation without the encrypted items",
  "distinct_provider_slugs",
];

const CONTENT_CHUNK_TYPES = new Set([
  "block-start",
  "text-delta",
  "reasoning-delta",
  "tool-call-delta",
  "block-end",
]);

export const DEFAULTS = Object.freeze({
  maxStreamAttempts: 12,
  maxLoopRetries: 8,
  initialDelayMs: 2000,
  maxDelayMs: 45_000,
  streamLimit: 10,
});

export function collectText(value) {
  const parts = [];
  const seen = new Set();
  const walk = (item, depth) => {
    if (item == null || depth > 8) return;
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      parts.push(String(item));
      return;
    }
    if (typeof item !== "object") return;
    if (seen.has(item)) return;
    seen.add(item);
    if (item instanceof Error) {
      parts.push(item.name, item.message);
      if (item.code !== undefined) parts.push(String(item.code));
      if (item.cause) walk(item.cause, depth + 1);
    }
    for (const key of ["message", "code", "type", "status", "statusCode", "body", "error", "failure", "reason"]) {
      if (key in item) walk(item[key], depth + 1);
    }
    if (item.metadata && typeof item.metadata === "object") walk(item.metadata, depth + 1);
  };
  walk(value, 0);
  try {
    parts.push(JSON.stringify(value));
  } catch {
    /* circular payloads still have the walked fields */
  }
  return parts.join("\n");
}

export function isMixedProviderError(value) {
  const haystack = collectText(value).toLowerCase();
  return MIXED_PROVIDER_MARKERS.some((marker) => haystack.includes(marker));
}

export function isTransientAutoRoutingFailure(value) {
  if (value == null) return false;
  if (isMixedProviderError(value)) return false;
  const haystack = collectText(value);
  if (/auto\s+routing\s+is\s+temporarily\s+unavailable/i.test(haystack)) return true;
  if (/service_unavailable/i.test(haystack)) return true;
  if (/\b503\b/.test(haystack)) return true;
  if (/temporarily\s+unavailable/i.test(haystack) && /auto\s+routing|invalid_request_error/i.test(haystack)) {
    return true;
  }
  return false;
}

export function delayMsForAttempt(attempt, {
  initialDelayMs = DEFAULTS.initialDelayMs,
  maxDelayMs = DEFAULTS.maxDelayMs,
  random = Math.random,
} = {}) {
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.min(attempt, 20) : 0;
  const exponential = Math.min(initialDelayMs * 2 ** safeAttempt, maxDelayMs);
  const jitter = 0.85 + 0.3 * random();
  return Math.max(1, Math.min(Math.round(exponential * jitter), maxDelayMs));
}

export function abortReason(signal) {
  return signal?.reason ?? Object.assign(new Error("aborted"), { name: "AbortError" });
}

export function createStreamGate(limit = DEFAULTS.streamLimit) {
  const max = Math.max(1, Math.floor(Number(limit) || DEFAULTS.streamLimit));
  let active = 0;
  const waiters = [];

  function acquire(signal) {
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    if (active < max) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const entry = { resolve, reject, signal };
      const onAbort = () => {
        const index = waiters.indexOf(entry);
        if (index >= 0) waiters.splice(index, 1);
        reject(abortReason(signal));
      };
      entry.onAbort = onAbort;
      signal?.addEventListener("abort", onAbort, { once: true });
      waiters.push(entry);
    });
  }

  function release() {
    if (waiters.length > 0) {
      const next = waiters.shift();
      next.signal?.removeEventListener("abort", next.onAbort);
      next.resolve();
      return;
    }
    active = Math.max(0, active - 1);
  }

  return {
    acquire,
    release,
    get active() {
      return active;
    },
    get waiting() {
      return waiters.length;
    },
    get limit() {
      return max;
    },
  };
}

export function usesCamelStream(options) {
  const provider = options?.provider;
  return provider == null || provider === "camelstream";
}

export function sleep(ms, signal) {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve(true);
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      resolve(false);
    }
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function isContentChunk(chunk) {
  return chunk != null && typeof chunk === "object" && CONTENT_CHUNK_TYPES.has(chunk.type);
}

export function prefixFailure(chunks) {
  if (!Array.isArray(chunks)) return undefined;
  for (const chunk of chunks) {
    if (chunk?.type !== "finish") continue;
    const reason = chunk.reason;
    if (reason?.kind === "error" || reason?.kind === "aborted") {
      return reason.failure ?? reason;
    }
  }
  return undefined;
}

export async function* retryAsyncIterable(open, options = {}) {
  const {
    maxAttempts = DEFAULTS.maxStreamAttempts,
    initialDelayMs = DEFAULTS.initialDelayMs,
    maxDelayMs = DEFAULTS.maxDelayMs,
    random = Math.random,
    sleep: sleepFn = sleep,
    signal,
    onRetry,
    isRetryable = isTransientAutoRoutingFailure,
    gate,
  } = options;

  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      if (lastError !== undefined) throw lastError;
      return;
    }

    let retryDelayMs = 0;
    let hold = false;
    try {
      if (gate) {
        await gate.acquire(signal);
        hold = true;
      }

      let iterable;
      try {
        iterable = await open();
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt >= maxAttempts - 1) throw error;
        retryDelayMs = delayMsForAttempt(attempt, { initialDelayMs, maxDelayMs, random });
        onRetry?.({ attempt: attempt + 1, maxAttempts, delayMs: retryDelayMs, error });
      }

      if (retryDelayMs === 0) {
        if (iterable == null || typeof iterable[Symbol.asyncIterator] !== "function") {
          throw new TypeError("ah-camel-resilience: stream is not async-iterable");
        }

        const iterator = iterable[Symbol.asyncIterator]();
        const prefix = [];
        let committed = false;

        while (true) {
          let next;
          try {
            next = await iterator.next();
          } catch (error) {
            lastError = error;
            if (committed) throw error;
            if (!isRetryable(error) || attempt >= maxAttempts - 1) {
              for (const chunk of prefix) yield chunk;
              throw error;
            }
            retryDelayMs = delayMsForAttempt(attempt, { initialDelayMs, maxDelayMs, random });
            onRetry?.({ attempt: attempt + 1, maxAttempts, delayMs: retryDelayMs, error });
            break;
          }

          if (next.done) {
            if (!committed) {
              const failure = prefixFailure(prefix);
              if (failure && isRetryable(failure) && attempt < maxAttempts - 1) {
                lastError = failure;
                retryDelayMs = delayMsForAttempt(attempt, { initialDelayMs, maxDelayMs, random });
                onRetry?.({ attempt: attempt + 1, maxAttempts, delayMs: retryDelayMs, error: failure });
                break;
              }
              for (const chunk of prefix) yield chunk;
            }
            return;
          }

          const chunk = next.value;
          if (!committed) {
            prefix.push(chunk);
            if (isContentChunk(chunk)) {
              committed = true;
              for (const item of prefix) yield item;
            }
            continue;
          }
          yield chunk;
        }
      }
    } finally {
      if (hold) gate.release();
    }
    if (retryDelayMs > 0 && !await sleepFn(retryDelayMs, signal)) {
      if (lastError !== undefined) throw lastError;
      return;
    }
  }

  if (lastError !== undefined) throw lastError;
}

export function nextLoopRetry(store, agent, payload, maxLoopRetries = DEFAULTS.maxLoopRetries) {
  const key = `${payload?.turn ?? "?"}:${payload?.step ?? "?"}:${payload?.provider ?? ""}`;
  const previous = store.get(agent);
  const count = previous?.key === key ? previous.count + 1 : 1;
  store.set(agent, { key, count });
  return { key, count, exhausted: count > maxLoopRetries };
}

import { sanitizeGenerateOptions } from "./lib.js";

export const name = "ah-no-mixed-crypto";
export const inject = ["llm"];

function wrapPrepared(prepared) {
  if (prepared == null || typeof prepared.stream !== "function") return prepared;
  const inner = prepared.stream.bind(prepared);
  const stream = (options) => inner(sanitizeGenerateOptions(options).options);
  try {
    return Object.freeze({ ...prepared, stream });
  } catch {
    return { ...prepared, stream };
  }
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

export function apply(ctx) {
  const llm = ctx.llm;
  if (llm == null) {
    ctx.logger?.warn?.("ah-no-mixed-crypto: llm service missing; encrypted replay cannot be stripped");
    return;
  }

  const originalStream = typeof llm.stream === "function" ? llm.stream.bind(llm) : undefined;
  if (originalStream) {
    const stream = (options) => {
      const { options: sanitized, strippedCount } = sanitizeGenerateOptions(options);
      if (strippedCount > 0) {
        ctx.logger?.info?.(`ah-no-mixed-crypto: stripped encrypted replay from ${strippedCount} message(s)`);
      }
      return originalStream(sanitized);
    };
    if (!assignMethod(llm, "stream", stream)) {
      ctx.logger?.warn?.("ah-no-mixed-crypto: could not wrap llm.stream");
    }
  }

  const originalPrepare = typeof llm.prepareCall === "function" ? llm.prepareCall.bind(llm) : undefined;
  if (originalPrepare) {
    const prepareCall = async (config, signal) => wrapPrepared(await originalPrepare(config, signal));
    if (!assignMethod(llm, "prepareCall", prepareCall)) {
      ctx.logger?.warn?.("ah-no-mixed-crypto: could not wrap llm.prepareCall");
    }
  }
}

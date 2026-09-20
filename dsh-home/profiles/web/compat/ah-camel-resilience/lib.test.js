import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULTS,
  createStreamGate,
  delayMsForAttempt,
  isContentChunk,
  isMixedProviderError,
  isTransientAutoRoutingFailure,
  nextLoopRetry,
  prefixFailure,
  retryAsyncIterable,
  usesCamelStream,
} from "./lib.js";

const AUTO_ROUTING_503 = '503: {"message":"Auto routing is temporarily unavailable","type":"invalid_request_error","code":"service_unavailable"}';
const MIXED_400 = '400: {"message":"Your request contains encrypted reasoning or compaction content from multiple providers. No single provider can decrypt the mixed history."}';

function finishError(message, code = "INVALID_REQUEST") {
  return {
    type: "finish",
    reason: {
      kind: "error",
      failure: { message, code },
    },
  };
}

async function collect(iterable) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}

test("isTransientAutoRoutingFailure matches the live CamelStream 503 body", () => {
  assert.equal(isTransientAutoRoutingFailure(AUTO_ROUTING_503), true);
  assert.equal(isTransientAutoRoutingFailure(new Error(AUTO_ROUTING_503)), true);
  assert.equal(isTransientAutoRoutingFailure({
    message: AUTO_ROUTING_503,
    code: "INVALID_REQUEST",
  }), true);
  assert.equal(isTransientAutoRoutingFailure({
    failure: { message: "Auto routing is temporarily unavailable", code: "service_unavailable" },
  }), true);
});

test("isTransientAutoRoutingFailure leaves real invalid requests and mixed-provider 400s alone", () => {
  assert.equal(isTransientAutoRoutingFailure({
    message: "400: invalid_request_error: missing messages",
    code: "INVALID_REQUEST",
  }), false);
  assert.equal(isTransientAutoRoutingFailure(MIXED_400), false);
  assert.equal(isMixedProviderError(MIXED_400), true);
  assert.equal(isTransientAutoRoutingFailure({
    message: AUTO_ROUTING_503 + " " + MIXED_400,
  }), false);
});

test("delayMsForAttempt grows then caps at 45s", () => {
  assert.equal(delayMsForAttempt(0, { random: () => 0.5 }), 2000);
  assert.equal(delayMsForAttempt(1, { random: () => 0.5 }), 4000);
  assert.equal(delayMsForAttempt(5, { random: () => 0.5 }), 45_000);
  assert.equal(delayMsForAttempt(20, { random: () => 1 }), 45_000);
});

test("isContentChunk and prefixFailure read harness stream chunks", () => {
  assert.equal(isContentChunk({ type: "usage", usage: {} }), false);
  assert.equal(isContentChunk({ type: "text-delta", text: "hi" }), true);
  assert.deepEqual(prefixFailure([
    { type: "usage", usage: { inputTokens: 1 } },
    finishError(AUTO_ROUTING_503),
  ]).message, AUTO_ROUTING_503);
});

test("retryAsyncIterable retries a 503 finish with no content, then yields success", async () => {
  const sleeps = [];
  let opens = 0;
  const chunks = await collect(retryAsyncIterable(async () => {
    opens += 1;
    if (opens < 3) {
      return (async function* () {
        yield { type: "usage", usage: { inputTokens: 1 } };
        yield finishError(AUTO_ROUTING_503);
      })();
    }
    return (async function* () {
      yield { type: "text-delta", index: 0, text: "ok" };
      yield { type: "finish", reason: { kind: "stop" } };
    })();
  }, {
    random: () => 0.5,
    sleep: async (ms) => {
      sleeps.push(ms);
      return true;
    },
  }));
  assert.equal(opens, 3);
  assert.deepEqual(sleeps, [2000, 4000]);
  assert.equal(chunks[0].text, "ok");
});

test("retryAsyncIterable does not retry mixed-provider 400 finishes", async () => {
  let opens = 0;
  const chunks = await collect(retryAsyncIterable(async () => {
    opens += 1;
    return (async function* () {
      yield finishError(MIXED_400);
    })();
  }, {
    sleep: async () => {
      throw new Error("should not sleep for mixed-provider 400");
    },
  }));
  assert.equal(opens, 1);
  assert.equal(chunks[0].reason.failure.message.includes("multiple providers"), true);
});

test("retryAsyncIterable does not rewind after content has started", async () => {
  let opens = 0;
  const chunks = await collect(retryAsyncIterable(async () => {
    opens += 1;
    return (async function* () {
      yield { type: "text-delta", index: 0, text: "partial" };
      yield finishError(AUTO_ROUTING_503);
    })();
  }, {
    sleep: async () => {
      throw new Error("should not retry after content");
    },
  }));
  assert.equal(opens, 1);
  assert.equal(chunks[0].text, "partial");
  assert.equal(chunks[1].reason.failure.message.includes("Auto routing"), true);
});

test("retryAsyncIterable retries thrown 503s before any chunk", async () => {
  let opens = 0;
  const chunks = await collect(retryAsyncIterable(async () => {
    opens += 1;
    if (opens === 1) throw new Error(AUTO_ROUTING_503);
    return (async function* () {
      yield { type: "text-delta", index: 0, text: "recovered" };
    })();
  }, {
    random: () => 0.5,
    sleep: async () => true,
  }));
  assert.equal(opens, 2);
  assert.equal(chunks[0].text, "recovered");
});

test("usesCamelStream treats missing provider as CamelStream", () => {
  assert.equal(usesCamelStream({ provider: "camelstream", model: "auto" }), true);
  assert.equal(usesCamelStream({ model: "auto" }), true);
  assert.equal(usesCamelStream({ provider: "openai" }), false);
});

test("createStreamGate never admits an 11th concurrent holder", async () => {
  const gate = createStreamGate(10);
  const held = [];
  for (let i = 0; i < 10; i += 1) {
    await gate.acquire();
    held.push(i);
  }
  assert.equal(gate.active, 10);
  let eleventh = false;
  const waiting = gate.acquire().then(() => {
    eleventh = true;
  });
  await Promise.resolve();
  assert.equal(eleventh, false);
  assert.equal(gate.waiting, 1);
  gate.release();
  await waiting;
  assert.equal(eleventh, true);
  assert.equal(gate.active, 10);
  assert.equal(gate.waiting, 0);
});

test("retryAsyncIterable releases the stream slot before backing off a 503", async () => {
  const gate = createStreamGate(1);
  const actives = [];
  let opens = 0;
  await collect(retryAsyncIterable(async () => {
    opens += 1;
    actives.push(gate.active);
    if (opens === 1) throw new Error(AUTO_ROUTING_503);
    return (async function* () {
      yield { type: "text-delta", index: 0, text: "ok" };
    })();
  }, {
    gate,
    random: () => 0.5,
    sleep: async () => {
      actives.push(gate.active);
      return true;
    },
  }));
  assert.deepEqual(actives, [1, 0, 1]);
  assert.equal(gate.active, 0);
});

test("nextLoopRetry exhausts after the configured loop budget", () => {
  const store = new WeakMap();
  const agent = {};
  const payload = { turn: 4, step: 1, provider: "camelstream" };
  let last;
  for (let i = 0; i < DEFAULTS.maxLoopRetries; i += 1) {
    last = nextLoopRetry(store, agent, payload);
    assert.equal(last.exhausted, false);
  }
  last = nextLoopRetry(store, agent, payload);
  assert.equal(last.count, DEFAULTS.maxLoopRetries + 1);
  assert.equal(last.exhausted, true);
});

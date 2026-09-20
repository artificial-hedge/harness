import test from "node:test";
import assert from "node:assert/strict";
import {
  isEncryptedBlob,
  sanitizeBlock,
  sanitizeGenerateOptions,
  sanitizeMessage,
} from "./lib.js";

const replayState = {
  response: {
    kind: "pi-ai",
    version: 2,
    api: "openai-completions",
    provider: "camelstream",
    model: "auto",
    stopReason: "stop",
  },
  blocks: [
    {
      type: "reasoning",
      thinkingSignature: JSON.stringify([{ type: "reasoning.encrypted", data: "azure-blob", id: "rs_1" }]),
    },
    { type: "text" },
  ],
};

test("isEncryptedBlob recognizes OpenAI encrypted reasoning", () => {
  assert.equal(isEncryptedBlob({ type: "reasoning.encrypted", data: "x" }), true);
  assert.equal(isEncryptedBlob({ encrypted_content: "abc" }), true);
  assert.equal(isEncryptedBlob(replayState.blocks[0]), true);
  assert.equal(isEncryptedBlob({ type: "text", text: "hello" }), false);
});

test("sanitizeMessage drops replayState and turns reasoning into plain text", () => {
  const { message, stripped } = sanitizeMessage({
    role: "assistant",
    content: [
      { type: "reasoning", text: "plan the fix" },
      { type: "text", text: "done" },
    ],
    source: {
      kind: "model",
      provider: "camelstream",
      model: "auto",
      replayState,
    },
  });
  assert.equal(stripped, true);
  assert.equal("replayState" in message.source, false);
  assert.deepEqual(message.content, [
    { type: "text", text: "plan the fix" },
    { type: "text", text: "done" },
  ]);
});

test("sanitizeBlock drops signature-only thinking", () => {
  assert.deepEqual(sanitizeBlock({
    type: "thinking",
    thinking: "",
    thinkingSignature: JSON.stringify([{ type: "reasoning.encrypted", data: "meta-blob" }]),
  }), []);
});

test("sanitizeGenerateOptions clones messages and leaves non-replay history alone", () => {
  const original = {
    provider: "camelstream",
    model: "auto",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "hi" }],
        source: { kind: "user" },
      },
    ],
  };
  const { options, strippedCount } = sanitizeGenerateOptions(original);
  assert.equal(strippedCount, 0);
  assert.equal(options.messages[0].content[0].text, "hi");

  const dirty = {
    ...original,
    messages: [
      {
        role: "assistant",
        content: [{ type: "reasoning", text: "", thinkingSignature: "secret" }],
        source: { kind: "model", provider: "camelstream", model: "auto", replayState },
      },
    ],
  };
  const cleaned = sanitizeGenerateOptions(dirty);
  assert.equal(cleaned.strippedCount, 1);
  assert.equal("replayState" in cleaned.options.messages[0].source, false);
  assert.deepEqual(cleaned.options.messages[0].content, []);
  assert.equal("replayState" in dirty.messages[0].source, true);
});

test("sanitizeGenerateOptions strips mixed azure and meta signatures from one request", () => {
  const azure = JSON.stringify([{ type: "reasoning.encrypted", data: "azure", id: "rs_azure" }]);
  const meta = JSON.stringify([{ type: "reasoning.encrypted", data: "meta", id: "rs_meta" }]);
  const { options, strippedCount } = sanitizeGenerateOptions({
    provider: "camelstream",
    model: "auto",
    messages: [
      {
        role: "assistant",
        content: [{ type: "reasoning", text: "first", thinkingSignature: azure }],
        source: { kind: "model", provider: "camelstream", model: "auto", replayState: { blocks: [{ thinkingSignature: azure }] } },
      },
      {
        role: "assistant",
        content: [{ type: "reasoning", text: "second", thinkingSignature: meta }],
        source: { kind: "model", provider: "camelstream", model: "auto", replayState: { blocks: [{ thinkingSignature: meta }] } },
      },
    ],
  });
  assert.equal(strippedCount, 2);
  assert.equal(options.messages.every((message) => !("replayState" in message.source)), true);
  assert.equal(options.messages.every((message) => message.content.every((block) => !("thinkingSignature" in block))), true);
});

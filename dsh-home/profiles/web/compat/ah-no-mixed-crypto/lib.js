const SIGNATURE_KEYS = [
  "thinkingSignature",
  "thoughtSignature",
  "textSignature",
  "encrypted_content",
  "reasoning_details",
];

const ENCRYPTED_MARKERS = [
  "encrypted_content",
  "reasoning.encrypted",
  "thinkingSignature",
  "thoughtSignature",
];

export function isEncryptedBlob(value) {
  if (value == null) return false;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return ENCRYPTED_MARKERS.some((marker) => lower.includes(marker))
      || /"type"\s*:\s*"reasoning\.encrypted"/i.test(value);
  }
  if (typeof value !== "object") return false;
  if ("encrypted_content" in value) return true;
  if (value.type === "reasoning.encrypted") return true;
  if (typeof value.thinkingSignature === "string") return true;
  if (typeof value.thoughtSignature === "string") return true;
  if (Array.isArray(value.reasoning_details)) return true;
  if (value.kind === "pi-ai" && Array.isArray(value.blocks)) {
    return value.blocks.some((block) => isEncryptedBlob(block));
  }
  if (Array.isArray(value.blocks)) return value.blocks.some((block) => isEncryptedBlob(block));
  return false;
}

export function reasoningText(block) {
  if (!block || typeof block !== "object") return "";
  const raw = block.text ?? block.thinking ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

export function sanitizeBlock(block) {
  if (!block || typeof block !== "object") return [block];
  if (block.type === "reasoning" || block.type === "thinking") {
    const text = reasoningText(block);
    return text.length > 0 ? [{ type: "text", text }] : [];
  }
  const cleaned = { ...block };
  for (const key of SIGNATURE_KEYS) delete cleaned[key];
  if (cleaned.redacted === true) return [];
  return [cleaned];
}

export function sanitizeMessage(message) {
  if (!message || typeof message !== "object") return { message, stripped: false };
  let stripped = false;
  const next = { ...message };
  if (next.source && typeof next.source === "object") {
    if (next.source.replayState !== undefined) {
      stripped = true;
      const { replayState: _replayState, ...source } = next.source;
      next.source = source;
    }
  }
  if (Array.isArray(next.content)) {
    const content = [];
    for (const block of next.content) {
      if (block && typeof block === "object") {
        if (
          SIGNATURE_KEYS.some((key) => key in block)
          || block.type === "reasoning"
          || block.type === "thinking"
          || block.redacted === true
        ) {
          stripped = true;
        }
      }
      content.push(...sanitizeBlock(block));
    }
    next.content = content;
  }
  return { message: next, stripped };
}

export function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return { messages, strippedCount: 0 };
  }
  let strippedCount = 0;
  const next = messages.map((message) => {
    const result = sanitizeMessage(message);
    if (result.stripped) strippedCount += 1;
    return result.message;
  });
  return { messages: next, strippedCount };
}

export function sanitizeGenerateOptions(options) {
  if (!options || typeof options !== "object" || !Array.isArray(options.messages)) {
    return { options, strippedCount: 0 };
  }
  const { messages, strippedCount } = sanitizeMessages(options.messages);
  if (strippedCount === 0 && messages === options.messages) {
    return { options, strippedCount: 0 };
  }
  return {
    options: { ...options, messages },
    strippedCount,
  };
}

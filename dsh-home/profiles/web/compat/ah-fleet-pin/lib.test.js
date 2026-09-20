import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractServedModel,
  familyMatches,
  handleFleetCommand,
  isCamelInferenceUrl,
  pinnedFetch,
  readPin,
  resolvePrefer,
  writePin,
} from "./lib.js";

test("resolvePrefer maps fleet aliases", () => {
  assert.equal(resolvePrefer("GPT"), "luna");
  assert.equal(resolvePrefer("deepseek-v4.1-flash"), "deepseek");
  assert.equal(resolvePrefer("glm-5.3"), "glm");
  assert.equal(resolvePrefer("spark"), "muse");
  assert.equal(resolvePrefer("nope"), undefined);
});

test("familyMatches understands served CamelStream model ids", () => {
  assert.equal(familyMatches("auto", "openai/gpt-5.6-luna"), true);
  assert.equal(familyMatches("luna", "openai/gpt-5.6-luna"), true);
  assert.equal(familyMatches("deepseek", "deepseek/deepseek-v4.1-flash"), true);
  assert.equal(familyMatches("glm", "z-ai/glm-5.3-flash"), true);
  assert.equal(familyMatches("muse", "muse-spark-1.3"), true);
  assert.equal(familyMatches("deepseek", "openai/gpt-5.6-luna"), false);
});

test("extractServedModel reads the first SSE model field", () => {
  assert.equal(extractServedModel('data: {"id":"x","model":"openai/gpt-5.6-luna","choices":[]}'), "openai/gpt-5.6-luna");
});

test("isCamelInferenceUrl only matches Stream inference paths", () => {
  assert.equal(isCamelInferenceUrl("https://stream.camelai.com/v1/chat/completions"), true);
  assert.equal(isCamelInferenceUrl("https://stream.camelai.com/v1/models"), false);
  assert.equal(isCamelInferenceUrl("https://api.openai.com/v1/chat/completions"), false);
});

test("writePin and handleFleetCommand persist a preference", () => {
  const path = join(mkdtempSync(join(tmpdir(), "fleet-pin-")), "fleet-pin.json");
  const io = {
    readPin: () => readPin(path),
    writePin: (next) => writePin(next, path),
  };
  const result = handleFleetCommand("luna", io);
  assert.equal(result.kind, "success");
  assert.match(result.text, /GPT Luna/);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).prefer, "luna");
  assert.equal(handleFleetCommand("nope", io).kind, "error");
});

test("pinnedFetch redraws until the preferred family is served", async () => {
  const models = ["openai/gpt-5.6-luna", "deepseek/deepseek-v4.1-flash"];
  let calls = 0;
  const fetchImpl = async () => {
    const model = models[Math.min(calls, models.length - 1)];
    calls += 1;
    return new Response(`data: {"model":"${model}","choices":[]}\n\n`, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };
  const events = [];
  const response = await pinnedFetch(fetchImpl, "https://stream.camelai.com/v1/chat/completions", {}, {
    getPrefer: () => "deepseek",
    maxRedraws: 3,
    onMiss: (model) => events.push(`miss:${model}`),
    onServed: (model, prefer, redraws) => events.push(`served:${model}:${prefer}:${redraws}`),
  });
  const body = await response.text();
  assert.equal(calls, 2);
  assert.match(body, /deepseek-v4.1-flash/);
  assert.deepEqual(events, [
    "miss:openai/gpt-5.6-luna",
    "served:deepseek/deepseek-v4.1-flash:deepseek:1",
  ]);
});

test("pinnedFetch fails open after the redraw budget", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('data: {"model":"openai/gpt-5.6-luna","choices":[]}\n\n', { status: 200 });
  };
  const gaveUp = [];
  const response = await pinnedFetch(fetchImpl, "https://stream.camelai.com/v1/chat/completions", {}, {
    getPrefer: () => "muse",
    maxRedraws: 2,
    onGiveUp: (model, prefer) => gaveUp.push(`${prefer}:${model}`),
  });
  assert.equal(calls, 3);
  assert.deepEqual(gaveUp, ["muse:openai/gpt-5.6-luna"]);
  assert.match(await response.text(), /gpt-5.6-luna/);
});

test("pinnedFetch leaves non-CamelStream URLs alone", async () => {
  const response = await pinnedFetch(async () => new Response("ok"), "https://example.com/v1/chat/completions", {});
  assert.equal(await response.text(), "ok");
});

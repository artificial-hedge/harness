import fs from "node:fs";
import process from "node:process";
import { chromium } from "/Users/vaithianathan/.dsh/profiles/web/node_modules/playwright/index.mjs";

const proxyOrigin = process.env.HARNESS_EDGE_ORIGIN;
if (!proxyOrigin) throw new Error("HARNESS_EDGE_ORIGIN is required");

const log = fs.readFileSync("/Users/vaithianathan/.dsh/dsh-web.log", "utf8");
const matches = [...log.matchAll(/^dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/gm)];
const startupUrl = matches.at(-1)?.[1];
if (!startupUrl) throw new Error("No DSH startup URL found");
const token = new URL(startupUrl).searchParams.get("token");
if (!token) throw new Error("No DSH startup token found");

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
let webSocketCount = 0;
let webSocketErrors = 0;
const consoleErrors = [];
const failedRequests = [];
const errorResponses = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
});
page.on("requestfailed", (request) => {
  const url = new URL(request.url());
  failedRequests.push(`${request.method()} ${url.pathname}: ${request.failure()?.errorText ?? "failed"}`);
});
page.on("response", (response) => {
  if (response.status() < 400) return;
  const url = new URL(response.url());
  errorResponses.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
});
page.on("websocket", (socket) => {
  webSocketCount += 1;
  socket.on("socketerror", () => {
    webSocketErrors += 1;
  });
});

await page.goto(`${proxyOrigin}/?token=${encodeURIComponent(token)}`, {
  waitUntil: "domcontentloaded",
  timeout: 60_000,
});
let ready = true;
try {
  await page.waitForFunction(() => document.body.innerText.includes("Artificial Hedge"), null, {
    timeout: 30_000,
  });
} catch {
  ready = false;
}
await page.waitForTimeout(3_000);

let promptRoundTrip = null;
if (process.env.HARNESS_EDGE_PROMPT) {
  const continueButton = page.getByRole("button", { name: "Continue", exact: true });
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click({ force: true });
    await page.waitForTimeout(500);
  }
  const editor = page.locator('[contenteditable="true"]').last();
  await editor.evaluate((element) => element.focus());
  await page.keyboard.insertText(process.env.HARNESS_EDGE_PROMPT);
  await page.keyboard.press("Enter");
  try {
    await page.getByText("HARNESS_EDGE_OK", { exact: true }).waitFor({ timeout: 120_000 });
    promptRoundTrip = true;
  } catch {
    promptRoundTrip = false;
  }
}

console.log(
  JSON.stringify({
    title: await page.title(),
    mounted: (await page.locator("#root").count()) === 1,
    ready,
    webSocketCount,
    webSocketErrors,
    consoleErrors,
    failedRequests,
    errorResponses,
    promptRoundTrip,
    bodyText: (await page.locator("body").innerText()).slice(0, 500),
  }),
);
await browser.close();

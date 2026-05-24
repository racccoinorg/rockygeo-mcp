import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(__dirname, "..", "dist", "index.js");

// Free-plan limit is 1 RPS; pad slightly so we never trip it.
const MIN_REQUEST_GAP_MS = 1100;
let lastRequestAt = 0;

let client;
let transport;

beforeEach(async () => {
  const elapsed = Date.now() - lastRequestAt;
  const wait = MIN_REQUEST_GAP_MS - elapsed;
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
});

before(async () => {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error("RAPIDAPI_KEY is required for integration tests");
  }

  transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_PATH],
    env: { ...process.env, RAPIDAPI_KEY: apiKey },
  });

  client = new Client({ name: "rockygeo-mcp-tests", version: "0.0.0" });
  await client.connect(transport);
});

after(async () => {
  if (client) {
    await client.close();
  }
});

function parseJsonContent(res) {
  assert.ok(Array.isArray(res.content) && res.content.length > 0, "expected non-empty content");
  const first = res.content[0];
  assert.strictEqual(first.type, "text", "expected text content");
  return JSON.parse(first.text);
}

function assertNotToolError(res, query) {
  if (res.isError === true) {
    if (query !== undefined) {
      console.error("tool error query:", JSON.stringify(query, null, 2));
    }
    console.error("tool error response:", JSON.stringify(res, null, 2));
    const body = res.content?.[0]?.text ?? "<no body>";
    assert.fail(`tool returned isError: ${body}`);
  }
}

test("lists the three RockyGeo tools", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepStrictEqual(names, ["health_check", "lookup_ip", "lookup_ips_batch"]);
});

test("lookup_ip returns US geolocation for 8.8.8.8", async () => {
  const query = { name: "lookup_ip", arguments: { ip: "8.8.8.8" } };
  const res = await client.callTool(query);
  assertNotToolError(res, query);
  const body = parseJsonContent(res);
  assert.strictEqual(body.ip, "8.8.8.8");
  assert.strictEqual(body.found, true);
  assert.strictEqual(body.country_code, "US");
  assert.strictEqual(typeof body.lat, "number");
  assert.strictEqual(typeof body.lon, "number");
  assert.strictEqual(typeof body.tz, "string");
});

test("lookup_ip returns { found: false } for a private IP (404 → soft miss)", async () => {
  const query = { name: "lookup_ip", arguments: { ip: "192.168.1.1" } };
  const res = await client.callTool(query);
  assertNotToolError(res, query);
  const body = parseJsonContent(res);
  assert.strictEqual(body.ip, "192.168.1.1");
  assert.strictEqual(body.found, false);
});

test("lookup_ips_batch returns results keyed by IP", async () => {
  const query = { name: "lookup_ips_batch", arguments: { ips: ["8.8.8.8", "1.1.1.1"] } };
  const res = await client.callTool(query);
  assertNotToolError(res, query);
  const body = parseJsonContent(res);
  assert.ok(body.results, "expected results object");
  assert.ok(body.results["8.8.8.8"], "missing 8.8.8.8 in results");
  assert.ok(body.results["1.1.1.1"], "missing 1.1.1.1 in results");
  assert.strictEqual(body.results["8.8.8.8"].country_code, "US");
});

test("health_check returns status ok with a dataVersion", async () => {
  const query = { name: "health_check", arguments: {} };
  const res = await client.callTool(query);
  assertNotToolError(res, query);
  const body = parseJsonContent(res);
  assert.strictEqual(body.status, "ok");
  assert.strictEqual(typeof body.dataVersion, "number");
  assert.strictEqual(typeof body.uptime, "number");
});

test("lookup_ip rejects input that violates the schema", async () => {
  let rejected = false;
  try {
    const res = await client.callTool({
      name: "lookup_ip",
      arguments: { ip: "has spaces" },
    });
    if (res.isError) rejected = true;
  } catch {
    rejected = true;
  }
  assert.ok(rejected, "expected schema rejection for whitespace in IP");
});

test("lookup_ips_batch rejects an empty array", async () => {
  let rejected = false;
  try {
    const res = await client.callTool({
      name: "lookup_ips_batch",
      arguments: { ips: [] },
    });
    if (res.isError) rejected = true;
  } catch {
    rejected = true;
  }
  assert.ok(rejected, "expected schema rejection for empty ips array");
});

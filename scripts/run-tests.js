#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVER_BUILT = path.join(ROOT, "dist", "index.js");

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

// Read a line from /dev/tty (or stdin fallback) without echoing input.
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error("stdin is not a TTY — cannot prompt interactively"));
      return;
    }
    process.stderr.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let buf = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\n" || ch === "\r") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stderr.write("\n");
          resolve(buf);
          return;
        }
        if (ch === "") {
          stdin.setRawMode(false);
          stdin.pause();
          process.stderr.write("\n");
          process.exit(130);
        }
        if (ch === "" || ch === "\b") {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  if (!existsSync(SERVER_BUILT)) {
    process.stderr.write("dist/index.js missing — building first...\n");
    const code = await runCommand("npm", ["run", "build"]);
    if (code !== 0) process.exit(code);
  }

  let apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    apiKey = (await promptHidden("RAPIDAPI_KEY (input hidden): ")).trim();
    if (!apiKey) {
      process.stderr.write("No key provided, aborting.\n");
      process.exit(1);
    }
  }

  const code = await runCommand(
    process.execPath,
    ["--test", "tests/integration.test.js"],
    { env: { ...process.env, RAPIDAPI_KEY: apiKey } },
  );
  process.exit(code);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`run-tests error: ${msg}\n`);
  process.exit(1);
});

#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RockyGeoClient } from "./client.js";
import { createServer } from "./server.js";

const DEFAULT_BASE_URL = "https://rocky-geo.p.rapidapi.com/v1";

function parseArgs(argv: string[]): { apiKey?: string } {
  const args: { apiKey?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--api-key") {
      args.apiKey = argv[++i];
    } else if (a?.startsWith("--api-key=")) {
      args.apiKey = a.slice("--api-key=".length);
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  process.stderr.write(
    `rockygeo-mcp — MCP server for RockyGeo IP geolocation\n\n` +
      `Usage: rockygeo-mcp [--api-key <key>]\n\n` +
      `Environment:\n` +
      `  RAPIDAPI_KEY            RapidAPI key (required, overridden by --api-key)\n` +
      `  ROCKYGEO_BASE_URL       Defaults to ${DEFAULT_BASE_URL}\n` +
      `  ROCKYGEO_RAPIDAPI_HOST  Defaults to host parsed from base URL\n`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = args.apiKey ?? process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    process.stderr.write(
      "rockygeo-mcp: missing RapidAPI key. Set RAPIDAPI_KEY env var or pass --api-key <key>.\n",
    );
    process.exit(1);
  }

  const baseUrl = process.env.ROCKYGEO_BASE_URL ?? DEFAULT_BASE_URL;
  const rapidApiHost = process.env.ROCKYGEO_RAPIDAPI_HOST;

  const client = new RockyGeoClient({ apiKey, baseUrl, rapidApiHost });
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`rockygeo-mcp fatal error: ${msg}\n`);
  process.exit(1);
});

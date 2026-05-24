import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RockyGeoClient } from "./client.js";

export function createServer(client: RockyGeoClient): McpServer {
  const server = new McpServer({
    name: "rockygeo-mcp",
    version: "0.1.0",
  });

  const ipSchema = z
    .string()
    .min(1)
    .refine((s) => !/\s/.test(s), { message: "IP must not contain whitespace" });

  server.registerTool(
    "lookup_ip",
    {
      title: "Lookup IP",
      description:
        "Look up geolocation for a single IPv4 or IPv6 address via RockyGeo. Returns country, region, city, postal, lat/lon, and timezone. Private/reserved IPs return { found: false }.",
      inputSchema: { ip: ipSchema },
    },
    async ({ ip }) => {
      const result = await client.lookupIp(ip);
      return jsonContent(result);
    },
  );

  server.registerTool(
    "lookup_ips_batch",
    {
      title: "Lookup IPs (batch)",
      description:
        "Look up geolocation for 1-100 IPs in a single request. Returns a results object keyed by IP.",
      inputSchema: {
        ips: z.array(ipSchema).min(1).max(100),
      },
    },
    async ({ ips }) => {
      const result = await client.lookupBatch(ips);
      return jsonContent(result);
    },
  );

  server.registerTool(
    "health_check",
    {
      title: "RockyGeo health",
      description:
        "Check RockyGeo service health: status, dataset version, last sync timestamp, and process uptime.",
      inputSchema: {},
    },
    async () => {
      const result = await client.health();
      return jsonContent(result);
    },
  );

  return server;
}

function jsonContent(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

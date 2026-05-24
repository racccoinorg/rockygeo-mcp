# rockygeo-mcp

MCP (Model Context Protocol) server that wraps the RockyGeo IP geolocation API hosted on RapidAPI. Lets MCP-compatible clients (Claude Desktop, Claude Code, etc.) perform IPv4/IPv6 geolocation lookups via tool calls.

## Install

```bash
npm install
npm run build
```

## Configure

| Variable                 | Default                                 | Notes                                                   |
| ------------------------ | --------------------------------------- | ------------------------------------------------------- |
| `RAPIDAPI_KEY`           | (required)                              | Sent as `x-rapidapi-key`. Override with `--api-key <k>`. |
| `ROCKYGEO_BASE_URL`      | `https://rocky-geo.p.rapidapi.com/v1`   | Point at a self-hosted RockyGeo if you have one.        |
| `ROCKYGEO_RAPIDAPI_HOST` | parsed from base URL                    | Sent as `x-rapidapi-host` for `*.rapidapi.com` hosts.   |

## MCP client setup

Add to your client config (Claude Code `~/.claude.json`, Claude Desktop `claude_desktop_config.json`, etc.):

```json
{
  "mcpServers": {
    "rockygeo": {
      "command": "node",
      "args": ["/Users/cyborg97/rockygeomcp/dist/index.js"],
      "env": { "RAPIDAPI_KEY": "<your-key>" }
    }
  }
}
```

## Tools

- **`lookup_ip`** — `{ ip: string }` → geolocation for one IP. Private/reserved IPs return `{ found: false }`.
- **`lookup_ips_batch`** — `{ ips: string[] }` (1–100) → `{ results: { [ip]: ... } }`.
- **`health_check`** — `{}` → `{ status, dataVersion, lastSyncAt, uptime }`.

## Smoke test with the inspector

```bash
RAPIDAPI_KEY=<key> npx @modelcontextprotocol/inspector node dist/index.js
```

Then in the inspector UI: list tools, run `lookup_ip` with `{ "ip": "8.8.8.8" }`.

## Integration tests

End-to-end tests in `tests/integration.test.js` spawn the built server as a child
process and exercise every tool over the real MCP stdio transport, hitting the
live RockyGeo API.

```bash
npm test
```

If `RAPIDAPI_KEY` is not in the environment, the runner prompts for it (input is
hidden). The runner also auto-builds `dist/` if it is missing.

> Note: tests hit the real upstream API, so they consume RapidAPI quota and may
> be rate-limited on the Free plan (1 RPS).

## License

MIT.

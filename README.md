# check-mcp

[![npm](https://img.shields.io/npm/v/@golproductions/check-mcp)](https://www.npmjs.com/package/@golproductions/check-mcp)
[![smithery badge](https://smithery.ai/badge/golproductions/check-mcp)](https://smithery.ai/servers/golproductions/check-mcp)

MCP server for [Check](https://www.golproductions.com/check.html) — a command firewall for AI agents. Validates every shell command before execution. Sub-100ms. Runnable or invalid.

A free key is minted automatically on first run. No signup, no key to paste.

## Install

### Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "Check": {
      "command": "npx",
      "args": ["@golproductions/check-mcp"]
    }
  }
}
```

### Windsurf

```json
// .windsurf/mcp.json
{
  "mcpServers": {
    "Check": {
      "command": "npx",
      "args": ["@golproductions/check-mcp"]
    }
  }
}
```

The server activates a free key on first run. To reuse an existing Client ID across machines, add it under `env`:

```json
"env": { "GOL_CLIENT_ID": "your_key" }
```

### Claude Code

For Claude Code, use the installer instead — it wires up the hook that validates every command automatically:

```
npx @golproductions/check --install
```

## Tools

### `Check`

Validate a command. Returns `RUNNABLE` or `INVALID`.

```
Input:  { "command": "kubectl rollout restart deployment/api" }
Output: Verdict: RUNNABLE
```

### `CheckAndExecute`

Validate then run. Invalid commands are blocked before they touch the shell.

```
Input:  { "command": "kubectl rollout restart deployment/api" }
Output: (command output)
```

## How it works

1. Checks locally if the binary is installed on your machine
2. If not installed — instant block, no API call, no cost
3. If installed — validates syntax and targets via the Check API
4. Returns verdict in under 100ms

## Pricing

120 free checks every day. After that, $0.0068 AUD per check. No subscriptions. Credits never expire.

## License

Proprietary. See [LICENSE](LICENSE).

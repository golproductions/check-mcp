# check-mcp

[![npm](https://img.shields.io/npm/v/@golproductions/check-mcp)](https://www.npmjs.com/package/@golproductions/check-mcp)
[![smithery badge](https://smithery.ai/badge/golproductions/check-mcp)](https://smithery.ai/servers/golproductions/check-mcp)

MCP server for [Check](https://www.golproductions.com/check.html) — a command firewall for AI agents. Validates every shell command before execution. Sub-100ms. Runnable or invalid.

## Install

### Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "Check": {
      "command": "npx",
      "args": ["@golproductions/check-mcp"],
      "env": { "GOL_CLIENT_ID": "your_key" }
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
      "args": ["@golproductions/check-mcp"],
      "env": { "GOL_CLIENT_ID": "your_key" }
    }
  }
}
```

### Claude Code

For Claude Code, use the firewall hook instead — it validates every command automatically:

```json
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "npx",
        "args": ["@golproductions/check-firewall"]
      }]
    }]
  },
  "env": { "GOL_CLIENT_ID": "your_key" }
}
```

Get your API key at [golproductions.com](https://www.golproductions.com/check.html). 80 free checks on sign-up.

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

$0.0068 AUD per check. 80 free on sign-up. No subscriptions.

## License

Proprietary. See [LICENSE](LICENSE).

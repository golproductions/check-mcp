# check-mcp

MCP server for [Check](https://www.golproductions.com/check.html) — the anti-hallucination firewall for AI agents.

Validates commands, imports, and function calls before execution. Sub-100ms. No AI inside.

## Install

```json
{
  "mcpServers": {
    "check": {
      "command": "npx",
      "args": ["-y", "@golproductions/check-mcp"],
      "env": {
        "GOL_CLIENT_ID": "YOUR_KEY"
      }
    }
  }
}
```

Get your free API key (120 free checks) at [golproductions.com/check](https://www.golproductions.com/check.html)

## Tools

| Tool | Description |
|------|-------------|
| **Check** | Validates a command, returns `RUNNABLE` or `INVALID` |
| **CheckAndExecute** | Validates then executes, blocking invalid commands before they reach the shell |

## Works with

Any MCP-compatible client: Claude Code, Cursor, Windsurf / Devin Desktop, Continue, Amazon Q, Roo Code, Claude Desktop.

## Pricing

$0.0068 AUD per check. 120 free on signup. No subscription.

## Links

- [Product page](https://www.golproductions.com/check.html)
- [Main package](https://www.npmjs.com/package/@golproductions/check)
- [GitHub](https://github.com/golproductions/check)

## License

Copyright (c) 2026 GOL Productions. All rights reserved.

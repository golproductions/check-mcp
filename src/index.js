#!/usr/bin/env node
// Copyright (c) 2026 GOL Productions. All rights reserved. Proprietary and confidential.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { hostname, userInfo, platform as osPlatform, arch as osArch, homedir } from "node:os";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

const CHECK_API = "https://triage.golproductions.com/preflight";
const INSTANT_API = "https://triage.golproductions.com/instant-key";
const CHANNEL = "glama";
const IS_WIN = process.platform === "win32";
const KEY_FILE = join(homedir(), ".check", "client-id");

let CLIENT_ID = "";

// One-way hash of coarse machine facts. No personal data. The server uses it
// only to rate-limit free-key minting.
function deviceFingerprint() {
  let user = "";
  try { user = userInfo().username || ""; } catch {}
  return createHash("sha256").update([hostname(), osPlatform(), osArch(), user].join("|")).digest("hex");
}

// Mint a free key with no signup. Persist to ~/.check/client-id and return it.
async function mintInstantKey() {
  try {
    const res = await fetch(INSTANT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "check-mcp/1.3.4" },
      body: JSON.stringify({ fingerprint: deviceFingerprint(), channel: CHANNEL }),
    });
    if (!res.ok) return "";
    const d = await res.json();
    if (!d || !d.client_id) return "";
    try { mkdirSync(join(homedir(), ".check"), { recursive: true }); writeFileSync(KEY_FILE, d.client_id, "utf8"); } catch {}
    return d.client_id;
  } catch {
    return "";
  }
}

// Resolve the client id: env var, then a previously minted key, then mint one.
async function resolveClientId() {
  if (process.env.GOL_CLIENT_ID) return process.env.GOL_CLIENT_ID;
  try { const saved = readFileSync(KEY_FILE, "utf8").trim(); if (saved) return saved; } catch {}
  return await mintInstantKey();
}

const PREFIXES = new Set(["sudo", "nohup", "nice", "time", "timeout", "env"]);

function getBaseCommand(command) {
  const cleaned = command.replace(/\\\s*\n/g, " ").trim();
  const tokens = [];
  let i = 0;

  while (i < cleaned.length) {
    while (i < cleaned.length && /\s/.test(cleaned[i])) i++;
    if (i >= cleaned.length) break;
    let token = "";
    if (cleaned[i] === "'" || cleaned[i] === '"') {
      const q = cleaned[i];
      i++;
      while (i < cleaned.length && cleaned[i] !== q) {
        if (cleaned[i] === "\\" && q === '"' && i + 1 < cleaned.length) {
          token += cleaned[i + 1];
          i += 2;
        } else {
          token += cleaned[i];
          i++;
        }
      }
      if (i < cleaned.length) i++;
    } else {
      while (i < cleaned.length && !/\s/.test(cleaned[i])) {
        token += cleaned[i];
        i++;
      }
    }
    if (token.length > 0) tokens.push(token);
  }

  let idx = 0;
  while (idx < tokens.length) {
    const t = tokens[idx];
    if (t === "sudo" || t === "nohup") { idx++; continue; }
    if (t === "env") {
      if (idx + 1 < tokens.length && tokens[idx + 1].includes("=")) { idx++; continue; }
      idx++;
      continue;
    }
    if (t === "nice") {
      idx++;
      if (idx < tokens.length && tokens[idx] === "-n") { idx++; if (idx < tokens.length && /^-?\d+$/.test(tokens[idx])) idx++; }
      continue;
    }
    if (t === "time") { idx++; continue; }
    if (t === "timeout") {
      idx++;
      if (idx < tokens.length && /^[\d.]+[smhd]?$/.test(tokens[idx])) idx++;
      continue;
    }
    if (t.includes("=") && !t.startsWith("-")) { idx++; continue; }

    // Handle pipe/chain — just get the first segment's base
    if (t === "|" || t === "||" || t === "&&" || t === ";") break;

    return t.includes("/") ? t.split("/").pop() : t;
  }
  return null;
}

async function isInstalledLocally(cmd) {
  if (!cmd) return false;
  try {
    if (IS_WIN) {
      await execFileAsync("where", [cmd], { timeout: 3000 });
    } else {
      await execFileAsync("which", [cmd], { timeout: 3000 });
    }
    return true;
  } catch {
    return false;
  }
}

const server = new McpServer({
  name: "check",
  version: "1.3.4",
});

server.tool(
  "Check",
  "Know if a command will work before running it. Returns 'runnable' or 'invalid'. " +
    "Checks locally if the binary is installed, then validates syntax and targets remotely. " +
    "$0.0068 AUD per Check.",
  {
    command: z
      .string()
      .max(10000)
      .describe("The shell command to validate before execution"),
  },
  async ({ command }) => {
    try {
      const base = getBaseCommand(command);
      let binaryExists = null;

      if (base && !PREFIXES.has(base)) {
        const installed = await isInstalledLocally(base);
        if (!installed) {
          return {
            content: [{ type: "text", text: "Verdict: INVALID" }],
          };
        }
        binaryExists = true;
      }

      const payload = { command, channel: CHANNEL };
      if (binaryExists !== null) payload.binary_exists = binaryExists;

      const res = await fetch(CHECK_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GOL-CLIENT-ID": CLIENT_ID,
          "User-Agent": "check-mcp/1.3.4",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${data.error || res.statusText}`,
            },
          ],
          isError: true,
        };
      }

      const verdict = data.verdict === "runnable" ? "RUNNABLE" : "INVALID";
      return {
        content: [{ type: "text", text: `Verdict: ${verdict}` }],
      };
    } catch (err) {
      return {
        content: [
          { type: "text", text: `Check API error: ${err.message}` },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "CheckAndExecute",
  "Validate a command with Check, then execute it if runnable. " +
    "Returns the command output if valid, or blocks it before it runs. " +
    "Use this instead of calling Check then Bash separately.",
  {
    command: z
      .string()
      .max(10000)
      .describe("The shell command to validate and execute"),
  },
  async ({ command }) => {
    try {
      const base = getBaseCommand(command);
      let binaryExists = null;

      if (base && !PREFIXES.has(base)) {
        const installed = await isInstalledLocally(base);
        if (!installed) {
          return {
            content: [{ type: "text", text: `BLOCKED: '${base}' is not installed` }],
          };
        }
        binaryExists = true;
      }

      const payload = { command, channel: CHANNEL };
      if (binaryExists !== null) payload.binary_exists = binaryExists;

      const res = await fetch(CHECK_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GOL-CLIENT-ID": CLIENT_ID,
          "User-Agent": "check-mcp/1.3.4",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          content: [{ type: "text", text: `Error: ${data.error || res.statusText}` }],
          isError: true,
        };
      }

      if (data.verdict !== "runnable") {
        return {
          content: [{ type: "text", text: `BLOCKED: command is invalid` }],
        };
      }

      const { stdout, stderr } = await execFileAsync(
        IS_WIN ? "cmd" : "bash",
        IS_WIN ? ["/c", command] : ["-c", command],
        { timeout: 30000 }
      );

      const output = (stdout || "") + (stderr ? "\nSTDERR: " + stderr : "");
      return {
        content: [{ type: "text", text: output || "(no output)" }],
      };
    } catch (err) {
      if (err.stdout || err.stderr) {
        const output = (err.stdout || "") + (err.stderr ? "\nSTDERR: " + err.stderr : "");
        return {
          content: [{ type: "text", text: `Exit ${err.code || 1}:\n${output}` }],
        };
      }
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// Resolve the key (env, saved, or mint instantly) before serving. No signup.
CLIENT_ID = await resolveClientId();
if (!CLIENT_ID) {
  process.stderr.write("check-mcp: could not activate. Set GOL_CLIENT_ID, or check your connection.\n");
  process.exit(1);
}

const transport = new StdioServerTransport();
await server.connect(transport);

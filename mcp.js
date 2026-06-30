#!/usr/bin/env node
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
const VERSION = "2.4.1";
const API = "https://triage.golproductions.com/preflight";
const INSTANT = "https://triage.golproductions.com/instant-key";
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
    const res = await fetch(INSTANT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "c/" + VERSION },
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

async function validate(command) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GOL-CLIENT-ID": CLIENT_ID, "User-Agent": "c/" + VERSION },
    body: JSON.stringify({ command, channel: CHANNEL, v: VERSION })
  });
  return res.json();
}

const server = new McpServer({ name: "check", version: VERSION });

server.tool(
  "Check",
  "Know if a command will work before running it. Returns 'runnable' or 'invalid'. $0.0068 AUD per Check.",
  { command: z.string().max(10000).describe("The shell command to validate before execution") },
  async ({ command }) => {
    try {
      const d = await validate(command);
      if (!d.verdict) return { content: [{ type: "text", text: `Error: ${d.error || "unknown"}` }], isError: true };
      return { content: [{ type: "text", text: `Verdict: ${d.verdict === "runnable" ? "RUNNABLE" : "INVALID"}` }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Check API error: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  "CheckAndExecute",
  "Validate a command with Check, then execute it if runnable. Returns the command output if valid, or blocks it.",
  { command: z.string().max(10000).describe("The shell command to validate and execute") },
  async ({ command }) => {
    try {
      const d = await validate(command);
      if (d.verdict !== "runnable") return { content: [{ type: "text", text: "BLOCKED: " + (d.reason || "command is invalid") }] };
      const { stdout, stderr } = await execFileAsync(IS_WIN ? "cmd" : "bash", IS_WIN ? ["/c", command] : ["-c", command], { timeout: 30000 });
      return { content: [{ type: "text", text: (stdout || "") + (stderr ? "\nSTDERR: " + stderr : "") || "(no output)" }] };
    } catch (err) {
      if (err.stdout || err.stderr) return { content: [{ type: "text", text: `Exit ${err.code || 1}:\n${(err.stdout || "") + (err.stderr ? "\nSTDERR: " + err.stderr : "")}` }] };
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Resolve the key (env, saved, or mint instantly) before serving. No signup.
CLIENT_ID = await resolveClientId();
if (!CLIENT_ID) {
  process.stderr.write("check: could not activate. Set GOL_CLIENT_ID, or check your connection.\n");
  process.exit(1);
}

const transport = new StdioServerTransport();
await server.connect(transport);

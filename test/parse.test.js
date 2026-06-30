// Tests for getBaseCommand — the deterministic core that decides which binary a
// command resolves to. Everything downstream (local-install check, remote verdict)
// depends on this being right, so it gets locked down here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { getBaseCommand } from "../src/index.js";

test("plain command resolves to its binary", () => {
  assert.equal(getBaseCommand("git status"), "git");
  assert.equal(getBaseCommand("kubectl rollout restart deployment/api"), "kubectl");
});

test("absolute and relative paths resolve to the trailing binary name", () => {
  assert.equal(getBaseCommand("/usr/bin/node app.js"), "node");
  assert.equal(getBaseCommand("./scripts/deploy.sh"), "deploy.sh");
});

test("privilege and wrapper prefixes are skipped", () => {
  assert.equal(getBaseCommand("sudo rm -rf /tmp/x"), "rm");
  assert.equal(getBaseCommand("nohup python server.py"), "python");
  assert.equal(getBaseCommand("nice -n 10 tar xzf a.tgz"), "tar");
  assert.equal(getBaseCommand("time make build"), "make");
  assert.equal(getBaseCommand("timeout 5s curl https://x"), "curl");
});

test("inline environment assignments are skipped", () => {
  assert.equal(getBaseCommand("env FOO=bar ls -la"), "ls");
  assert.equal(getBaseCommand("FOO=bar BAZ=qux node app.js"), "node");
});

test("only the first segment of a pipe or chain is considered", () => {
  assert.equal(getBaseCommand("ls -la | grep foo"), "ls");
  assert.equal(getBaseCommand("make && ./run"), "make");
});

test("quoted tokens are unwrapped", () => {
  assert.equal(getBaseCommand("'git' status"), "git");
});

test("empty or whitespace-only input returns null", () => {
  assert.equal(getBaseCommand(""), null);
  assert.equal(getBaseCommand("   "), null);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { Details, TAIL_SCRIPT, contextLeft, lastModel, modelName, quotaSlots, statusLine, turnOf } from "../mods/cockpit/claude.js";

test("the context left is what Claude Code has not used, amber under 25 and red under 10", () => {
  assert.deepEqual(contextLeft(40), { left: 60, level: "ok" });
  assert.deepEqual(contextLeft(76), { left: 24, level: "low" });
  assert.deepEqual(contextLeft(75), { left: 25, level: "ok" });
  assert.deepEqual(contextLeft(91), { left: 9, level: "critical" });
  assert.deepEqual(contextLeft(104), { left: 0, level: "critical" });
  assert.equal(contextLeft(null), null);
  assert.equal(contextLeft(undefined), null);
});

test("the status line and the turn come from herdr-core's terminal", () => {
  assert.equal(statusLine({ report: { app: "claude-code", msg: "  reviewing ENG-412  ", state: "working" } }), "reviewing ENG-412");
  assert.equal(statusLine({ status: { msg: "fixing acme/api CI" } }), "fixing acme/api CI");
  assert.equal(statusLine({ status: "working", report: { msg: "" } }), null);
  assert.equal(statusLine(null), null);
  assert.equal(turnOf({ turn: 12 }), 12);
  assert.equal(turnOf({}), null);
});

test("the model is the last assistant message's, past a cut first line and synthetic replies", () => {
  const tail = [
    'ssage":{"model":"claude-sonnet-4-6","role":"assistant"}}',
    '{"type":"assistant","message":{"model":"claude-opus-5-5","role":"assistant"}}',
    '{"type":"user","message":{"role":"user","content":"thanks Maya"}}',
    '{"type":"assistant","message":{"model":"<synthetic>","role":"assistant"}}',
  ].join("\n");
  assert.equal(lastModel(tail), "claude-opus-5-5");
  assert.equal(lastModel(""), null);
  assert.equal(lastModel(null), null);
});

test("model ids read as people say them", () => {
  assert.equal(modelName("claude-opus-5-5"), "Opus 5.5");
  assert.equal(modelName("claude-sonnet-4-6[1m]"), "Sonnet 4.6 [1m]");
  assert.equal(modelName("claude-haiku-4-5-20251001"), "Haiku 4.5");
  assert.equal(modelName("gpt-5"), "gpt-5");
  assert.equal(modelName(null), null);
});

test("the sidebar always shows 5h then 7d, a window not reported as missing", () => {
  assert.deepEqual(quotaSlots([{ name: "7d", percent: 19 }]), [{ name: "5h", missing: true }, { name: "7d", percent: 19 }]);
  assert.deepEqual(quotaSlots([{ name: "7d", percent: 19 }, { name: "5h", percent: 42 }]).map((q) => q.name), ["5h", "7d"]);
  assert.deepEqual(quotaSlots(null), [{ name: "5h", missing: true }, { name: "7d", missing: true }]);
});

test("details are read once per session and turn, and again when the turn moves", async () => {
  const reads = [];
  const facts = { "app:t7": { session: "0a1b2c3d-4e5f-6789-abcd-ef0123456789", at: 1000, last: { at: 900, text: "Opened the PR for ENG-412" } } };
  const io = {
    facts: async () => (reads.push("facts"), facts),
    tail: async (session) => (reads.push(session), '{"type":"assistant","message":{"model":"claude-opus-5-5"}}'),
  };
  const d = new Details(io);
  const row = { terminal: "app:t7", session: "0a1b2c3d-4e5f-6789-abcd-ef0123456789" };
  assert.equal(d.get(row), null);
  assert.equal(d.due(row, 3), true);
  await d.load(row, 3);
  assert.deepEqual(d.get(row), { session: row.session, turn: 3, model: "claude-opus-5-5", last: 900, lastText: "Opened the PR for ENG-412" });
  assert.equal(d.due(row, 3), false);
  assert.equal(d.due(row, 4), true);
  assert.equal(reads.length, 2);
});

test("a session id that is not one never reaches the shell", async () => {
  const tails = [];
  const d = new Details({ facts: async () => ({}), tail: async (s) => (tails.push(s), "") });
  await d.load({ terminal: "app:t9", session: "$(touch /tmp/x)" }, 1);
  assert.deepEqual(tails, []);
  assert.equal(d.get({ terminal: "app:t9" }).model, null);
  assert.match(TAIL_SCRIPT, /"\$1"\.jsonl/);
});

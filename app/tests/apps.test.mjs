import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SPACES, badgeDue, customApps, parseBadge, pinnedApps, spaceNames, withOwnBlocks } from "../mods/cockpit/apps.js";

const config = ["inbox", "terminal", { name: "notes", child: "notes-board", label: "Notes", icon: "file-text", key: "⌘⌥8" }, "to-do", { name: "acme/api", cwd: "~/src/api", icon: "" }];

test("the pinned names keep the config's order, objects by their name", () => {
  assert.deepEqual(spaceNames(config), ["inbox", "terminal", "notes", "to-do", "acme/api"]);
  assert.deepEqual(spaceNames(undefined), DEFAULT_SPACES);
  assert.deepEqual(spaceNames([{ child: "x" }, "", null]), []);
});

test("a block of your own is an object with a child; a herdr space of your own is not one", () => {
  assert.deepEqual(customApps(config), { notes: { child: "notes-board", label: "Notes", icon: "file-text", key: "⌘⌥8" } });
  assert.deepEqual(customApps([{ name: "notes", child: "notes" }]), { notes: { child: "notes", label: "notes", icon: "app-window" } });
  assert.deepEqual(customApps([{ name: "notes" }, { child: "notes" }, "notes"]), {});
});

test("the sidebar shows cockpit's apps and your blocks in the config's order, each with its center block", () => {
  const apps = pinnedApps(spaceNames(config), customApps(config));
  assert.deepEqual(
    apps.map((a) => [a.name, a.child, a.label, a.icon]),
    [
      ["inbox", "inbox", "Inbox", "inbox"],
      ["notes", "notes-board", "Notes", "file-text"],
      ["to-do", "todo", "To-do", "list-todo"],
    ],
  );
});

test("a block of your own does not take the place of one of cockpit's apps", () => {
  const spaces = [{ name: "inbox", child: "other", label: "Other" }];
  assert.deepEqual(pinnedApps(spaceNames(spaces), customApps(spaces)), [{ name: "inbox", child: "inbox", label: "Inbox", icon: "inbox", key: "⌘⌥1" }]);
});

test("a block of your own keeps its mod, props and badge command; a badge polls at most once a minute", () => {
  const spaces = [{ name: "notes", child: "notes", mod: "notes-panel", props: { board: "ENG" }, badge: { run: ["node", "mods/notes-panel/count.mjs"], every: 120 } }];
  assert.deepEqual(customApps(spaces).notes, {
    child: "notes", label: "notes", icon: "app-window", mod: "notes-panel", props: { board: "ENG" }, badge: { run: ["node", "mods/notes-panel/count.mjs"], every: 120 },
  });
  assert.equal(customApps([{ name: "n", child: "n", badge: { run: ["x"], every: 5 } }]).n.badge.every, 300);
  assert.equal(customApps([{ name: "n", child: "n", badge: { run: [] } }]).n.badge, undefined);
  assert.equal(customApps([{ name: "n", child: "n", props: { a: 1 } }]).n.props, undefined);
});

const layout = {
  id: "root", type: "row",
  floating: [{ id: "queue", content: { mod: "cockpit" } }],
  children: [{ id: "main-area", type: "column", children: [{ id: "center", type: "stack", active: "home", children: [{ id: "home", type: "block" }, { id: "inbox", type: "block" }] }] }],
};

test("the layout gets each missing block of your own that names a mod, at the end of the center stack", () => {
  const custom = customApps([
    { name: "notes", child: "notes", mod: "notes-panel", props: { board: "ENG" } },
    { name: "inbox2", child: "inbox", mod: "other" },
    { name: "queue", child: "queue", mod: "other" },
    { name: "plain", child: "plain" },
  ]);
  const next = withOwnBlocks(layout, custom);
  const center = next.children[0].children[0];
  assert.deepEqual(center.children.map((c) => c.id), ["home", "inbox", "notes"]);
  assert.deepEqual(center.children[2].content, { mod: "notes-panel", props: { board: "ENG" } });
  assert.equal(center.active, "home");
  assert.equal(layout.children[0].children[0].children.length, 2, "the layout given stays as it was");
  assert.equal(withOwnBlocks(next, custom), null, "a block already there is not added twice");
  assert.equal(withOwnBlocks({ id: "root", type: "row", children: [] }, custom), null);
});

test("a badge is due when it carries no time or is older than every; a command's answer is its last line", () => {
  assert.equal(badgeDue(null, 300, 1_000_000), true);
  assert.equal(badgeDue({ count: 2 }, 300, 1_000_000), true);
  assert.equal(badgeDue({ count: 2, at: 900_000 }, 300, 1_000_000), false);
  assert.equal(badgeDue({ count: 2, at: 600_000 }, 300, 1_000_000), true);
  assert.deepEqual(parseBadge('log\n{"count": 3, "tone": "warning"}\n'), { count: 3, tone: "warning" });
  assert.deepEqual(parseBadge('{"count": 0}'), { count: 0 });
  assert.equal(parseBadge("null"), null);
  assert.equal(parseBadge("not json"), null);
  assert.equal(parseBadge('{"count": -1}'), null);
});

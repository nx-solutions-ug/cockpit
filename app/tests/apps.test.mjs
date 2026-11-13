import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SPACES, customApps, pinnedApps, spaceNames } from "../mods/cockpit/apps.js";

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

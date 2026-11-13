// The pinned apps the sidebar shows, from the config's `spaces`: cockpit's own apps by name, and blocks of your own as
// `{name, child, label, icon, key}`, where `child` is the id of a block in the cockpit layout's `center` stack.

/** cockpit's own apps, by space name: label, icon, the key bound to them, and the center block when it is not the name. */
export const APPS = {
  inbox: { label: "Inbox", icon: "inbox", key: "⌘⌥1" },
  runbook: { label: "Runbook", icon: "book", key: "⌘⌥2" },
  "to-do": { child: "todo", label: "To-do", icon: "list-todo", key: "⌘⌥3" },
  meetings: { label: "Meetings", icon: "calendar", key: "⌘⌥4" },
  monitor: { label: "Monitor", icon: "activity", key: "⌘⌥5" },
  routines: { label: "Routines", icon: "clock", key: "⌘⌥6" },
  mail: { label: "Mail", icon: "mail", key: "⌘⌥7" },
};

export const DEFAULT_SPACES = ["inbox", "terminal", "actions", "to-do", "runbook", "meetings"];

/** The pinned spaces' names, in order: a string, or an object's `name`. */
export function spaceNames(spaces) {
  return Array.isArray(spaces) ? spaces.map((s) => (typeof s === "string" ? s : s?.name)).filter((n) => typeof n === "string" && n) : DEFAULT_SPACES;
}

/** The blocks of your own among the pinned spaces, by name: the objects with a `child`. */
export function customApps(spaces) {
  const out = {};
  for (const s of Array.isArray(spaces) ? spaces : []) {
    if (!s || typeof s !== "object" || typeof s.name !== "string" || !s.name || typeof s.child !== "string" || !s.child) continue;
    out[s.name] = { child: s.child, label: s.label || s.name, icon: s.icon || "app-window", ...(s.key ? { key: s.key } : {}) };
  }
  return out;
}

/** The apps to show, in the given order of names: each `{name, child, label, icon, key?}`; other spaces are left out. */
export function pinnedApps(names, custom = {}) {
  return names.flatMap((name) => {
    const app = APPS[name] ?? custom[name];
    return app ? [{ name, ...app, child: app.child ?? name }] : [];
  });
}

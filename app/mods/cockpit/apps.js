// The pinned apps the sidebar shows, from the config's `spaces`: cockpit's own apps by name, and blocks of your own as
// `{name, child, label, icon, key, mod, props, badge}`, where `child` is the id of a block in the cockpit layout's `center`
// stack.

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

/** The blocks of your own among the pinned spaces, by name: the objects with a `child`, with the mod that fills the block
 *  and the command that counts its badge while the block has not started, when the entry gives them. */
export function customApps(spaces) {
  const out = {};
  for (const s of Array.isArray(spaces) ? spaces : []) {
    if (!s || typeof s !== "object" || typeof s.name !== "string" || !s.name || typeof s.child !== "string" || !s.child) continue;
    out[s.name] = {
      child: s.child,
      label: s.label || s.name,
      icon: s.icon || "app-window",
      ...(s.key ? { key: s.key } : {}),
      ...(typeof s.mod === "string" && s.mod ? { mod: s.mod, ...(s.props && typeof s.props === "object" ? { props: s.props } : {}) } : {}),
      ...(badgeCommand(s.badge) ? { badge: badgeCommand(s.badge) } : {}),
    };
  }
  return out;
}

/** An entry's `badge`, `{run: [program, ...args], every?: seconds}`, with `every` at least a minute (five by default). */
function badgeCommand(badge) {
  const run = badge?.run;
  if (!Array.isArray(run) || !run.length || !run.every((a) => typeof a === "string") || !run[0]) return null;
  const every = Number(badge.every);
  return { run, every: Number.isFinite(every) && every >= 60 ? every : 300 };
}

/** The look of a block the sidebar adds, the same as cockpit's own apps in the center stack. */
const BLOCK_LOOK = { background: "background", border: { width: 1, color: "border" }, radius: 10, shadow: "sm" };

/** The layout with a block added to its `center` stack for each block of your own that names a mod and is missing, or
 *  null when none is: the layout file is written again by `cockpit app install`, the config keeps the block. */
export function withOwnBlocks(layout, custom = {}) {
  const center = findNode(layout, "center");
  if (!center || center.type !== "stack" || !Array.isArray(center.children)) return null;
  const ids = new Set();
  collectIds(layout, ids);
  const missing = Object.values(custom).filter((a) => a.mod && !ids.has(a.child));
  if (!missing.length) return null;
  const blocks = missing.map((a) => ({ id: a.child, type: "block", content: { mod: a.mod, ...(a.props ? { props: a.props } : {}) }, ...BLOCK_LOOK }));
  return replaceNode(layout, "center", { ...center, children: [...center.children, ...blocks] });
}

function findNode(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.id === id) return node;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

function collectIds(node, ids) {
  if (!node || typeof node !== "object") return;
  if (typeof node.id === "string") ids.add(node.id);
  for (const child of Array.isArray(node.children) ? node.children : []) collectIds(child, ids);
  for (const float of Array.isArray(node.floating) ? node.floating : []) collectIds(float, ids);
}

function replaceNode(node, id, by) {
  if (node?.id === id) return by;
  if (!Array.isArray(node?.children)) return node;
  return { ...node, children: node.children.map((c) => replaceNode(c, id, by)) };
}

/** Whether a block's badge is older than `every` seconds: `at` is when its mod or the badge command last set it. */
export function badgeDue(badge, every, now = Date.now()) {
  const at = Number(badge?.at);
  return !Number.isFinite(at) || now - at >= every * 1000;
}

/** A badge command's answer, its last line: `{count, tone?}`, or null for none (and for anything else). */
export function parseBadge(stdout) {
  try {
    const out = JSON.parse(String(stdout ?? "").trim().split("\n").pop() || "null");
    if (!out || typeof out !== "object" || !Number.isFinite(out.count) || out.count < 0) return null;
    return { count: Math.floor(out.count), ...(typeof out.tone === "string" && out.tone ? { tone: out.tone } : {}) };
  } catch {
    return null;
  }
}

/** The apps to show, in the given order of names: each `{name, child, label, icon, key?}`; other spaces are left out. */
export function pinnedApps(names, custom = {}) {
  return names.flatMap((name) => {
    const app = APPS[name] ?? custom[name];
    return app ? [{ name, ...app, child: app.child ?? name }] : [];
  });
}

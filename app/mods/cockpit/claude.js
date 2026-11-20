// What a Claude Code session tells about itself, for the sidebar's agent rows: the context left (Claude Code's own
// figure over its model's window, which the plugin's session.measure hook reports to the hub), the status line the
// agent reports to herdr-core, and on demand its model, turn and last activity. Pure: the host's reads come in as `io`.

/** The context left of a row's used percentage, with its level: `low` under 25%, `critical` under 10%; null when the
 *  agent reports none (another agent, or Claude Code before its first answer). */
export function contextLeft(used) {
  if (typeof used !== "number" || !Number.isFinite(used)) return null;
  const left = Math.max(0, Math.min(100, Math.round(100 - used)));
  return { left, level: left < 10 ? "critical" : left < 25 ? "low" : "ok" };
}

/** The status line an agent reported (OSC 7501 `msg`), as herdr-core keeps it on the terminal. */
export function statusLine(term) {
  const msg = term?.report?.msg ?? term?.status_msg ?? (typeof term?.status === "object" ? term.status?.msg : null);
  return typeof msg === "string" && msg.trim() ? msg.trim() : null;
}

export function turnOf(term) {
  return typeof term?.turn === "number" ? term.turn : null;
}

/** The model of the last assistant message in a transcript's tail (JSON lines, the first one possibly cut). */
export function lastModel(text) {
  if (!text) return null;
  let found = null;
  for (const m of text.matchAll(/"model":"([^"]+)"/g)) if (m[1] !== "<synthetic>") found = m[1];
  return found;
}

/** A model id as people say it: claude-opus-5-5 → Opus 5.5, claude-sonnet-4-6[1m] → Sonnet 4.6 [1m]; others stay. */
export function modelName(id) {
  if (!id) return null;
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[[^\]]+\])?$/.exec(id);
  if (!m) return id;
  const family = m[1][0].toUpperCase() + m[1].slice(1);
  return `${family} ${m[2]}${m[3] ? `.${m[3]}` : ""}${m[4] ? ` ${m[4]}` : ""}`;
}

/** The two windows the sidebar shows side by side, 5h then 7d; a window Claude Code doesn't report is `missing`. */
export function quotaSlots(quota) {
  const by = new Map((quota ?? []).map((q) => [q.name, q]));
  return ["5h", "7d"].map((name) => by.get(name) ?? { name, missing: true });
}

const SESSION = /^[0-9a-f-]{8,64}$/i;
const TAIL = 262144;

/** Model, turn and last activity of the rows hovered, loaded once per session and turn; `io` = {facts(), tail(session)}. */
export class Details {
  constructor(io) {
    this.io = io;
    this.cache = new Map();
    this.loading = new Set();
  }

  /** What is known for the row (`{model, last, lastText}`), or null before the first read. */
  get(row) {
    return this.cache.get(row?.terminal) ?? null;
  }

  /** Whether the row wants a read: nothing yet for its session and turn, and none running. */
  due(row, turn) {
    const key = row?.terminal;
    if (!key || this.loading.has(key)) return false;
    const hit = this.cache.get(key);
    return !hit || hit.turn !== turn || hit.session !== row.session;
  }

  async load(row, turn) {
    const key = row.terminal;
    this.loading.add(key);
    try {
      const facts = (await this.io.facts().catch(() => null))?.[key] ?? null;
      const session = row.session ?? facts?.session ?? null;
      const tail = session && SESSION.test(session) ? await this.io.tail(session).catch(() => null) : null;
      const last = facts?.last ?? null;
      this.cache.set(key, {
        session: row.session,
        turn,
        model: lastModel(tail) ?? this.cache.get(key)?.model ?? null,
        last: last?.at ?? facts?.at ?? null,
        lastText: last?.text ?? null,
      });
    } finally {
      this.loading.delete(key);
    }
  }
}

/** The transcript tail of a session, its newest file under ~/.claude/projects, through one shell. */
export const TAIL_SCRIPT = `f=$(ls -t "$HOME"/.claude/projects/*/"$1".jsonl 2>/dev/null | head -n 1); [ -n "$f" ] && tail -c ${TAIL} "$f"`;

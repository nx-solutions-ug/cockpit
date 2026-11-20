//! The Mailbox another frontend publishes into the hub (the "mailbox" document) as the inbox's first section: its groups,
//! labels, order and rows as published, so the inbox and that Mailbox show the same items.

use cockpit_core::theme::{ORANGE, RED, dim, fg};
use ratatui::style::Style;
use ratatui::text::{Line, Span};
use serde_json::{Value, json};

use crate::facts::{self, list, s};
use crate::icons::icon;
use crate::model::{heading, strong};
use crate::row::{Call, Kind, Row, RowAct, call};

pub const VERSION: i64 = 1;
pub const SECTION: &str = "Needs you";
/// A document older than three of its publisher's heartbeats (five minutes each) says its publisher stopped.
pub const STALE_MS: i64 = 15 * 60_000;

/// The document when it is there and of this version.
pub fn usable(doc: Option<&Value>) -> Option<&Value> {
    doc.filter(|d| d["version"].as_i64() == Some(VERSION))
}

/// How many rows it lists as open, None without a usable document.
pub fn open_count(doc: Option<&Value>) -> Option<u64> {
    usable(doc).map(|d| d["open"].as_u64().unwrap_or(0))
}

fn look(kind: &str) -> (&'static str, Style) {
    match kind {
        "blocked" => ("waiting", fg(ORANGE)),
        "release" => ("rocket", fg(RED)),
        "routine" => ("fail", fg(RED)),
        "reply" => ("changes", fg(ORANGE)),
        "draft" => ("plan", dim()),
        "wait" => ("pr", fg(RED)),
        "done" => ("ok", dim()),
        _ => ("alert", dim()),
    }
}

/// The row's way in, through the hub's `mailbox_go`, which checks the target before it opens anything.
fn target_act(target: &Value) -> Option<(RowAct, Call)> {
    let label = match s(target, "type") {
        _ if s(target, "id").is_empty() => return None,
        "url" | "file" => "open",
        "terminal" => "focus",
        "monitor" | "routine" => "show",
        _ => return None,
    };
    let go = || call("mailbox_go", vec![target.clone()]);
    Some((RowAct::new(label, 'o', go()).main(), go()))
}

fn item_row(kind: &str, n: usize, item: &Value, group_sub: &str) -> Row {
    let (glyph, style) = look(kind);
    let title = s(item, "title").to_string();
    let sub = if s(item, "sub").is_empty() { group_sub } else { s(item, "sub") };
    let age = item["at"].as_i64().map(|at| facts::ago(&facts::iso(at))).unwrap_or_default();
    let target = &item["target"];
    let mut spans = vec![Span::styled(format!(" {}  ", icon(glyph)), style), Span::raw(title.clone())];
    for note in [sub, age.as_str()].into_iter().filter(|t| !t.is_empty()) {
        spans.push(Span::styled(format!("   {note}"), dim()));
    }
    let place = s(target, "id");
    let info = vec![
        Line::styled(title.clone(), strong()),
        Line::styled([sub, age.as_str()].into_iter().filter(|t| !t.is_empty()).collect::<Vec<_>>().join(" · "), dim()),
        Line::styled(place.to_string(), dim()),
    ];
    let key = if place.is_empty() { format!("mailbox:{kind}:{n}") } else { format!("mailbox:{kind}:{place}") };
    let row = Row::text(key, Line::from(spans)).name(title).info(info).section(SECTION).kind(Kind::Mail).item(item);
    match target_act(target) {
        Some((act, primary)) => row.acts(vec![act]).primary(primary),
        None => row,
    }
}

fn group(kind: &str, label: &str, items: &[Value], sub: &str) -> Row {
    let (glyph, style) = look(kind);
    let line = Line::from(vec![
        Span::styled(format!("{}  ", icon(glyph)), style),
        Span::styled(label.to_string(), strong()),
        Span::styled(format!("  {}", items.len()), dim()),
    ]);
    let mut row = Row::text(format!("mailbox:{kind}"), line).name(label.to_string()).section(SECTION);
    for (n, item) in items.iter().enumerate() {
        row.add(item_row(kind, n, item, sub));
    }
    row
}

/// The section: the open groups in the published order, the publisher's notes, a line when it stopped publishing, and
/// its Done rows folded away. None without a usable document.
pub fn section(doc: Option<&Value>) -> Option<Row> {
    let doc = usable(doc)?;
    let by = if s(doc, "by").is_empty() { "the Mailbox" } else { s(doc, "by") };
    let at = doc["at"].as_i64();
    let stale = at.is_none_or(|at| facts::age_ms(at) > STALE_MS);
    let mut extra = format!("{} open", doc["open"].as_u64().unwrap_or(0));
    if let Some(seen) = doc["seen"].as_u64().filter(|n| *n > 0) {
        extra += &format!(" · {seen} seen");
    }
    if let Some(at) = at {
        extra += &format!(" · {by} {}", facts::clock(&json!(at)));
    }
    let mut top = Row::text("mailbox", heading("inbox", SECTION, &extra)).section(SECTION);
    if stale {
        let since = at.map_or(String::new(), |at| format!(" since {}", facts::clock(&json!(at))));
        top.add(Row::text("mailbox:stale", Line::styled(format!("{by} has not published{since}: these rows may be old"), fg(ORANGE))).section(SECTION));
    }
    for (n, note) in list(doc, "notes").iter().filter_map(Value::as_str).enumerate() {
        top.add(Row::text(format!("mailbox:note:{n}"), Line::styled(note.to_string(), dim())).section(SECTION));
    }
    let mut shown = 0;
    for g in list(doc, "groups") {
        let items = list(g, "items");
        if !items.is_empty() {
            shown += items.len();
            top.add(group(s(g, "kind"), s(g, "label"), items, s(g, "sub")));
        }
    }
    if shown == 0 {
        top.add(Row::text("mailbox:empty", Line::styled("Nothing needs you.", dim())).section(SECTION));
    }
    let done = &doc["done"];
    if !list(done, "items").is_empty() {
        let label = if s(done, "label").is_empty() { "Done" } else { s(done, "label") };
        top.add(group("done", label, list(done, "items"), "").folded());
    }
    Some(top)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc() -> Value {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/mailbox.json");
        serde_json::from_str(&std::fs::read_to_string(path).expect("the fixture")).expect("JSON")
    }

    fn keys(row: &Row) -> Vec<String> {
        row.children.iter().flat_map(|g| g.children.iter().map(|r| r.key.clone())).collect()
    }

    #[test]
    fn every_published_item_shows_in_the_published_order() {
        facts::freeze("2026-10-28T10:00:00Z");
        let published = doc();
        let top = section(Some(&published)).expect("a section");
        let items: Vec<&Value> = list(&published, "groups").iter().flat_map(|g| list(g, "items")).collect();
        let open: Vec<&Row> = top.children.iter().filter(|g| g.key != "mailbox:done").flat_map(|g| &g.children).collect();
        assert_eq!(open.len() as u64, published["open"].as_u64().unwrap());
        assert_eq!(open.iter().map(|r| r.name.as_str()).collect::<Vec<_>>(), items.iter().map(|i| s(i, "title")).collect::<Vec<_>>());
        let groups: Vec<&str> = top.children.iter().map(|g| g.name.as_str()).collect();
        assert_eq!(
            groups,
            [
                "Jira (twg): reading comments — replies follow",
                "Blocked workers",
                "Bad releases",
                "Failed routines",
                "Replies owed",
                "Drafts waiting for a yes",
                "CI / review waits",
                "Done"
            ]
        );
        assert!(!top.children.last().unwrap().expand, "Done is folded away");
        assert!(keys(&top).contains(&"mailbox:wait:https://github.com/acme/api/pull/2219".to_string()));
    }

    #[test]
    fn each_row_leads_where_the_mailbox_does() {
        facts::freeze("2026-10-28T10:00:00Z");
        let top = section(Some(&doc())).expect("a section");
        let row = |key: &str| top.children.iter().flat_map(|g| &g.children).find(|r| r.key == key).expect(key);
        let first = |r: &Row| r.primary.as_ref().map(|c| (c.function, c.args.clone()));
        let reply = json!({"type": "url", "id": "https://acme.example/browse/ENG-412"});
        assert_eq!(first(row("mailbox:reply:https://acme.example/browse/ENG-412")), Some(("mailbox_go", vec![reply])));
        assert_eq!(row("mailbox:reply:https://acme.example/browse/ENG-412").acts[0].act.label, "open");
        assert_eq!(first(row("mailbox:blocked:t3")), Some(("mailbox_go", vec![json!({"type": "terminal", "id": "t3"})])));
        assert_eq!(first(row("mailbox:routine:nightly-digest")), Some(("mailbox_go", vec![json!({"type": "routine", "id": "nightly-digest"})])));
        assert_eq!(row("mailbox:release:web").acts[0].act.label, "show");
    }

    #[test]
    fn an_old_document_says_so_and_another_version_shows_nothing() {
        facts::freeze("2026-10-28T10:00:00Z");
        let mut old = doc();
        old["at"] = json!(old["at"].as_i64().unwrap() - STALE_MS);
        let top = section(Some(&old)).expect("a section");
        assert_eq!(top.children[0].key, "mailbox:stale");
        assert!(section(Some(&json!({"version": 2}))).is_none());
        assert!(section(None).is_none());
        let empty = json!({"version": 1, "by": "hyper-linux", "at": doc()["at"], "open": 0, "groups": [], "done": {"items": []}});
        assert_eq!(section(Some(&empty)).unwrap().children.iter().map(|r| r.key.as_str()).collect::<Vec<_>>(), ["mailbox:empty"]);
    }
}

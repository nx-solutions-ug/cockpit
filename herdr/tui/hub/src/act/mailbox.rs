//! Where a Mailbox row leads (the "mailbox" document another frontend publishes): a link or file opens, a terminal comes
//! into view, a release or a routine shows in its own space.

use std::path::Path;

use cockpit_core::frontend;
use serde_json::{Value, json};

use super::{Ctx, arg};
use crate::config;
use crate::value::Res;

/// What a Mailbox target asks for, checked: the document comes from outside the hub.
#[derive(Debug, PartialEq)]
enum Place {
    Open(String),
    Terminal(String),
    App(&'static str, String),
}

fn place(target: &Value) -> Res<Place> {
    let id = target["id"].as_str().unwrap_or_default();
    let plain = |id: &str| !id.is_empty() && id.len() <= 200 && id.chars().all(|c| c.is_ascii_alphanumeric() || "-_.:/".contains(c));
    match target["type"].as_str().unwrap_or_default() {
        "url" if id.starts_with("https://") || id.starts_with("http://") => Ok(Place::Open(id.to_string())),
        "file" if Path::new(id).is_absolute() && !id.contains("..") => Ok(Place::Open(id.to_string())),
        "terminal" if plain(id) && !id.contains('/') => Ok(Place::Terminal(id.to_string())),
        "monitor" if plain(id) => Ok(Place::App("monitor", id.to_string())),
        "routine" if plain(id) => Ok(Place::App("routines", id.to_string())),
        kind => Err(format!("cannot open a {} target {id:?}", if kind.is_empty() { "missing" } else { kind })),
    }
}

/// Opens a Mailbox row's target: `mailbox_go [{type, id}]`.
pub fn go(ctx: &mut Ctx, args: &[Value]) -> Res {
    match place(arg(args, 0)?)? {
        Place::Open(what) => {
            config::open_url(&what);
            ctx.note(format!("opened {what}"));
        }
        Place::Terminal(address) => {
            if !frontend::focus(&format!("{}{address}", frontend::APP)) {
                return Err(format!("terminal {address} is not in the Herdr app"));
            }
        }
        Place::App(app, key) => {
            let done = crate::go::go(&json!({"app": app, "key": key}));
            if let Some(error) = done["error"].as_str() {
                return Err(error.to_string());
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_target_leads_to_its_place() {
        let at = |kind: &str, id: &str| place(&json!({"type": kind, "id": id}));
        assert_eq!(at("url", "https://acme.example/browse/ENG-412"), Ok(Place::Open("https://acme.example/browse/ENG-412".into())));
        assert_eq!(at("file", "/home/me/.cache/handoffs/api/eng-412-drafts.md"), Ok(Place::Open("/home/me/.cache/handoffs/api/eng-412-drafts.md".into())));
        assert_eq!(at("terminal", "t3"), Ok(Place::Terminal("t3".into())));
        assert_eq!(at("monitor", "web"), Ok(Place::App("monitor", "web".into())));
        assert_eq!(at("routine", "nightly-digest"), Ok(Place::App("routines", "nightly-digest".into())));
    }

    #[test]
    fn a_target_from_outside_is_checked() {
        let at = |kind: &str, id: &str| place(&json!({"type": kind, "id": id}));
        assert!(at("url", "file:///etc/passwd").is_err());
        assert!(at("url", "-x").is_err());
        assert!(at("file", "relative/drafts.md").is_err());
        assert!(at("file", "/home/me/../../etc/shadow").is_err());
        assert!(at("terminal", "t3; rm -rf").is_err());
        assert!(at("terminal", "a/b").is_err());
        assert!(at("monitor", "").is_err());
        assert!(at("shell", "ls").is_err());
        assert!(place(&Value::Null).is_err());
    }
}

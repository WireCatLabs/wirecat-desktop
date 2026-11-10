use crate::catalog::{self, Tool};
use crate::redact::Names;
use crate::tools;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::mpsc::{self, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

// A doctor or a report waits this long; a listing that answers later still fills the cache for the next one.
const WAIT: Duration = Duration::from_secs(10);
const LISTING_TIMEOUT: Duration = Duration::from_mins(1);

type Key = (String, String, usize);

/// Kept in memory for the life of the app and never written, logged or sent: these are the names being hidden.
/// A listing that failed is not kept, so the next doctor or report asks again.
fn cache() -> &'static Mutex<HashMap<Key, Vec<String>>> {
    static C: OnceLock<Mutex<HashMap<Key, Vec<String>>>> = OnceLock::new();
    C.get_or_init(Mutex::default)
}

/// The names of chats and contacts that the given tools keep for every one of their profiles. A tool too old to list
/// them offline, or one that does not answer in time, adds nothing; the rest are still masked.
pub fn known(tools: impl IntoIterator<Item = &'static Tool>) -> Names {
    let (tx, rx) = mpsc::channel();
    for tool in tools.into_iter().filter(|t| t.names.is_some() && tools::installed(t)) {
        let tx = tx.clone();
        std::thread::spawn(move || of_tool(tool, &tx));
    }
    drop(tx);
    let deadline = Instant::now() + WAIT;
    let (mut names, mut profiles) = (Vec::new(), Vec::new());
    while let Some(left) = deadline.checked_duration_since(Instant::now()) {
        match rx.recv_timeout(left) {
            Ok(Found::Profile(p)) => profiles.push(p),
            Ok(Found::Names(n)) => names.extend(n),
            Err(_) => break,
        }
    }
    Names::new(names, &profiles)
}

/// Every installed messenger, for a report: its text may name anyone from any of them.
pub fn all_known() -> Names {
    known(catalog::catalog().tools.iter())
}

enum Found {
    Profile(String),
    Names(Vec<String>),
}

/// Each profile is read by the name the tool lists, never a default one.
fn of_tool(tool: &'static Tool, tx: &Sender<Found>) {
    let (Some(commands), Ok(Some(profiles))) = (&tool.names, tools::profiles(tool)) else { return };
    for profile in profiles {
        let _ = tx.send(Found::Profile(profile.name.clone()));
        for (i, args) in commands.iter().enumerate() {
            let key = (tool.id.clone(), profile.name.clone(), i);
            if let Some(hit) = cache().lock().ok().and_then(|c| c.get(&key).cloned()) {
                let _ = tx.send(Found::Names(hit));
                continue;
            }
            let tx = tx.clone();
            let profile = profile.name.clone();
            std::thread::spawn(move || {
                if let Some(found) = listing(tool, &profile, args) {
                    if let Ok(mut c) = cache().lock() {
                        c.insert(key, found.clone());
                    }
                    let _ = tx.send(Found::Names(found));
                }
            });
        }
    }
}

fn listing(tool: &Tool, profile: &str, args: &[String]) -> Option<Vec<String>> {
    let bin = tools::program(&tool.bin)?;
    let args = catalog::with_profile(args, Some(profile)).ok()?;
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = crate::memo_server::run_tool(tool, &bin, &refs, LISTING_TIMEOUT).ok()?;
    if out.code != Some(0) {
        return None;
    }
    Some(names_in(&out.json()?))
}

/// A chat's `title`; a contact's `name`, the owner's `alias` for them, `display_name` and `username`.
fn names_in(listing: &Value) -> Vec<String> {
    let fields = ["/title", "/name", "/alias", "/display_name", "/username", "/provider_metadata/username"];
    listing["items"]
        .as_array()
        .into_iter()
        .flatten()
        .flat_map(|item| fields.iter().filter_map(|f| item.pointer(f)?.as_str()))
        .map(str::to_string)
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn reads_titles_names_and_usernames_from_the_listings() {
        let chats = json!({"items": [
            {"id": "7", "title": "Book club", "kind": "group"},
            {"id": "21", "title": "Adam", "provider_metadata": {"username": "adam_k"}}
        ]});
        let contacts = json!({"items": [{"id": "21", "name": "Adam", "username": "adam_k", "alias": "Адам", "description": null}]});
        assert_eq!(super::names_in(&chats), ["Book club", "Adam", "adam_k"]);
        assert_eq!(super::names_in(&contacts), ["Adam", "Адам", "adam_k"]);
        assert_eq!(super::names_in(&json!({"error": {"code": "validation_error"}})), Vec::<String>::new());
    }

    #[test]
    fn only_the_messengers_list_names_and_each_listing_stays_offline_and_unrecorded() {
        for tool in &crate::catalog::catalog().tools {
            match tool.id.as_str() {
                "tg" | "max" | "wa" => {
                    for args in tool.names.as_ref().expect("a messenger lists names") {
                        assert_eq!(args[0], "{profile}");
                        for flag in ["--offline", "--no-record", "--json"] {
                            assert!(args.contains(&flag.to_string()), "{} lacks {flag}", tool.id);
                        }
                    }
                }
                _ => assert!(tool.names.is_none(), "{} lists names", tool.id),
            }
        }
    }
}

//! The owner's changes to a relationship, and decisions on many relationship proposals at once. A proposal is
//! `relationship:<id>` (memo's review id), a link that holds is `link:<id>`; memo changes only a link, so a proposal
//! whose role the owner changes is confirmed first and the link it made is changed.

use crate::memory::{Call, REJECTED_HERE, decision, text, with_memo};
use crate::skills::body;
use serde::Serialize;
use serde_json::Value;

const LINK: &str = "link:";
const PROPOSAL: &str = "relationship:";
const MAX_ROLE: usize = 80;
/// `review confirm` takes many ids in one call; a group past this is sent in parts so one command line stays short.
const BATCH: usize = 100;

fn id_after<'a>(reference: &'a str, prefix: &str) -> Option<&'a str> {
    reference
        .strip_prefix(prefix)
        .filter(|id| !id.is_empty() && id.len() <= 15 && id.bytes().all(|b| b.is_ascii_digit()))
}

fn role_word(role: Option<&str>) -> Result<String, String> {
    let r = role.unwrap_or("").trim();
    if r.chars().count() > MAX_ROLE || r.chars().any(char::is_control) || r.starts_with('-') {
        return Err(format!("A role is at most {MAX_ROLE} characters on one line."));
    }
    Ok(r.to_string())
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RelationEdited {
    /// The link that holds now: a confirmed proposal becomes `link:<id>`.
    #[serde(rename = "ref")]
    pub reference: String,
    pub role: Option<String>,
}

/// memo's first refusal in a `review` answer, in its own words.
fn refused(item: &Value) -> Option<String> {
    item["refused"].as_array().and_then(|a| a.first()).map(|r| {
        text(r, "reason")
            .or_else(|| text(r, "message"))
            .or_else(|| text(r, "code"))
            .unwrap_or_else(|| "Memo refused it".into())
    })
}

fn confirm_proposal(call: &Call, id: &str) -> Result<String, String> {
    let v = call(&decision(&["review", "confirm", id]))?;
    let item = body(&v);
    if let Some(why) = refused(item) {
        return Err(why);
    }
    item["decided"][0]["made"]
        .as_array()
        .and_then(|m| m.iter().filter_map(Value::as_str).find_map(|r| id_after(r, PROPOSAL)))
        .map(str::to_string)
        .ok_or_else(|| "Memo did not say which link the approval made".into())
}

fn edit_with(call: &Call, reference: &str, role: Option<&str>) -> Result<RelationEdited, String> {
    let role = role_word(role)?;
    let link = match (id_after(reference, LINK), id_after(reference, PROPOSAL)) {
        (Some(id), _) => id.to_string(),
        (None, Some(id)) => confirm_proposal(call, id)?,
        _ => return Err(format!("not a relationship: {reference}")),
    };
    let set_role = format!("--role={role}");
    call(&decision(&["relationships", "update", &link, &set_role]))?;
    Ok(RelationEdited { reference: format!("{LINK}{link}"), role: (!role.is_empty()).then_some(role) })
}

pub fn edit(reference: &str, role: Option<&str>) -> Result<RelationEdited, String> {
    with_memo(|call| edit_with(call, reference, role))
}

/// A link is removed; a proposal is turned down, as Reject does.
fn remove_with(call: &Call, reference: &str) -> Result<(), String> {
    if let Some(id) = id_after(reference, LINK) {
        let v = call(&decision(&["relationships", "remove", id]))?;
        return if body(&v)["removed"].as_bool() == Some(true) { Ok(()) } else { Err("Memo did not remove it".into()) };
    }
    let id = id_after(reference, PROPOSAL).ok_or_else(|| format!("not a relationship: {reference}"))?;
    let v = call(&decision(&["review", "reject", id, "--reason", REJECTED_HERE]))?;
    refused(body(&v)).map_or(Ok(()), Err)
}

pub fn remove(reference: &str) -> Result<(), String> {
    with_memo(|call| remove_with(call, reference))
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Decided {
    #[serde(rename = "ref")]
    pub reference: String,
    /// `confirmed` or `rejected` when memo decided it; `None` with `error` when it refused.
    pub status: Option<String>,
    pub error: Option<String>,
}

/// One `review confirm|reject` for many proposals: memo decides each on its own and lists the ones it refused.
fn decide_with(call: &Call, references: &[String], approve: bool) -> Result<Vec<Decided>, String> {
    let ids: Vec<&str> = references
        .iter()
        .map(|r| id_after(r, PROPOSAL).ok_or_else(|| format!("not a relationship proposal: {r}")))
        .collect::<Result<_, _>>()?;
    let mut out = Vec::with_capacity(ids.len());
    for part in ids.chunks(BATCH) {
        let mut args = vec!["review", if approve { "confirm" } else { "reject" }];
        args.extend(part);
        if !approve {
            args.extend(["--reason", REJECTED_HERE]);
        }
        let v = call(&decision(&args))?;
        let item = body(&v);
        let listed = |key: &str| item[key].as_array().cloned().unwrap_or_default();
        let (decided, refused) = (listed("decided"), listed("refused"));
        for id in part {
            let of = |list: &[Value]| list.iter().find(|d| text(d, "id").as_deref() == Some(id)).cloned();
            let reference = format!("{PROPOSAL}{id}");
            out.push(match (of(&decided), of(&refused)) {
                (Some(d), _) => Decided { reference, status: text(&d, "status"), error: None },
                (None, Some(r)) => Decided {
                    reference,
                    status: None,
                    error: text(&r, "reason")
                        .or_else(|| text(&r, "message"))
                        .or_else(|| Some("Memo refused it".into())),
                },
                (None, None) => Decided { reference, status: None, error: Some("Memo did not answer for it".into()) },
            });
        }
    }
    Ok(out)
}

pub fn decide(references: &[String], approve: bool) -> Result<Vec<Decided>, String> {
    with_memo(|call| decide_with(call, references, approve))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    fn strs(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| (*s).to_string()).collect()
    }

    fn run<T>(answer: impl Fn(&[String]) -> Value + Sync, f: impl FnOnce(&Call) -> T) -> (T, Vec<Vec<String>>) {
        let seen = Mutex::new(Vec::new());
        let call = |args: &[String]| {
            seen.lock().unwrap().push(args.to_vec());
            Ok(answer(args))
        };
        let out = f(&call);
        (out, seen.into_inner().unwrap())
    }

    // Shapes from memo 0.131.72 against a throwaway store.
    fn confirmed(made: &str) -> Value {
        json!({"item":{"decided":[{"id":"1","kind":"relationship","status":"confirmed","made":[made]}],"refused":[]}})
    }

    #[test]
    fn a_link_role_changes_in_one_update() {
        let (out, seen) =
            run(|_| json!({"item":{"id":"9","role":"manager"}}), |c| edit_with(c, "link:9", Some(" manager ")));
        assert_eq!(out.unwrap(), RelationEdited { reference: "link:9".into(), role: Some("manager".into()) });
        assert_eq!(
            seen,
            [strs(&["relationships", "update", "9", "--role=manager", "--from-app", "--json", "--no-record"])]
        );
    }

    #[test]
    fn a_proposal_is_approved_then_the_link_it_made_is_changed() {
        let (out, seen) = run(
            |a| if a[0] == "review" { confirmed("relationship:42") } else { json!({"item":{"id":"42"}}) },
            |c| edit_with(c, "relationship:1", None),
        );
        assert_eq!(out.unwrap(), RelationEdited { reference: "link:42".into(), role: None });
        assert_eq!(seen[0][..3], strs(&["review", "confirm", "1"]));
        assert_eq!(seen[1][..4], strs(&["relationships", "update", "42", "--role="]));
    }

    #[test]
    fn a_role_that_reads_as_an_option_or_spans_lines_is_refused() {
        for bad in ["--kind=x", "a\nb", &"x".repeat(81)] {
            let (out, seen) = run(|_| json!({}), |c| edit_with(c, "link:9", Some(bad)));
            assert!(out.is_err(), "{bad}");
            assert!(seen.is_empty());
        }
    }

    #[test]
    fn remove_takes_a_link_away_and_turns_a_proposal_down() {
        let (out, seen) = run(|_| json!({"item":{"id":"9","removed":true}}), |c| remove_with(c, "link:9"));
        assert!(out.is_ok());
        assert_eq!(seen[0][..3], strs(&["relationships", "remove", "9"]));
        let (out, seen) = run(
            |_| json!({"item":{"decided":[{"id":"3","status":"rejected"}],"refused":[]}}),
            |c| remove_with(c, "relationship:3"),
        );
        assert!(out.is_ok());
        assert_eq!(seen[0][..5], strs(&["review", "reject", "3", "--reason", REJECTED_HERE]));
    }

    #[test]
    fn many_proposals_are_decided_in_one_call_and_each_refusal_is_named() {
        let answer = |_: &[String]| {
            json!({"item":{"decided":[{"id":"4","kind":"relationship","status":"rejected","made":[]}],
                "refused":[{"id":"3","code":"validation_error","reason":"proposal.wrong-state","message":"3 is already rejected"}]}})
        };
        let refs = strs(&["relationship:3", "relationship:4"]);
        let (out, seen) = run(answer, |c| decide_with(c, &refs, false));
        assert_eq!(
            out.unwrap(),
            [
                Decided {
                    reference: "relationship:3".into(),
                    status: None,
                    error: Some("proposal.wrong-state".into())
                },
                Decided { reference: "relationship:4".into(), status: Some("rejected".into()), error: None },
            ]
        );
        assert_eq!(seen.len(), 1);
        assert_eq!(seen[0][..6], strs(&["review", "reject", "3", "4", "--reason", REJECTED_HERE]));
    }

    #[test]
    fn only_proposals_are_decided_together() {
        let (out, seen) = run(|_| json!({}), |c| decide_with(c, &strs(&["link:3"]), true));
        assert!(out.is_err());
        assert!(seen.is_empty());
    }
}

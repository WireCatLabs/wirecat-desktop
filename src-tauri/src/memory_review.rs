//! A memory or fact whose source changed, went or was contradicted: memo's `memory_source_review`, read with
//! `review show` (each source as it was cited and as it is now) and decided by the owner. Status never changes on its
//! own; every answer here is the owner's, so each passes `--from-app`. The source text is the owner's own, shown
//! unmasked like the rest of the Memory page, and never logged.

use crate::memory::{
    self, Call, Entry, Kind, Ref, SOURCE_REVIEW, decision, discard_with, show_with as read_back, strings, text,
    validate_text, words,
};
use crate::skills::body;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub id: String,
    pub cause: String,
    pub raised_at: Option<String>,
    pub sources: Vec<ReviewSource>,
    pub challenges: Vec<Challenge>,
    pub suggestions: Vec<Suggestion>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct ReviewSource {
    /// `None` once the store can no longer name it: erased.
    #[serde(rename = "ref")]
    pub reference: Option<String>,
    pub kind: Option<String>,
    pub cause: String,
    /// For `outdated`: the memory or fact that replaced the one cited.
    pub replacement: Option<String>,
    pub quote: Option<String>,
    /// The text as it was when the record cited it, and as it is now; memo cuts both at 2000 characters.
    pub cited: Option<String>,
    pub now: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Challenge {
    pub evidence: Vec<String>,
    pub reason: String,
    pub by: Option<String>,
    pub at: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Suggestion {
    pub author: Option<String>,
    pub body: String,
    pub at: Option<String>,
}

#[derive(Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Answer {
    /// It still holds: memo signs its sources again as they are now.
    StillTrue,
    /// The change does not matter; memo signs the sources again too, and keeps the owner's reason.
    Dismiss,
    /// It no longer holds and nothing replaced it: a memory goes stale, a decision is reversed.
    Withdraw,
}

fn review_id(id: &str) -> Result<&str, String> {
    if id.is_empty() || id.len() > 15 || !id.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("not a source review: {id}"));
    }
    Ok(id)
}

fn review_source(v: &Value) -> Option<ReviewSource> {
    Some(ReviewSource {
        reference: text(v, "ref"),
        kind: text(v, "kind"),
        cause: text(v, "cause")?,
        replacement: text(v, "replacement"),
        quote: text(v, "quote"),
        cited: text(v, "cited"),
        now: text(v, "now"),
    })
}

fn parse_review(id: &str, v: &Value) -> Option<Review> {
    let list = |key: &str| v[key].as_array().cloned().unwrap_or_default();
    Some(Review {
        id: id.to_string(),
        cause: text(v, "cause")?,
        raised_at: text(v, "raised_at"),
        sources: list("sources").iter().filter_map(review_source).collect(),
        challenges: list("challenges")
            .iter()
            .filter_map(|c| {
                Some(Challenge {
                    evidence: strings(&c["evidence"]),
                    reason: text(c, "reason")?,
                    by: text(c, "by"),
                    at: text(c, "at"),
                })
            })
            .collect(),
        suggestions: list("suggestions")
            .iter()
            .filter_map(|s| Some(Suggestion { author: text(s, "author"), body: text(s, "body")?, at: text(s, "at") }))
            .collect(),
    })
}

/// The review, checked to be a source review of `target`: an id from the page never decides some other proposal.
fn shown(call: &Call, target: &Ref, id: &str) -> Result<Value, String> {
    let v = call(&words(&["review", "show", review_id(id)?]))?;
    let item = body(&v);
    if text(item, "kind").as_deref() != Some(SOURCE_REVIEW) || text(item, "subject") != Some(target.memo()) {
        return Err("This review is not about this record any more. Read again.".into());
    }
    Ok(item.clone())
}

fn target(reference: &str) -> Result<Ref, String> {
    let r = Ref::parse(reference)?;
    if r.kind == Kind::Action {
        return Err("Only a memory or a fact has a source review.".into());
    }
    Ok(r)
}

fn show_with(call: &Call, reference: &str, id: &str) -> Result<Review, String> {
    let item = shown(call, &target(reference)?, id)?;
    parse_review(id, &item["source_review"]).ok_or_else(|| "Memo's answer did not describe the review".into())
}

pub fn show(reference: &str, id: &str) -> Result<Review, String> {
    memory::with_memo(|call| show_with(call, reference, id))
}

/// `review confirm` and `reject` decide each id on its own and exit 0 even when memo refused it, so the answer must
/// name this id as decided.
fn decided(v: &Value, id: &str) -> Result<(), String> {
    let item = body(v);
    let names = |key: &str| {
        item[key].as_array().into_iter().flatten().filter(|d| memory::id_of(&d["id"]).as_deref() == Some(id))
    };
    if let Some(no) = names("refused").next() {
        return Err(text(no, "reason").or_else(|| text(no, "message")).unwrap_or_else(|| "Memo refused it".into()));
    }
    if names("decided").next().is_none() {
        return Err("Memo did not say it decided the review.".into());
    }
    Ok(())
}

fn decide_with(call: &Call, reference: &str, id: &str, answer: Answer, reason: Option<&str>) -> Result<Entry, String> {
    let r = target(reference)?;
    shown(call, &r, id)?;
    let review = |verb: &str, extra: Vec<String>| -> Result<(), String> {
        let mut args = decision(&["review", verb, id]);
        args.extend(extra);
        decided(&call(&args)?, id)
    };
    match answer {
        Answer::StillTrue => review("confirm", vec![])?,
        Answer::Dismiss => {
            let why =
                validate_text(reason.unwrap_or_default()).map_err(|_| "Say in a few words why it does not matter.")?;
            // One word, so a reason that starts with `-` is never read as an option.
            review("reject", vec![format!("--reason={why}")])?;
        }
        // The page's own "no longer holds": a memory goes stale, an accepted decision is reversed. Never a revoke, which
        // would put the fact back to proposed.
        Answer::Withdraw => {
            discard_with(call, &r, false)?;
        }
    }
    read_back(call, &r)
}

pub fn decide(reference: &str, id: &str, answer: Answer, reason: Option<&str>) -> Result<Entry, String> {
    memory::with_memo(|call| decide_with(call, reference, id, answer, reason))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_string()).collect()
    }

    // The shape memo's `review show --json` gives a source review (cli-memo #710, `sourceReviewDetail`, snake_cased).
    fn review(subject: &str) -> Value {
        json!({"item":{"id":"17090","kind":"memory_source_review","status":"proposed","subject":subject,
            "source_review":{"cause":"changed","raised_at":"2026-11-07T10:00:00.000Z",
                "sources":[{"ref":"msg:telegram/1/77/42","kind":"message","cause":"changed","replacement":null,
                    "quote":"delivery on the 28th","cited":"we agreed delivery on the 28th","now":"we agreed delivery on the 30th"},
                    {"ref":null,"kind":"note","cause":"deleted","replacement":null,"quote":null,"cited":"[source erased]","now":null}],
                "challenges":[{"evidence":["note:15"],"reason":"the later note moves it","by":"claude-code","at":"2026-11-07T10:01:00.000Z"}],
                "suggestions":[{"author":"claude-code","body":"Delivery is on the 30th","evidence":["note:15"],"at":"2026-11-07T10:01:00.000Z"}],
                "decide":{"stillTrue":"memo review confirm 17090"},"untrusted":["sources.now"]}}})
    }

    fn memory(marker: &Value) -> Value {
        json!({"item":{"ref":"memory:3","kind":"summary","text":"Delivery is on the 28th","status":"confirmed",
            "scope":"work","author":{"type":"person"},"evidence":["msg:telegram/1/77/42"],
            "created_at":"2026-11-01T10:00:00.000Z","source_review":marker}})
    }

    struct Fake {
        seen: Mutex<Vec<Vec<String>>>,
        decided: Value,
    }

    impl Fake {
        #[expect(clippy::unnecessary_wraps, reason = "it stands in for a call to memo, which can fail")]
        fn call(&self, a: &[String]) -> Result<Value, String> {
            self.seen.lock().unwrap().push(a.to_vec());
            Ok(match (a[0].as_str(), a[1].as_str()) {
                ("review", "show") => review("memory:3"),
                ("review", _) => self.decided.clone(),
                _ => memory(&Value::Null),
            })
        }
    }

    fn fake(decided: Value) -> Fake {
        Fake { seen: Mutex::new(Vec::new()), decided }
    }

    #[test]
    fn reads_the_answers_the_interface_sends() {
        let answers: Vec<Answer> = serde_json::from_value(json!(["stillTrue", "dismiss", "withdraw"])).unwrap();
        assert_eq!(answers, [Answer::StillTrue, Answer::Dismiss, Answer::Withdraw]);
        assert!(serde_json::from_value::<Answer>(json!("correct")).is_err(), "Edit is the record's own correction");
    }

    #[test]
    fn reads_each_source_as_cited_and_as_it_is_now() {
        let f = fake(Value::Null);
        let r = show_with(&|a: &[String]| f.call(a), "memory:3", "17090").unwrap();
        assert_eq!(r.cause, "changed");
        assert_eq!(r.sources[0].cited.as_deref(), Some("we agreed delivery on the 28th"));
        assert_eq!(r.sources[0].now.as_deref(), Some("we agreed delivery on the 30th"));
        assert_eq!(r.sources[1].reference, None, "an erased source has no ref");
        assert_eq!(r.challenges[0].evidence, ["note:15"]);
        assert_eq!(r.suggestions[0].body, "Delivery is on the 30th");
        assert_eq!(f.seen.lock().unwrap()[0], strs(&["review", "show", "17090", "--json", "--no-record"]));
    }

    #[test]
    fn a_review_of_another_record_or_a_bad_id_is_refused_before_any_decision() {
        let f = fake(json!({"item":{"decided":[{"id":"17090"}],"refused":[]}}));
        let call = |a: &[String]| f.call(a);
        assert!(decide_with(&call, "memory:4", "17090", Answer::StillTrue, None).is_err());
        for bad in ["17090 ", "-1", "fact:2", ""] {
            assert!(show_with(&call, "memory:3", bad).is_err(), "{bad}");
        }
        assert!(show_with(&call, "action:3", "17090").is_err());
        assert!(f.seen.lock().unwrap().iter().all(|a| a[1] == "show"), "nothing was decided");
    }

    #[test]
    fn still_true_and_dismiss_are_the_owners_review_decisions() {
        let f = fake(json!({"item":{"decided":[{"id":"17090"}],"refused":[]}}));
        let call = |a: &[String]| f.call(a);
        let e = decide_with(&call, "memory:3", "17090", Answer::StillTrue, None).unwrap();
        assert_eq!(e.source_review, None, "the record read back has no open review");
        decide_with(&call, "memory:3", "17090", Answer::Dismiss, Some("-a typo fix")).unwrap();
        let seen = f.seen.lock().unwrap().clone();
        assert_eq!(seen[1], strs(&["review", "confirm", "17090", "--from-app", "--json", "--no-record"]));
        assert_eq!(seen[2], strs(&["memories", "show", "memory:3", "--json", "--no-record"]));
        assert_eq!(
            seen[4],
            strs(&["review", "reject", "17090", "--from-app", "--json", "--no-record", "--reason=-a typo fix"])
        );
        assert!(decide_with(&call, "memory:3", "17090", Answer::Dismiss, Some("  ")).is_err());
    }

    #[test]
    fn a_refusal_inside_a_zero_exit_answer_is_a_failure() {
        let f = fake(
            json!({"item":{"decided":[],"refused":[{"id":"17090","code":"permission_error","reason":"proposal.owner-only"}]}}),
        );
        let err = decide_with(&|a: &[String]| f.call(a), "memory:3", "17090", Answer::StillTrue, None).unwrap_err();
        assert_eq!(err, "proposal.owner-only");
    }

    #[test]
    fn an_answer_that_names_the_review_neither_decided_nor_refused_is_a_failure() {
        for answer in [json!({"item":{"decided":[],"refused":[]}}), json!({"item":{"decided":[{"id":"17091"}]}})] {
            let f = fake(answer);
            assert!(decide_with(&|a: &[String]| f.call(a), "memory:3", "17090", Answer::StillTrue, None).is_err());
        }
    }

    #[test]
    fn withdraw_uses_memos_own_verb_and_reads_the_record_back() {
        let f = Fake { seen: Mutex::new(Vec::new()), decided: Value::Null };
        decide_with(&|a: &[String]| f.call(a), "memory:3", "17090", Answer::Withdraw, None).unwrap();
        let seen = f.seen.lock().unwrap().clone();
        assert_eq!(seen[1], strs(&["memories", "invalidate", "memory:3", "--from-app", "--json", "--no-record"]));
        assert_eq!(seen[2], strs(&["memories", "show", "memory:3", "--json", "--no-record"]));

        let fact = |kind: &str, status: &str| {
            json!({"item":{"ref":"fact:4","kind":kind,"text":"Launch in spring","status":status,
                "author":{"type":"bot","name":"hermes"},"created_at":"2026-11-01T10:00:00.000Z"}})
        };
        let seen: Mutex<Vec<Vec<String>>> = Mutex::new(Vec::new());
        let decision = |a: &[String]| -> Result<Value, String> {
            seen.lock().unwrap().push(a.to_vec());
            let reversed = seen.lock().unwrap().iter().any(|a| a[1] == "reverse");
            Ok(if a[0] == "review" {
                review("fact:4")
            } else {
                fact("decision", if reversed { "reversed" } else { "accepted" })
            })
        };
        let e = decide_with(&decision, "fact:4", "17090", Answer::Withdraw, None).unwrap();
        assert_eq!(e.status, "reversed");
        assert!(
            seen.lock()
                .unwrap()
                .iter()
                .any(|a| a == &strs(&["facts", "reverse", "fact:4", "--from-app", "--json", "--no-record"]))
        );
        let promise = |a: &[String]| -> Result<Value, String> {
            Ok(if a[0] == "review" { review("fact:4") } else { fact("promise", "accepted") })
        };
        assert!(
            decide_with(&promise, "fact:4", "17090", Answer::Withdraw, None).is_err(),
            "memo has no withdraw for a fact that is not a decision, and it is never revoked instead"
        );
    }
}

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
    use crate::run;
    use serde_json::json;
    use std::sync::Mutex;

    // Real answers of cli-memo #710 on a throwaway store; see tests/fixtures/memory-review/README.md. Review 2 is a
    // changed source of memory:1, review 1 a deleted source of fact:1, review 3 an agent's challenge of memory:2.
    fn fixture(name: &str) -> Value {
        serde_json::from_str(match name {
            "review-changed" => include_str!("../tests/fixtures/memory-review/review-changed.json"),
            "review-deleted" => include_str!("../tests/fixtures/memory-review/review-deleted.json"),
            "review-contradicted" => include_str!("../tests/fixtures/memory-review/review-contradicted.json"),
            "confirm" => include_str!("../tests/fixtures/memory-review/confirm.json"),
            "reject" => include_str!("../tests/fixtures/memory-review/reject.json"),
            "refused" => include_str!("../tests/fixtures/memory-review/refused.json"),
            "mshow1" => include_str!("../tests/fixtures/memory-review/mshow1.json"),
            "invalidate" => include_str!("../tests/fixtures/memory-review/invalidate.json"),
            "fshow1" => include_str!("../tests/fixtures/memory-review/fshow1.json"),
            _ => panic!("no fixture {name}"),
        })
        .unwrap()
    }

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_string()).collect()
    }

    struct Fake {
        seen: Mutex<Vec<Vec<String>>>,
        decided: &'static str,
    }

    impl Fake {
        #[expect(clippy::unnecessary_wraps, reason = "it stands in for a call to memo, which can fail")]
        fn call(&self, a: &[String]) -> Result<Value, String> {
            self.seen.lock().unwrap().push(a.to_vec());
            let reversed = self.seen.lock().unwrap().iter().any(|a| a[1] == "reverse");
            Ok(match (a[0].as_str(), a[1].as_str(), a[2].as_str()) {
                ("review", "show", "1") => fixture("review-deleted"),
                ("review", "show", "3") => fixture("review-contradicted"),
                ("review", "show", _) => fixture("review-changed"),
                ("review", _, _) => fixture(self.decided),
                ("memories", "invalidate", _) | ("memories", "show", "memory:2") => fixture("invalidate"),
                ("memories", _, _) => fixture("mshow1"),
                ("facts", _, _) => {
                    let mut f = fixture("fshow1");
                    if reversed {
                        f["item"]["status"] = json!("reversed");
                    }
                    f
                }
                _ => Value::Null,
            })
        }
        fn seen(&self) -> Vec<Vec<String>> {
            self.seen.lock().unwrap().clone()
        }
    }

    fn fake(decided: &'static str) -> Fake {
        Fake { seen: Mutex::new(Vec::new()), decided }
    }

    #[test]
    fn memos_lists_carry_the_marker_the_page_shows() {
        let list = |text: &str| -> Value { serde_json::from_str(text).unwrap() };
        let memories = list(include_str!("../tests/fixtures/memory-review/mlist.json"));
        let facts = list(include_str!("../tests/fixtures/memory-review/flist.json"));
        let m = memory::parse_entry(&Ref::parse("memory:1").unwrap(), &json!({"item": memories["items"][0]})).unwrap();
        let f = memory::parse_entry(&Ref::parse("fact:1").unwrap(), &json!({"item": facts["items"][0]})).unwrap();
        assert_eq!(serde_json::to_value(m.source_review).unwrap(), json!({"id":"2","cause":"changed"}));
        assert_eq!(serde_json::to_value(f.source_review).unwrap(), json!({"id":"1","cause":"deleted"}));
    }

    #[test]
    fn reads_the_answers_the_interface_sends() {
        let answers: Vec<Answer> = serde_json::from_value(json!(["stillTrue", "dismiss", "withdraw"])).unwrap();
        assert_eq!(answers, [Answer::StillTrue, Answer::Dismiss, Answer::Withdraw]);
        assert!(serde_json::from_value::<Answer>(json!("correct")).is_err(), "Edit is the record's own correction");
    }

    #[test]
    fn reads_each_source_as_cited_and_as_it_is_now() {
        let f = fake("confirm");
        let call = |a: &[String]| f.call(a);
        let changed = show_with(&call, "memory:1", "2").unwrap();
        assert_eq!(changed.cause, "changed");
        assert_eq!(changed.sources[0].quote.as_deref(), Some("delivery on the 28th"));
        assert_eq!(changed.sources[0].cited.as_deref(), Some("We agreed delivery on the 28th with Lena."));
        assert_eq!(changed.sources[0].now.as_deref(), Some("We agreed delivery on the 30th with Lena."));
        let deleted = show_with(&call, "fact:1", "1").unwrap();
        assert_eq!((deleted.sources[0].reference.as_deref(), deleted.sources[0].kind.as_deref()), (None, Some("note")));
        assert_eq!(deleted.sources[0].cited, None, "memo keeps no text of a removed note");
        let contradicted = show_with(&call, "memory:2", "3").unwrap();
        assert_eq!(contradicted.challenges[0].by.as_deref(), Some("claude-code"));
        assert_eq!(contradicted.suggestions[0].body, "Kai prefers Friday afternoon calls");
        assert_eq!(f.seen()[0], strs(&["review", "show", "2", "--json", "--no-record"]));
    }

    #[test]
    fn a_review_of_another_record_or_a_bad_id_is_refused_before_any_decision() {
        let f = fake("confirm");
        let call = |a: &[String]| f.call(a);
        assert!(decide_with(&call, "memory:2", "2", Answer::StillTrue, None).is_err());
        for bad in ["2 ", "-1", "fact:2", ""] {
            assert!(show_with(&call, "memory:1", bad).is_err(), "{bad}");
        }
        assert!(show_with(&call, "action:3", "2").is_err());
        assert!(f.seen().iter().all(|a| a[1] == "show"), "nothing was decided");
    }

    #[test]
    fn still_true_and_dismiss_are_the_owners_and_read_the_record_back() {
        let f = fake("confirm");
        let e = decide_with(&|a: &[String]| f.call(a), "memory:1", "2", Answer::StillTrue, None).unwrap();
        assert_eq!(e.source_review, None);
        let seen = f.seen();
        assert_eq!(seen[1], strs(&["review", "confirm", "2", "--from-app", "--json", "--no-record"]));
        assert_eq!(seen[2], strs(&["memories", "show", "memory:1", "--json", "--no-record"]));
        let r = fake("reject");
        decide_with(&|a: &[String]| r.call(a), "fact:1", "1", Answer::Dismiss, Some("-moved to the drive")).unwrap();
        assert_eq!(
            r.seen()[1],
            strs(&["review", "reject", "1", "--from-app", "--json", "--no-record", "--reason=-moved to the drive"])
        );
        assert!(decide_with(&|a: &[String]| r.call(a), "fact:1", "1", Answer::Dismiss, Some("  ")).is_err());
    }

    #[test]
    fn a_refusal_memo_exits_2_with_is_its_reason() {
        let out = run::Output { code: Some(2), stdout: fixture("refused").to_string(), stderr: String::new() };
        let v = memory::answer(&out).unwrap();
        assert_eq!(decided(&v, "2"), Err("proposal.wrong-state".into()));
        let f = fake("refused");
        let err = decide_with(&|a: &[String]| f.call(a), "memory:1", "2", Answer::StillTrue, None).unwrap_err();
        assert_eq!(err, "proposal.wrong-state");
    }

    #[test]
    fn an_answer_that_names_the_review_neither_decided_nor_refused_is_a_failure() {
        let f = fake("confirm");
        assert!(decided(&fixture("confirm"), "3").is_err(), "the answer decided 2, not 3");
        assert!(decide_with(&|a: &[String]| f.call(a), "memory:2", "3", Answer::StillTrue, None).is_err());
    }

    #[test]
    fn withdraw_uses_memos_own_verb_and_reads_the_record_back() {
        let f = fake("confirm");
        let e = decide_with(&|a: &[String]| f.call(a), "memory:2", "3", Answer::Withdraw, None).unwrap();
        assert_eq!((e.status.as_str(), e.source_review.as_ref()), ("stale", None));
        let seen = f.seen();
        assert_eq!(seen[1], strs(&["memories", "invalidate", "memory:2", "--from-app", "--json", "--no-record"]));
        assert_eq!(seen[2], strs(&["memories", "show", "memory:2", "--json", "--no-record"]));
        let d = fake("confirm");
        let e = decide_with(&|a: &[String]| d.call(a), "fact:1", "1", Answer::Withdraw, None).unwrap();
        assert_eq!(e.status, "reversed");
        assert!(d.seen().contains(&strs(&["facts", "reverse", "fact:1", "--from-app", "--json", "--no-record"])));
    }
}

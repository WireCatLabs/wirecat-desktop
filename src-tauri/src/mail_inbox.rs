//! The Inbox tab of Digests: mail-cli's own `inbox`, which sorts new mail with the AI model the owner chose into needs
//! an answer, to read and can wait. Reading is `inbox --offline` for every account the window names, merged and cut
//! into one page here (`inbox` takes no `--limit` or `--page`). Sort now is `inbox` for one account. Titles and reasons
//! are the owner's mail and the model's reading of it: they reach the window and nothing else, never a log.

use crate::catalog::{self, Tool};
use crate::skills;
use crate::sync_schedule::ScheduleSource;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const LIST: Duration = Duration::from_secs(30);
/// At most 40 emails in batches of 10 by default; a local model may take minutes for each batch.
const RUN: Duration = Duration::from_mins(20);
const MAX_PAGE: u32 = 100;
const TOO_OLD: &str = "This version cannot sort mail yet. Update it on the Tools page.";
const BUCKETS: [&str; 3] = ["answer", "read", "later"];

#[derive(Debug, Deserialize)]
pub struct MailInboxSource {
    /// `{profile}`: every account the window lists, one run each.
    pub list: Vec<String>,
    pub run: Vec<String>,
    /// Added to `run` once the owner agreed to send the mail to a model outside this computer.
    pub yes: String,
    pub schedule: ScheduleSource,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InboxThread {
    /// The account it was read from, as the window named it; the ref names the mailbox address instead.
    pub profile: String,
    /// `chat:email/<mailbox>/<thread>`, the link the conversation page opens.
    #[serde(rename = "ref")]
    pub reference: String,
    pub title: Option<String>,
    /// `answer`, `read` or `later`.
    pub bucket: String,
    pub reason: String,
    pub last_email_at: String,
    pub sorted_at: String,
    /// The model that sorted it, as `inbox` names it.
    pub by: String,
    /// The newest email's sender who is not the owner; `None` from a mail-cli before 0.36.0.
    pub sender: Option<InboxSender>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
pub struct InboxSender {
    pub name: Option<String>,
    pub address: String,
}

/// What `inbox` would send before it asks, so the window asks in the owner's language instead of the tool's English.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InboxAsk {
    pub emails: u32,
    pub threads: u32,
    pub tokens: u32,
    pub host: String,
    pub model: String,
    /// `None` for a model memo has no price for.
    pub estimated_cost_usd: Option<f64>,
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum InboxAccount {
    /// `matching`: its threads the words match, whatever account the filter chose, for the account filter's counts.
    #[serde(rename_all = "camelCase")]
    Listed {
        profile: String,
        matching: u32,
    },
    Failed {
        profile: String,
        message: String,
        code: Option<String>,
        reason: Option<String>,
    },
}

#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq, Default)]
pub struct BucketCounts {
    pub answer: u32,
    pub read: u32,
    pub later: u32,
}

/// One page of every account's sorted threads that pass the filter, needs an answer first, then the newest.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InboxPage {
    pub threads: Vec<InboxThread>,
    pub total: u32,
    pub buckets: BucketCounts,
    /// Each account the window named, in its order, with what its read gave.
    pub accounts: Vec<InboxAccount>,
}

/// What one Sort now gave: the threads it lists now, and what it left for the next run in the tool's own words.
#[derive(specta::Type, Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", tag = "result")]
pub enum InboxRun {
    #[serde(rename_all = "camelCase")]
    Sorted {
        listed: u32,
        notes: Vec<String>,
        complete: bool,
        // `meta.model_run`: the model as `provider/model`, and what the run cost when the model's price is known.
        model: Option<String>,
        cost_usd: Option<f64>,
    },
    Failed {
        message: String,
        code: Option<String>,
        reason: Option<String>,
        ask: Option<InboxAsk>,
    },
}

/// The filter the window chose. `accounts` empty is every account read; `words` must all be in a title or a reason.
#[derive(specta::Type, Debug, Deserialize, Clone, Default)]
pub struct InboxFilter {
    pub accounts: Vec<String>,
    pub words: Vec<String>,
}

pub(crate) fn source(tool: &Tool) -> Result<&MailInboxSource, String> {
    tool.mail_inbox.as_ref().ok_or_else(|| format!("{} does not sort mail", tool.name))
}

/// Reads every account in `profiles` (the window's list of them all: none is picked here) and cuts one page.
pub fn list(
    tool: &Tool,
    profiles: &[String],
    filter: &InboxFilter,
    page: u32,
    limit: u32,
) -> Result<InboxPage, String> {
    let src = source(tool)?;
    if page == 0 || !(1..=MAX_PAGE).contains(&limit) {
        return Err("That page of the inbox does not exist.".into());
    }
    let argv: Vec<Vec<String>> =
        profiles.iter().map(|p| catalog::with_profile(&src.list, Some(p))).collect::<Result<_, _>>()?;
    // A process each; the accounts are few, so they run side by side rather than one after another.
    let answers: Vec<Read> = std::thread::scope(|s| {
        let runs: Vec<_> = profiles.iter().zip(&argv).map(|(p, a)| s.spawn(move || read_one(tool, p, a))).collect();
        runs.into_iter()
            .map(|r| r.join().unwrap_or_else(|_| Read::Failed("the read stopped".into(), None, None)))
            .collect()
    });
    Ok(merge(profiles, answers, filter, page, limit))
}

enum Read {
    Listed(Vec<InboxThread>),
    Failed(String, Option<String>, Option<String>),
}

fn read_one(tool: &Tool, profile: &str, argv: &[String]) -> Read {
    match skills::call(tool, argv, LIST) {
        Ok((out, Some(json))) if skills::ok(&out, &json) => Read::Listed(threads_of(profile, &json)),
        Ok((out, json)) => {
            let (message, code, reason) = skills::refusal(&out, json.as_ref(), TOO_OLD);
            Read::Failed(message, code, reason)
        }
        Err(e) => Read::Failed(e, None, None),
    }
}

fn threads_of(profile: &str, json: &Value) -> Vec<InboxThread> {
    let body = skills::body(json);
    json["items"]
        .as_array()
        .or_else(|| body["items"].as_array())
        .into_iter()
        .flatten()
        .filter_map(|v| thread_of(profile, v))
        .collect()
}

fn thread_of(profile: &str, v: &Value) -> Option<InboxThread> {
    let text = |k: &str| v[k].as_str().map(str::to_string);
    let bucket = text("bucket").filter(|b| BUCKETS.contains(&b.as_str()))?;
    Some(InboxThread {
        profile: profile.to_string(),
        reference: text("ref")?,
        title: text("title"),
        bucket,
        reason: text("reason").unwrap_or_default(),
        last_email_at: text("last_email_at").unwrap_or_default(),
        sorted_at: text("sorted_at").unwrap_or_default(),
        by: text("by").unwrap_or_default(),
        sender: sender_of(&v["sender"]),
    })
}

fn sender_of(v: &Value) -> Option<InboxSender> {
    let address = v["address"].as_str()?.to_string();
    Some(InboxSender { name: v["name"].as_str().map(str::to_string), address })
}

fn ask_of(json: Option<&Value>) -> Option<InboxAsk> {
    let d = &json?["error"]["details"];
    if d["reason"].as_str() != Some("chat-sending.ask") {
        return None;
    }
    let count = |k: &str| d[k].as_u64().and_then(|n| u32::try_from(n).ok());
    Some(InboxAsk {
        emails: count("emails")?,
        threads: count("threads")?,
        tokens: count("tokens")?,
        host: d["host"].as_str()?.to_string(),
        model: d["model"].as_str()?.to_string(),
        estimated_cost_usd: d["estimated_cost_usd"].as_f64(),
    })
}

fn matches(t: &InboxThread, words: &[String]) -> bool {
    let text = format!("{} {}", t.title.as_deref().unwrap_or_default(), t.reason).to_lowercase();
    words.iter().all(|w| text.contains(&w.to_lowercase()))
}

fn rank(bucket: &str) -> usize {
    BUCKETS.iter().position(|b| *b == bucket).unwrap_or(BUCKETS.len())
}

fn merge(profiles: &[String], answers: Vec<Read>, filter: &InboxFilter, page: u32, limit: u32) -> InboxPage {
    let mut accounts = Vec::new();
    let mut chosen = Vec::new();
    for (profile, answer) in profiles.iter().zip(answers) {
        match answer {
            Read::Listed(threads) => {
                let found: Vec<InboxThread> = threads.into_iter().filter(|t| matches(t, &filter.words)).collect();
                let matching = u32::try_from(found.len()).unwrap_or(u32::MAX);
                accounts.push(InboxAccount::Listed { profile: profile.clone(), matching });
                if filter.accounts.is_empty() || filter.accounts.contains(profile) {
                    chosen.extend(found);
                }
            }
            Read::Failed(message, code, reason) => {
                accounts.push(InboxAccount::Failed { profile: profile.clone(), message, code, reason });
            }
        }
    }
    // ISO times in UTC sort as text; the newest first within a group.
    chosen.sort_by(|a, b| rank(&a.bucket).cmp(&rank(&b.bucket)).then_with(|| b.last_email_at.cmp(&a.last_email_at)));
    let mut buckets = BucketCounts::default();
    for t in &chosen {
        match t.bucket.as_str() {
            "answer" => buckets.answer += 1,
            "read" => buckets.read += 1,
            _ => buckets.later += 1,
        }
    }
    let total = u32::try_from(chosen.len()).unwrap_or(u32::MAX);
    let skip = usize::try_from((page - 1).saturating_mul(limit)).unwrap_or(usize::MAX);
    let take = usize::try_from(limit).unwrap_or(usize::MAX);
    InboxPage { threads: chosen.into_iter().skip(skip).take(take).collect(), total, buckets, accounts }
}

fn run_args(tool: &Tool, profile: &str, yes: bool) -> Result<Vec<String>, String> {
    let src = source(tool)?;
    let mut argv = catalog::with_profile(&src.run, Some(profile))?;
    if yes {
        argv.push(src.yes.clone());
    }
    Ok(argv)
}

/// Sorts what is new in one account. `yes` only after the owner agreed to what the tool said it would send.
pub fn run(tool: &Tool, profile: &str, yes: bool) -> Result<InboxRun, String> {
    let argv = run_args(tool, profile, yes)?;
    let (out, json) = skills::call(tool, &argv, RUN)?;
    match json.as_ref() {
        Some(v) if skills::ok(&out, v) => Ok(sorted_of(v)),
        j => {
            let (message, code, reason) = skills::refusal(&out, j, TOO_OLD);
            Ok(InboxRun::Failed { message, code, reason, ask: ask_of(j) })
        }
    }
}

fn sorted_of(v: &Value) -> InboxRun {
    let body = skills::body(v);
    let listed = v["items"].as_array().or_else(|| body["items"].as_array()).map_or(0, Vec::len);
    let notes = v["missing"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|m| m["why"].as_str())
        .map(crate::redact::text)
        .collect();
    let run = &v["meta"]["model_run"];
    let model = match (run["provider"].as_str(), run["model"].as_str()) {
        (Some(p), Some(m)) => Some(format!("{p}/{m}")),
        (None, Some(m)) => Some(m.to_string()),
        _ => None,
    };
    InboxRun::Sorted {
        listed: u32::try_from(listed).unwrap_or(u32::MAX),
        notes,
        complete: v["meta"]["complete"].as_bool().unwrap_or(true),
        model,
        cost_usd: run["cost_usd"].as_f64(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn email() -> &'static Tool {
        catalog::tool("email").unwrap()
    }

    fn answer(mailbox: &str) -> Value {
        json!({
            "items": [
                { "ref": format!("chat:email/{mailbox}/t1"), "title": "Invoice 42", "bucket": "later",
                  "reason": "a receipt, nothing to do", "last_email_at": "2026-11-18T09:00:00.000Z",
                  "sorted_at": "2026-11-19T08:00:00.000Z", "by": "anthropic/claude-haiku-4-5", "untrusted": ["title", "reason"] },
                { "ref": format!("chat:email/{mailbox}/t2"), "title": "Contract draft", "bucket": "answer",
                  "reason": "Ana asks you to sign by Friday", "last_email_at": "2026-11-17T10:00:00.000Z",
                  "sorted_at": "2026-11-19T08:00:00.000Z", "by": "anthropic/claude-haiku-4-5", "untrusted": ["title", "reason"] },
                { "ref": format!("chat:email/{mailbox}/t3"), "title": null, "bucket": "answer",
                  "reason": "a question about the meeting", "last_email_at": "2026-11-19T07:00:00.000Z",
                  "sorted_at": "2026-11-19T08:00:00.000Z", "by": "ollama/llama3.2", "untrusted": ["title", "reason"] },
                { "ref": "chat:email/x/bad", "bucket": "spam", "reason": "not one of the three" },
            ],
            "page": { "mode": "page", "limit": 4, "has_more": false },
            "missing": [],
        })
    }

    fn names(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn merges_every_account_needs_an_answer_first_then_the_newest() {
        let reads = vec![
            Read::Listed(threads_of("work", &answer("me@work.example"))),
            Read::Listed(threads_of("personal", &answer("me@home.example"))),
        ];
        let page = merge(&names(&["work", "personal"]), reads, &InboxFilter::default(), 1, 25);
        assert_eq!(page.total, 6, "a bucket the tool does not name is left out");
        assert_eq!(page.buckets, BucketCounts { answer: 4, read: 0, later: 2 });
        let order: Vec<(&str, &str)> = page.threads.iter().map(|t| (t.bucket.as_str(), t.reference.as_str())).collect();
        assert_eq!(order[0].0, "answer");
        assert!(order[0].1.ends_with("/t3"), "the newest of the group first");
        assert_eq!(order[4].0, "later");
        assert_eq!(page.threads[0].title, None);
        assert_eq!(page.threads.iter().filter(|t| t.profile == "personal").count(), 3);
    }

    #[test]
    fn filters_by_account_and_words_and_counts_each_account_for_the_filter() {
        let reads = vec![
            Read::Listed(threads_of("work", &answer("me@work.example"))),
            Read::Failed("no mail is stored yet".into(), Some("not_found".into()), Some("item.not-found".into())),
            Read::Listed(threads_of("personal", &answer("me@home.example"))),
        ];
        let filter = InboxFilter { accounts: names(&["work"]), words: names(&["FRIDAY"]) };
        let page = merge(&names(&["work", "new", "personal"]), reads, &filter, 1, 25);
        assert_eq!(page.total, 1);
        assert_eq!(page.threads[0].profile, "work");
        assert_eq!(page.accounts[0], InboxAccount::Listed { profile: "work".into(), matching: 1 });
        assert!(matches!(&page.accounts[1], InboxAccount::Failed { profile, .. } if profile == "new"));
        assert_eq!(page.accounts[2], InboxAccount::Listed { profile: "personal".into(), matching: 1 });
    }

    #[test]
    fn cuts_one_page() {
        let reads = vec![Read::Listed(threads_of("work", &answer("me@work.example")))];
        let page = merge(&names(&["work"]), reads, &InboxFilter::default(), 2, 2);
        assert_eq!((page.threads.len(), page.total), (1, 3));
    }

    #[test]
    fn a_run_says_what_it_left_for_the_next_one() {
        let v = json!({
            "items": [{}, {}],
            "missing": [{ "field": "items", "why": "12 threads wait for the next run" }],
            "meta": { "complete": false },
        });
        assert_eq!(
            sorted_of(&v),
            InboxRun::Sorted {
                listed: 2,
                notes: vec!["12 threads wait for the next run".into()],
                complete: false,
                model: None,
                cost_usd: None
            }
        );
    }

    #[test]
    fn a_run_names_its_model_and_cost_and_a_thread_its_sender() {
        let v = json!({ "items": [], "meta": { "complete": true, "model_run": {
            "provider": "anthropic", "model": "claude-haiku-4-5", "sent": 3, "done": 3, "left": 0, "cost_usd": 0.0042 } } });
        assert!(matches!(sorted_of(&v), InboxRun::Sorted { model: Some(m), cost_usd: Some(c), .. }
            if m == "anthropic/claude-haiku-4-5" && (c - 0.0042).abs() < 1e-9));
        let t = thread_of(
            "work",
            &json!({ "ref": "chat:email/a/t", "bucket": "answer", "sender": { "name": null, "address": "ana@example.com" } }),
        );
        assert_eq!(t.unwrap().sender, Some(InboxSender { name: None, address: "ana@example.com".into() }));
    }

    #[test]
    fn an_ask_carries_what_would_be_sent() {
        let j = json!({ "error": { "code": "confirmation_required", "message": "12 emails ...", "details": {
            "reason": "chat-sending.ask", "emails": 12, "threads": 5, "tokens": 9000, "host": "api.anthropic.com",
            "model": "anthropic/claude-haiku-4-5", "estimated_cost_usd": null } } });
        let ask = ask_of(Some(&j)).unwrap();
        assert_eq!((ask.emails, ask.threads, ask.tokens, ask.estimated_cost_usd), (12, 5, 9000, None));
        assert_eq!(ask.host, "api.anthropic.com");
        assert!(ask_of(Some(&json!({ "error": { "details": { "reason": "chat-sending.denied" } } }))).is_none());
    }

    #[test]
    fn runs_the_accounts_own_inbox_and_says_yes_only_when_asked() {
        assert_eq!(run_args(email(), "work", false).unwrap().join(" "), "work inbox --json");
        assert_eq!(run_args(email(), "work", true).unwrap().join(" "), "work inbox --json --yes");
        assert!(run_args(email(), "--all", false).is_err());
        assert!(run_args(catalog::tool("tg").unwrap(), "personal", false).is_err());
        assert_eq!(source(email()).unwrap().list.join(" "), "{profile} inbox --offline --no-record --json");
    }

    #[test]
    fn refuses_a_page_that_cannot_exist_and_a_bad_profile() {
        let none = InboxFilter::default();
        assert!(list(email(), &names(&["work"]), &none, 0, 25).is_err());
        assert!(list(email(), &names(&["work"]), &none, 1, MAX_PAGE + 1).is_err());
        assert!(list(email(), &names(&["--help"]), &none, 1, 25).is_err());
    }
}

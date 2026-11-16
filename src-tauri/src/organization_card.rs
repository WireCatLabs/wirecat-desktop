//! A company's card, from memo's `organizations context`: its people, its open deals and leads, and how many calls
//! and meetings its people had. memo lists no calls of a company itself, so the card reads them person by person, only
//! for the person the owner opens (`people_profile`). Names and titles are the owner's own data, never logged.

use crate::people::{Call, text, with_memo, words};
use serde::Serialize;
use serde_json::Value;

/// People and deals the card lists; memo says how many more there are.
const LIMIT: &str = "20";

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub reference: String,
    pub name: Option<String>,
    /// The first role memo names, such as a job title or `member-of`'s role.
    pub role: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DealLine {
    pub reference: String,
    /// `deal` or `lead`.
    pub kind: Option<String>,
    pub title: Option<String>,
    pub stage: Option<String>,
    pub amount: Option<String>,
    pub currency: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationCard {
    pub reference: String,
    pub name: Option<String>,
    pub people: Vec<Member>,
    pub people_total: u64,
    pub deals: Vec<DealLine>,
    pub deals_total: u64,
    /// Calls and meetings of its people in the accounts memo read; `None` when memo did not count them.
    pub meetings: Option<u64>,
}

fn organization_ref(s: &str) -> Result<&str, String> {
    let id = s.strip_prefix("organization:").unwrap_or_default();
    if id.is_empty() || id.len() > 15 || id.starts_with('0') || !id.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("not an organization: {s}"));
    }
    Ok(s)
}

fn items<'a>(section: &'a Value) -> impl Iterator<Item = &'a Value> {
    section["items"].as_array().into_iter().flatten()
}

fn total(section: &Value, shown: usize) -> u64 {
    section["total"].as_u64().unwrap_or(shown as u64)
}

fn member(v: &Value) -> Option<Member> {
    let roles = v["roles"].as_array().into_iter().flatten();
    let role = roles.clone().find_map(|r| text(r, "position")).or_else(|| roles.clone().find_map(|r| text(r, "role")));
    Some(Member { reference: text(v, "ref").filter(|r| r.starts_with("person:"))?, name: text(v, "name"), role })
}

fn deal(v: &Value) -> Option<DealLine> {
    Some(DealLine {
        reference: text(v, "ref")?,
        kind: text(v, "kind"),
        title: text(v, "title"),
        stage: text(v, "stage"),
        amount: text(v, "amount"),
        currency: text(v, "currency"),
    })
}

fn card_of(answer: &Value, reference: &str) -> OrganizationCard {
    let item = answer.get("item").unwrap_or(answer);
    let people: Vec<Member> = items(&item["people"]).filter_map(member).collect();
    let deals: Vec<DealLine> = items(&item["deals"]).filter_map(deal).collect();
    OrganizationCard {
        reference: reference.to_string(),
        name: text(&item["organization"], "name"),
        people_total: total(&item["people"], people.len()),
        deals_total: total(&item["deals"], deals.len()),
        people,
        deals,
        meetings: item["communications"]["meetings"].as_u64(),
    }
}

fn card_with(call: &Call, reference: &str) -> Result<OrganizationCard, String> {
    let answer = call(&words(&["organizations", "context", reference, "--limit", LIMIT]))?;
    Ok(card_of(&answer, reference))
}

pub fn card(reference: &str) -> Result<OrganizationCard, String> {
    let reference = organization_ref(reference)?;
    with_memo(|call| card_with(call, reference))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// memo's `organizations context --json` (cli-core `organization_context`), trimmed to what the card reads; the
    /// names are made up.
    fn context() -> Value {
        json!({ "item": {
            "organization": { "ref": "organization:3", "name": "Northstar", "own": false },
            "people": { "items": [
                { "ref": "person:7", "name": "Lena Ortiz", "roles": [
                    { "kind": "member-of", "role": "buyer", "standing": "reported", "position": "Head of purchasing" }
                ] },
                { "ref": "person:8", "name": null,
                  "roles": [ { "kind": "member-of", "role": null, "standing": "confirmed" } ] },
                { "ref": "organization:9", "name": "Not a person", "roles": [] }
            ], "total": 4, "has_more": true, "next": "people list organization:3" },
            "deals": { "items": [
                { "ref": "deal:12", "kind": "deal", "title": "Spring order", "summary": "", "stage": "Proposal",
                  "status": "open", "currency": "EUR", "amount": "1200.00", "close_date": null, "project": null }
            ], "total": 1, "has_more": false, "next": null },
            "communications": { "messages": 40, "mail": 3, "meetings": 5, "has_more": false }
        }})
    }

    #[test]
    fn the_card_keeps_its_people_deals_and_call_count() {
        let card = card_of(&context(), "organization:3");
        assert_eq!(card.name.as_deref(), Some("Northstar"));
        assert_eq!(card.people.len(), 2, "only people");
        assert_eq!(card.people[0].role.as_deref(), Some("Head of purchasing"));
        assert_eq!(card.people[1].role, None);
        assert_eq!(card.people_total, 4);
        assert_eq!(card.deals[0].amount.as_deref(), Some("1200.00"));
        assert_eq!(card.deals_total, 1);
        assert_eq!(card.meetings, Some(5));
    }

    #[test]
    fn only_an_organization_ref_reaches_memo() {
        assert!(organization_ref("organization:3").is_ok());
        for bad in ["3", "organization:", "organization:03", "organization:3 --yes", "person:3"] {
            assert!(organization_ref(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn asks_memo_for_one_organization_quietly() {
        let seen = std::sync::Mutex::new(Vec::new());
        let call = |args: &[String]| -> Result<Value, String> {
            seen.lock().unwrap().push(args.to_vec());
            Ok(context())
        };
        card_with(&call, "organization:3").unwrap();
        assert_eq!(
            seen.lock().unwrap()[0],
            ["organizations", "context", "organization:3", "--limit", "20", "--json", "--no-record"]
        );
    }
}

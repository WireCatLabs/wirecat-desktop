// A CRM account's morning digest as cli-core's `changes list --format report` writes it (`src/crm/digest.ts`, checked
// by `reportDocument`): one `crm` section with every part, and a sync older than a day. Synthetic names.

const HOUR = 3_600_000

const item = (over: Record<string, unknown>) => ({
  who: null,
  topic: null,
  action: null,
  detail: null,
  quote: null,
  since: null,
  due: null,
  time: null,
  amount: null,
  count: null,
  priority: "normal",
  channel: "crm",
  refs: [],
  ...over,
})

export function crmSection(now: number) {
  const iso = (offset: number) => new Date(now + offset).toISOString()
  return {
    kind: "crm",
    more: 4,
    items: [
      item({
        type: "money",
        who: "Northstar site",
        topic: "won",
        amount: { value: 120000, currency: "EUR", direction: "in" },
        refs: ["deal:12"],
      }),
      item({ type: "fact", topic: "Harbor fit-out", detail: "won", time: iso(-5 * HOUR), refs: ["deal:13"] }),
      item({ type: "fact", topic: "Vector renewal", detail: "lost: price", time: iso(-3 * HOUR), refs: ["deal:14"] }),
      item({
        type: "task",
        topic: "Call about the contract",
        who: "Atlas warehouse",
        due: iso(-2 * HOUR),
        priority: "high",
        refs: ["deal:15"],
      }),
      item({ type: "task", topic: "Send the quote", who: "Lena Ortiz", due: iso(2 * HOUR), refs: ["person:8"] }),
      item({
        type: "fact",
        topic: "Atlas warehouse",
        detail: "New → Quote sent",
        time: iso(-4 * HOUR),
        refs: ["deal:15"],
      }),
      item({ type: "fact", topic: "Cable supply", detail: "new", time: iso(-6 * HOUR), refs: ["lead:3"] }),
      item({ type: "fact", topic: "Office move", detail: "new owner", time: iso(-7 * HOUR), refs: ["organization:4"] }),
      item({ type: "fact", topic: "new contacts", detail: "3", count: 3, channel: null }),
      item({ type: "task", topic: "Check the signed contract", due: null, refs: ["task:CRM-7"] }),
    ],
  }
}

/** A CRM copy older than a day, as cli-core names it: hours only, no reason. */
export const crmHealth = [{ source: "amo", account: "sales", reason: null, since: null, stale_hours: 30, refs: [] }]

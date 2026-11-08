import type { Digest, DigestDay } from "./digest-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// Synthetic digests for the browser build: every section, item type, task group, sync line and the "viewed" footer,
// one plain-text run from before report documents, and `?digests=none|new` (`new`: a newer day lands after 3 s).

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const dayFrom = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}
const at = (days: number, hour: number) => {
  const d = dayFrom(days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
const stampOf = (date: string, hour: string) => `${date}T${hour}-30-00Z`

const full = (date: string, summary: string) => ({
  format: "wirecat.report/1",
  kind: "morning-digest",
  date,
  summary,
  sections: [
    {
      kind: "today",
      more: 0,
      items: [
        {
          type: "reply",
          who: "Anna Kotova",
          topic: "warehouse lease",
          action: "Answer whether signing on Friday works",
          quote: "Can we sign on Friday?",
          since: at(-2, 14),
          channel: "mail",
          refs: ["msg:email/anna%40example.com/5005/6006"],
        },
        {
          type: "question",
          who: "Igor Lapin",
          topic: "tile delivery",
          action: "can the tile delivery move to the 20th?",
          since: at(-1, 18),
          channel: "telegram",
          refs: ["chat:telegram/1001/4004"],
        },
        { type: "task", topic: "Reconciliation for North Wind", due: iso(dayFrom(-2)), refs: ["task:HRB-14"] },
        { type: "task", topic: "Office repair estimate", due: at(0, 23), who: "Marina Orlova", refs: ["task:HRB-15"] },
      ],
    },
    {
      kind: "decisions",
      items: [
        {
          type: "decision",
          topic: "Findings from mail",
          action: "wait for review",
          count: 12,
          refs: ["proposal:fact%3A21"],
        },
      ],
    },
    {
      kind: "money",
      items: [
        {
          type: "money",
          who: "Vector LLC",
          topic: "November rent",
          action: "pay",
          amount: { value: 48000, currency: "RUB", direction: "out" },
          due: iso(dayFrom(-3)),
          channel: "mail",
        },
        {
          type: "money",
          who: "Smirnova",
          topic: "prepayment, contract 14",
          amount: { value: 120000, currency: "RUB", direction: "in" },
        },
      ],
    },
    {
      kind: "meetings",
      items: [
        {
          type: "meeting",
          topic: "Warehouse stand-up",
          time: at(0, 11),
          who: "Anna Kotova, Petr Belov",
          action: "bring the rent figures",
        },
      ],
    },
    {
      kind: "projects",
      more: 2,
      items: [
        {
          type: "fact",
          topic: "Khimki warehouse",
          detail: "the landlord agreed a 5% discount from January",
          who: "Anna Kotova",
        },
        {
          type: "risk",
          topic: "Cable delivery",
          detail: "the supplier has not answered for 4 days",
          action: "call Petr Belov before lunch",
        },
      ],
    },
  ],
  health: [
    {
      source: "Telegram",
      account: "@ownerdemo",
      reason: "sync-failed",
      since: at(-4, 9),
      stale_hours: 0,
      refs: ["sync:telegram/1001"],
    },
    { source: "MAX", account: "old account 394…", reason: "no-schedule", stale_hours: 0, refs: [] },
  ],
  scope: {
    from: at(-1, 8),
    to: at(0, 8),
    sources: [
      { kind: "telegram", accounts: 1 },
      { kind: "max", accounts: 1 },
      { kind: "mail", accounts: 4 },
    ],
    counts: { chats: 31, mail: 12, tasks: 17, meetings: 0 },
  },
  tasks: { overdue: 5, today: 3, tomorrow: 2, new: 4, new_since: at(-1, 8) },
})

export function digestsMock(params: URLSearchParams): Pick<Platform, "digestList" | "digestShow" | "digestNotify"> {
  const mode = params.get("digests")
  const started = Date.now()
  const today = iso(dayFrom(0))
  const days = (): { day: DigestDay; digest: Digest }[] => {
    if (mode === "none") return []
    const list = [
      { date: today, hour: "07", doc: full(today, "Three replies wait for you, one payment is overdue.") },
      {
        date: iso(dayFrom(-1)),
        hour: "07",
        doc: { ...full(iso(dayFrom(-1)), "A quiet morning."), sections: [], tasks: null },
      },
    ]
    const shown: { day: DigestDay; digest: Digest }[] = list.map(({ date, hour, doc }) => ({
      day: { date, stamp: stampOf(date, hour), summary: doc.summary, report: true },
      digest: { date, stamp: stampOf(date, hour), document: doc as unknown, text: null },
    }))
    const old = iso(dayFrom(-3))
    shown.push({
      day: { date: old, stamp: stampOf(old, "07"), summary: "Morning digest", report: false },
      digest: {
        date: old,
        stamp: stampOf(old, "07"),
        document: null,
        text: "Morning digest\n\n- Reply to Anna Kotova about the warehouse lease\n- Pay November rent to Vector LLC\n",
      },
    })
    if (mode === "new" && Date.now() - started > 3000) {
      const next = iso(dayFrom(1))
      const doc = full(next, "A new digest arrived while WireCat was open.")
      shown.unshift({
        day: { date: next, stamp: stampOf(next, "07"), summary: doc.summary, report: true },
        digest: { date: next, stamp: stampOf(next, "07"), document: doc, text: null },
      })
    }
    return shown
  }
  return {
    async digestList() {
      await delay(250)
      return days().map((d) => d.day)
    },
    async digestShow(date) {
      await delay(200)
      const found = days().find((d) => d.day.date === date)
      if (!found) throw new Error(`no digest for ${date}`)
      return found.digest
    },
    async digestNotify() {},
  }
}

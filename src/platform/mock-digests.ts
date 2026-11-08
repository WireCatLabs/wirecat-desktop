import type { Backfill, DigestSchedules, OtherSchedule, ScheduleRun } from "./bindings"
import type { Digest, DigestDay } from "./digest-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// Synthetic digests for the browser build: every section, item type, task group, sync line and the "viewed" footer,
// one plain-text run from before report documents, one day built later by `digest backfill`, and `?digests=none|new`
// (`new`: a newer day lands after 3 s).
// The schedule: on, daily at 08:30 to a Telegram bot and a mailbox. `?digest-schedule=missing` (none yet, nothing
// remembered), `failed` (the last run failed, mail not delivered), `capped` (today's spend reached the daily cap),
// `noclaude` (none, Claude Code missing), `nomemo`, `old`; `?digest-schedule-fail=1` makes saving fail with memo's
// words. Backfill: `?backfill=old` (this memo has no `digest backfill`), `?backfill-fail=1` (building fails halfway);
// otherwise building takes 4 s and adds the days, marked built later.

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
          refs: ["msg:email/anna%40example.com/5005/6006", "person:77", "project:khimki-warehouse"],
        },
        {
          type: "question",
          who: "Igor Lapin",
          topic: "tile delivery",
          action: "can the tile delivery move to the 20th?",
          since: at(-1, 18),
          channel: "telegram",
          refs: ["chat:telegram/1001/4004", "person:78"],
        },
        {
          type: "task",
          topic: "Reconciliation for North Wind",
          due: iso(dayFrom(-2)),
          refs: ["task:HRB-14", "project:HRB"],
        },
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
          refs: ["proposal:fact%3A21", "msg:email/anna%40example.com/5005/6007"],
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

type DigestsPart =
  | "digestList"
  | "digestShow"
  | "digestNotify"
  | "digestSchedule"
  | "digestScheduleSave"
  | "digestScheduleRemove"
  | "digestScheduleRun"
  | "digestBackfill"

const run = (minutesAgo: number, over: Partial<ScheduleRun> = {}): ScheduleRun => ({
  at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  exitCode: 0,
  reason: null,
  failures: null,
  failingSince: null,
  costUsd: 0.27,
  skipped: null,
  deliveries: [
    { kind: "telegramBot", ok: true, reason: null },
    { kind: "email", ok: true, reason: null },
  ],
  ...over,
})

const ROUTES = ["telegram-bot:personal/user:1001", "email:work/owner@example.com"]
const routeOf = (route: string) => {
  const [kind = "", rest = ""] = route.split(/:(.*)/s)
  const [profile = "", to = ""] = rest.split(/\/(.*)/s)
  return { value: route, kind: kind === "email" ? ("email" as const) : ("telegramBot" as const), profile, to }
}

const others: OtherSchedule[] = [
  {
    name: "mail-triage",
    kind: "agent",
    when: "every 30m",
    last: run(12, {
      costUsd: 0.41,
      deliveries: [],
      skipped: {
        at: new Date(Date.now() - 4 * 60_000).toISOString(),
        why: "today's runs cost $5.02, the $5.00 a day allowed; it runs again tomorrow",
        reason: "cost.day-cap",
      },
    }),
    spentTodayUsd: 5.02,
    maxCostUsd: 1,
    maxCostPerDayUsd: 5,
  },
  {
    name: "weekly-review",
    kind: "agent",
    when: "daily at 09:00",
    last: null,
    spentTodayUsd: 0,
    maxCostUsd: 1,
    maxCostPerDayUsd: 5,
  },
]

export function digestsMock(params: URLSearchParams): Pick<Platform, DigestsPart> {
  const mode = params.get("digests")
  const started = Date.now()
  const today = iso(dayFrom(0))
  const built = new Set<string>()
  const scenario = params.get("digest-schedule")
  let schedule: { time: string; routes: string[]; maxCost: number; maxCostPerDay: number } | null =
    scenario === "missing" || scenario === "noclaude"
      ? null
      : { time: "08:30", routes: ROUTES, maxCost: 0.5, maxCostPerDay: 1 }
  let last: ScheduleRun | null =
    scenario === "failed"
      ? run(70, {
          exitCode: 1,
          reason: "provider_error (claude.exit)",
          failures: 1,
          failingSince: new Date(Date.now() - 70 * 60_000).toISOString(),
          costUsd: 0.12,
          deliveries: [{ kind: "email", ok: false, reason: "smtp.refused" }],
        })
      : run(scenario === "capped" ? 20 : 95)
  let spent = scenario === "capped" ? 1.02 : 0.27
  const status = (): DigestSchedules => {
    if (scenario === "nomemo") return { state: "noMemo" }
    if (scenario === "old") return { state: "old", version: "0.131.20", need: "0.131.26" }
    return {
      state: "ready",
      harness: scenario !== "noclaude",
      others,
      digest: schedule && {
        when: `daily at ${schedule.time}`,
        time: schedule.time,
        routes: schedule.routes.map(routeOf),
        notify: "always",
        last,
        spentTodayUsd: spent,
        maxCostUsd: schedule.maxCost,
        maxCostPerDayUsd: schedule.maxCostPerDay,
      },
    }
  }
  const missingDays = (from: string, to: string, have: Set<string>) => {
    const out: string[] = []
    for (let d = new Date(`${from}T12:00:00`); iso(d) <= to; d.setDate(d.getDate() + 1)) out.push(iso(d))
    return { all: out, missing: out.filter((d) => !have.has(d)) }
  }
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
      day: { date, stamp: stampOf(date, hour), summary: doc.summary, report: true, backfill: false },
      digest: { date, stamp: stampOf(date, hour), document: doc as unknown, text: null },
    }))
    const later = iso(dayFrom(-2))
    const laterDoc = { ...full(later, "Built later: two replies waited, the rent was due."), backfill: true }
    shown.push({
      day: {
        date: later,
        stamp: stampOf(iso(dayFrom(0)), "06"),
        summary: laterDoc.summary,
        report: true,
        backfill: true,
      },
      digest: { date: later, stamp: stampOf(iso(dayFrom(0)), "06"), document: laterDoc, text: null },
    })
    for (const date of built) {
      const doc = { ...full(date, "Built later for a past day."), backfill: true }
      shown.push({
        day: { date, stamp: stampOf(iso(dayFrom(0)), "09"), summary: doc.summary, report: true, backfill: true },
        digest: { date, stamp: stampOf(iso(dayFrom(0)), "09"), document: doc, text: null },
      })
    }
    shown.sort((a, b) => b.day.date.localeCompare(a.day.date))
    const old = iso(dayFrom(-3))
    shown.push({
      day: { date: old, stamp: stampOf(old, "07"), summary: "Morning digest", report: false, backfill: false },
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
        day: { date: next, stamp: stampOf(next, "07"), summary: doc.summary, report: true, backfill: false },
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
    async digestSchedule() {
      await delay(300)
      return status()
    },
    async digestScheduleSave(time, routes, maxCost, maxCostPerDay) {
      await delay(900)
      if (params.get("digest-schedule-fail")) throw new Error("unknown option '--deliver-to'")
      schedule = { time, routes, maxCost, maxCostPerDay }
      return status()
    },
    async digestScheduleRemove() {
      await delay(700)
      schedule = null
      return status()
    },
    async digestScheduleRun() {
      await delay(4000)
      last = run(0)
      spent += 0.27
      return status()
    },
    async digestBackfill(from, to, yes): Promise<Backfill> {
      await delay(yes ? 4000 : 600)
      if (params.get("backfill") === "old") return { state: "unsupported" }
      const have = new Set(days().map((d) => d.day.date))
      const { all, missing } = missingDays(from, to, have)
      if (!yes)
        return {
          state: "estimate",
          days: missing.length,
          skipped: all.length - missing.length,
          estimateUsd: missing.length * 0.27,
        }
      if (params.get("backfill-fail")) throw new Error(`claude exited with code 1 while building ${missing[1] ?? from}`)
      for (const d of missing) built.add(d)
      return {
        state: "done",
        built: missing.length,
        skipped: all.length - missing.length,
        costUsd: missing.length * 0.26,
      }
    },
  }
}

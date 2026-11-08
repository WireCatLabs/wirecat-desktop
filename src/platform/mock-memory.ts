import type { AgentCall, MemoryEntry, MemoryRead, MemorySource, SourceContext, SourceReview } from "./memory-schemas"
import { delay } from "./mock-delay"
import { memoryAddMock } from "./mock-memory-add"
import { TASK_IDS } from "./mock-tasks"
import type { Platform } from "./types"

// The Memory page's stand-in for memo, with made-up people only. `?memory=none` holds nothing, `missing` has no memo,
// `old` an older memo, `many` 300 entries across 40 days, `gone` one source deleted since, `changed` two records in
// use whose sources changed or went (a "source changed" marker and its review). `?memory-fail=read` fails the read
// (another sync holds the store), `?memory-fail=write` fails every write the same way.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("memory")
const fail = params.get("memory-fail")
const BUSY = "another process holds the store (store.busy); try again in a minute"

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Times from now, so "Today" and "Yesterday" hold whichever day the build is opened. */
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

const base = {
  summary: null,
  verb: null,
  targetName: null,
  chatName: null,
  counts: null,
  subject: null,
  subjectName: null,
  subjectIsOwner: false,
  scope: "work",
  project: null,
  projectName: null,
  supersedes: null,
  reason: null,
  account: null,
  target: null,
  updatedAt: null,
  findings: null,
  task: null,
  model: null,
  confidence: null,
  sourceReview: null,
} as const

/** `?memory=changed`: memo found these records' sources changed or gone since they were cited. */
const MARKED: Record<string, { id: string; cause: string }> = {
  "memory:39": { id: "17090", cause: "changed" },
  "fact:22": { id: "17091", cause: "deleted" },
}

const REVIEWS: Record<string, SourceReview> = {
  "17090": {
    id: "17090",
    cause: "changed",
    raisedAt: ago(5 * HOUR),
    sources: [
      {
        ref: "msg:telegram/1/77/42",
        kind: "message",
        cause: "changed",
        replacement: null,
        quote: "the clinics confirmed the February pilot",
        cited: "Good news: the clinics confirmed the February pilot, Lena owns the onboarding.",
        now: "Update: the clinics moved the pilot to March, Lena still owns the onboarding.",
      },
    ],
    challenges: [],
    suggestions: [],
  },
  "17091": {
    id: "17091",
    cause: "deleted",
    raisedAt: ago(26 * HOUR),
    sources: [
      {
        ref: null,
        kind: "note",
        cause: "deleted",
        replacement: null,
        quote: null,
        cited: "Both clinics sign the data agreement before the pilot.",
        now: null,
      },
    ],
    challenges: [
      {
        evidence: ["msg:telegram/1/77/50"],
        reason: "Kai says only one clinic signs before the pilot.",
        by: "claude-code",
        at: ago(25 * HOUR),
      },
    ],
    suggestions: [
      { author: "claude-code", body: "One pilot clinic signs the data agreement first.", at: ago(25 * HOUR) },
    ],
  },
}

const [PRICING_TASK = "", CLINICS_TASK = ""] = Object.keys(TASK_IDS).map((id) => `task:${id}`)

const agent = (name: string) => ({ type: "bot", name })
const OWNER = { type: "person", name: null }

const NBB = { project: "project:4", projectName: "Northbridge Bench" } as const

function seed(): MemoryEntry[] {
  return [
    {
      ...base,
      ...NBB,
      ref: "action:7",
      type: "action",
      kind: "evidence_findings",
      text: null,
      summary: "Create 2 facts and 2 tasks in Northbridge Bench",
      verb: "create",
      targetName: "Northbridge Bench",
      counts: { facts: 2, tasks: 2 },
      status: "proposed",
      subject: "project:4",
      subjectName: "Northbridge Bench",
      scope: null,
      author: agent("codex-nbb-evaluation"),
      links: 0,
      reason: null,
      target: "project:4",
      createdAt: ago(1.2 * HOUR),
      findings: [
        {
          id: "f1",
          kind: "fact",
          text: "The evaluation set moves from 80 to 120 queries, and 40 of the new ones are in Spanish, because the October run scored Spanish answers 18 points below English ones.",
          reason: null,
          evidence: ["document:31", "msg:telegram/1/204/1180"],
          outcome: null,
          created: null,
        },
        {
          id: "f2",
          kind: "task",
          text: "Add 40 Spanish queries to the evaluation set before the 12 November review",
          reason: "Lena Ortiz asked for Spanish coverage in the review thread and nobody took it.",
          evidence: ["msg:telegram/1/204/1180"],
          outcome: null,
          created: null,
        },
        {
          id: "f3",
          kind: "fact",
          text: "Northbridge Bench runs nightly at 02:00 on the shared runner; a run takes about 40 minutes.",
          reason: null,
          evidence: ["document:31"],
          outcome: null,
          created: null,
        },
        {
          id: "f4",
          kind: "task",
          text: "Ask Tom Becker for read access to the runner logs",
          reason: "Two failed runs last week could not be explained without them.",
          evidence: ["msg:telegram/1/204/1193", "mail:work/5120"],
          outcome: null,
          created: null,
        },
      ],
    },
    {
      ...base,
      ...NBB,
      ref: "fact:21",
      type: "fact",
      kind: "decision",
      text: "Scores below 0.72 on the retrieval suite block a release of the Northbridge ranking model. The threshold was agreed in the 28 October review after the 0.69 run let two broken answers through, and it applies to every model change, including prompt-only ones.",
      status: "proposed",
      author: agent("codex-nbb-evaluation"),
      links: 3,
      createdAt: ago(1.3 * HOUR),
    },
    {
      ...base,
      ref: "memory:41",
      type: "memory",
      kind: "preference",
      text: "Kai Moreno prefers calls on Friday afternoons and asks for the agenda the evening before. When a call moves to a Monday he tends to cancel it at the last minute, so propose Friday after 15:00 first and send three or four points by 20:00 the day before.",
      status: "proposed",
      subject: "person:7",
      subjectName: "Kai Moreno",
      author: agent("claude-code"),
      model: "claude-opus-4",
      confidence: 0.8,
      links: 3,
      createdAt: ago(2 * HOUR),
      updatedAt: ago(1.5 * HOUR),
    },
    {
      ...base,
      ref: "fact:17",
      type: "fact",
      kind: "decision",
      text: "Harbour launch moves to 2 March; the pilot with two clinics stays in February.",
      status: "proposed",
      project: "project:3",
      projectName: "Project Harbour",
      subject: "project:3",
      subjectName: "Project Harbour",
      author: agent("hermes"),
      links: 2,
      createdAt: ago(2.3 * HOUR),
    },
    {
      ...base,
      ref: "action:5",
      type: "action",
      kind: "reply",
      text: "Here is the pricing table I promised, see the second tab. The clinic discount is spelled out per seat for 20 and for 50 seats, and the pilot price holds until the end of February.",
      summary:
        "Reply Kai Moreno: Here is the pricing table I promised, see the second tab. The clinic discount is spelled out per…",
      verb: "reply",
      targetName: "Kai Moreno",
      chatName: "Kai Moreno",
      status: "proposed",
      author: agent("hermes"),
      links: 0,
      reason: "Kai asked for the pricing table twice this week.",
      scope: null,
      account: "telegram:1",
      target: "msg:telegram/1/77/42",
      createdAt: ago(2.6 * HOUR),
    },
    {
      ...base,
      ref: "memory:40",
      type: "memory",
      kind: "summary",
      text: "Ana Ruiz is moving to Valencia in December and is looking for a flat near the old town, two bedrooms, with a budget around 1,400 a month. She asked twice whether you know a landlord there.",
      status: "proposed",
      scope: "personal",
      subject: "person:9",
      subjectName: "Ana Ruiz",
      author: agent("claude-code"),
      links: 2,
      createdAt: ago(DAY + 3 * HOUR),
    },
    {
      ...base,
      ref: "action:4",
      type: "action",
      kind: "create_task",
      text: "Send Kai the pricing table with the clinic discount",
      summary: "Create task Kai Moreno: Send Kai the pricing table with the clinic discount",
      verb: "create_task",
      targetName: "Kai Moreno",
      chatName: "Kai Moreno",
      status: "approved",
      author: agent("hermes"),
      links: 0,
      reason: "Kai asked for the pricing table twice this week.",
      scope: null,
      account: "telegram:1",
      target: "chat:telegram/1/77",
      task: PRICING_TASK,
      createdAt: ago(DAY + 4 * HOUR),
      updatedAt: ago(DAY + 3.5 * HOUR),
    },
    {
      ...base,
      ref: "action:3",
      type: "action",
      kind: "evidence_findings",
      text: null,
      summary: "Create 1 fact and 2 tasks in Project Harbour",
      verb: "create",
      targetName: "Project Harbour",
      counts: { facts: 1, tasks: 2 },
      status: "approved",
      project: "project:3",
      projectName: "Project Harbour",
      subject: "project:3",
      subjectName: "Project Harbour",
      scope: null,
      author: agent("hermes"),
      links: 0,
      target: "project:3",
      createdAt: ago(DAY + 5 * HOUR),
      updatedAt: ago(DAY + 4.5 * HOUR),
      findings: [
        {
          id: "h1",
          kind: "fact",
          text: "Both pilot clinics sign the data agreement before the February pilot starts.",
          reason: null,
          evidence: ["msg:telegram/1/204/1170"],
          outcome: "accepted",
          created: "fact:22",
        },
        {
          id: "h2",
          kind: "task",
          text: "Book the two pilot clinics for February",
          reason: "The pilot dates depend on both clinics saying yes.",
          evidence: ["msg:telegram/1/204/1170"],
          outcome: "accepted",
          created: CLINICS_TASK,
        },
        {
          id: "h3",
          kind: "task",
          text: "Print the onboarding script for the clinics",
          reason: "Lena mentioned it once, as an idea.",
          evidence: ["msg:telegram/1/204/1172"],
          outcome: "rejected",
          created: null,
        },
      ],
    },
    {
      ...base,
      ref: "fact:22",
      type: "fact",
      kind: "decision",
      text: "Both pilot clinics sign the data agreement before the February pilot starts.",
      status: "accepted",
      project: "project:3",
      projectName: "Project Harbour",
      subject: "project:3",
      subjectName: "Project Harbour",
      author: agent("hermes"),
      links: 1,
      createdAt: ago(DAY + 4.5 * HOUR),
    },
    {
      ...base,
      ref: "memory:39",
      type: "memory",
      kind: "digest",
      text: "Project Harbour this week: the clinics confirmed the February pilot, Lena Ortiz owns the onboarding script, and the open question is who signs the data agreement on the clinics' side. Two calls slipped because the agenda arrived late; Kai wants it the evening before.",
      status: "confirmed",
      subject: "project:3",
      subjectName: "Project Harbour",
      author: agent("hermes"),
      links: 5,
      createdAt: ago(DAY + 6 * HOUR),
    },
    {
      ...base,
      ref: "memory:38",
      type: "memory",
      kind: "preference",
      text: "You want reminders in the morning, never after 21:00.",
      status: "confirmed",
      scope: "personal",
      subject: "person:1",
      subjectIsOwner: true,
      author: OWNER,
      links: 1,
      createdAt: ago(3 * DAY),
    },
    {
      ...base,
      ref: "fact:12",
      type: "fact",
      kind: "promise",
      text: "You promised Kai the pricing table by 4 November.",
      status: "accepted",
      project: "project:3",
      projectName: "Project Harbour",
      subject: "person:7",
      subjectName: "Kai Moreno",
      author: agent("claude-code"),
      links: 1,
      createdAt: ago(3 * DAY + 2 * HOUR),
    },
    {
      ...base,
      ref: "memory:31",
      type: "memory",
      kind: "preference",
      text: "Kai Moreno prefers Monday morning calls.",
      status: "stale",
      subject: "person:7",
      subjectName: "Kai Moreno",
      author: agent("claude-code"),
      links: 2,
      createdAt: ago(19 * DAY),
    },
  ]
}

// Relationships with each standing: an agent's proposal, the owner's, a CRM's report and one that ended.
const relation = (
  ref: string,
  kind: string,
  [subject, subjectName]: [string, string],
  [target, targetName]: [string, string],
  role: string | null,
  standing: string,
  createdAt: string,
): MemoryEntry => ({
  ...base,
  ref,
  type: "relationship",
  kind,
  text: null,
  status: standing === "proposed" ? "proposed" : standing === "ended" ? "stale" : "confirmed",
  scope: null,
  subject,
  subjectName,
  target,
  targetName,
  role,
  standing,
  author: standing === "proposed" ? agent("claude-code") : null,
  account: standing === "reported" ? "bitrix24:acme.example" : null,
  links: 0,
  createdAt,
})

const KAI: [string, string] = ["person:7", "Kai Moreno"]
const NORTHSTAR: [string, string] = ["organization:2", "Northstar Consulting"]

function relationships(): MemoryEntry[] {
  return [
    {
      ...relation("relationship:5", "member-of", KAI, NORTHSTAR, "decision-maker", "proposed", ago(2 * HOUR)),
      reason: "Signs every Northstar order in the thread with Ana.",
    },
    relation(
      "link:9",
      "member-of",
      KAI,
      ["organization:3", "Harbour Studio"],
      "board-member",
      "confirmed",
      ago(9 * DAY),
    ),
    relation("link:10", "reports-to", ["person:8", "Ana Ruiz"], KAI, null, "reported", ago(4 * DAY)),
    relation("link:11", "customer-of", NORTHSTAR, ["organization:1", "Your company"], null, "reported", ago(4 * DAY)),
    relation(
      "link:12",
      "member-of",
      ["person:8", "Ana Ruiz"],
      ["organization:4", "Old Mill"],
      "employee",
      "ended",
      ago(30 * DAY),
    ),
  ]
}

const ROLES = [
  { list: "organization", id: "employee", label: null, builtIn: true },
  { list: "organization", id: "board-member", label: "Board member", builtIn: false },
  { list: "deal", id: "decision-maker", label: null, builtIn: true },
]

const PEOPLE = ["Kai Moreno", "Ana Ruiz", "Project Harbour", "Lena Ortiz", "Tom Becker"]
const AGENTS = ["claude-code", "hermes", "openclaw", "codex-nbb-evaluation"]
const STATUSES = ["proposed", "confirmed", "confirmed", "stale", "superseded"]

function many(): MemoryEntry[] {
  return Array.from({ length: 300 }, (_, i) => {
    const fact = i % 3 === 1
    const person = PEOPLE[i % PEOPLE.length] ?? "Kai Moreno"
    const status = STATUSES[i % STATUSES.length] ?? "proposed"
    return {
      ...base,
      ref: fact ? `fact:${1000 + i}` : `memory:${1000 + i}`,
      type: fact ? "fact" : "memory",
      kind: fact ? "statement" : "summary",
      text: `${person} mentioned item ${i + 1} in a conversation about the spring plans.`,
      status:
        i % 7 === 0
          ? fact
            ? "accepted"
            : "confirmed"
          : fact && status === "confirmed"
            ? "accepted"
            : fact && status === "stale"
              ? "rejected"
              : status,
      subject: `person:${10 + (i % PEOPLE.length)}`,
      subjectName: person,
      ...(fact ? (i % 2 ? { project: "project:3", projectName: "Project Harbour" } : NBB) : {}),
      author: i % 7 === 0 ? OWNER : agent(AGENTS[i % AGENTS.length] ?? "claude-code"),
      links: 1 + (i % 4),
      createdAt: ago(Math.floor((i * 40) / 300) * DAY + (i % 9) * HOUR),
    }
  })
}

const SOURCES: Record<string, MemorySource[]> = {
  "action:7": [
    {
      ref: "document:31",
      kind: "document",
      title: "Northbridge Bench: October evaluation",
      sender: null,
      at: ago(3 * DAY),
      excerpt: "Spanish answers scored 18 points below English ones on the 80-query set.",
      tool: "drive",
      missing: false,
    },
    {
      ref: "msg:telegram/1/204/1180",
      kind: "message",
      title: null,
      sender: "Lena Ortiz",
      at: ago(2 * DAY),
      excerpt: "Can we get Spanish coverage in before the review?",
      tool: "telegram",
      missing: false,
    },
  ],
  "memory:41": [
    {
      ref: "msg:telegram/1/77/905",
      kind: "message",
      title: null,
      sender: "Kai Moreno",
      at: ago(4 * DAY),
      excerpt: "Friday after 3 works best for me, send the points the night before?",
      tool: "telegram",
      missing: false,
    },
    {
      ref: "msg:telegram/1/77/612",
      kind: "message",
      title: null,
      sender: "Kai Moreno",
      at: ago(18 * DAY),
      excerpt: "Can we move it to Friday? Mondays are packed.",
      tool: "telegram",
      missing: false,
    },
    {
      ref: "meeting:88",
      kind: "meeting",
      title: "Harbour weekly",
      sender: null,
      at: ago(7 * DAY),
      excerpt: "…as Kai said, Fridays, and the agenda first.",
      tool: "zoom",
      missing: false,
    },
  ],
  "fact:17": [
    {
      ref: "note:52",
      kind: "note",
      title: "Harbour launch plan",
      sender: null,
      at: ago(2 * DAY),
      excerpt: "Launch: 2 March. Pilot with two clinics in February, as agreed on the call.",
      tool: "obsidian",
      missing: false,
    },
    {
      ref: "mail:work/4410",
      kind: "mail",
      title: "Re: Harbour timeline",
      sender: "Lena Ortiz",
      at: ago(DAY + 5 * HOUR),
      excerpt: "Confirmed with the clinics, they are fine with February for the pilot.",
      tool: "mail",
      missing: false,
    },
  ],
  "memory:40": [
    {
      ref: "msg:whatsapp/1/12/88",
      kind: "message",
      title: null,
      sender: "Ana Ruiz",
      at: ago(DAY + 4 * HOUR),
      excerpt: "We are moving in December! Looking for something near the old town.",
      tool: "whatsapp",
      missing: false,
    },
    {
      ref: "note:12",
      kind: "note",
      title: "Valencia",
      sender: null,
      at: ago(DAY + 6 * HOUR),
      excerpt: null,
      tool: "obsidian",
      missing: false,
    },
  ],
}

const GONE: MemorySource = {
  ref: "note:12",
  kind: "note",
  title: "Valencia",
  sender: null,
  at: ago(9 * DAY),
  excerpt: null,
  tool: "obsidian",
  missing: true,
}

const ACTIVITY: AgentCall[] = [
  {
    id: "11",
    agent: "codex-nbb-evaluation",
    tool: "projects_actions_add",
    tier: "write",
    status: "ok",
    error: null,
    at: ago(1.2 * HOUR),
  },
  {
    id: "10",
    agent: "codex-nbb-evaluation",
    tool: "facts_add",
    tier: "write",
    status: "ok",
    error: null,
    at: ago(1.3 * HOUR),
  },
  { id: "9", agent: "claude-code", tool: "memories_add", tier: "write", status: "ok", error: null, at: ago(2 * HOUR) },
  {
    id: "8",
    agent: "claude-code",
    tool: "search_all",
    tier: "read",
    status: "ok",
    error: null,
    at: ago(2 * HOUR + 60_000),
  },
  { id: "7", agent: "hermes", tool: "facts_add", tier: "write", status: "ok", error: null, at: ago(2.3 * HOUR) },
  { id: "6", agent: "hermes", tool: "actions_add", tier: "write", status: "ok", error: null, at: ago(2.6 * HOUR) },
  {
    id: "5",
    agent: "hermes",
    tool: "messages_send",
    tier: "write",
    status: "error",
    error: "permission denied: messages send is read-only for this profile",
    at: ago(2.7 * HOUR),
  },
  { id: "4", agent: "claude-code", tool: "memories_list", tier: "read", status: "ok", error: null, at: ago(DAY) },
]

const CHAT: Record<string, { sender: string; text: string }[]> = {
  "msg:telegram/1/77/905": [
    { sender: "You", text: "Can we do the Harbour sync this week?" },
    { sender: "Kai Moreno", text: "Yes, but not Monday, that one always explodes." },
    { sender: "Kai Moreno", text: "Friday after 3 works best for me, send the points the night before?" },
    { sender: "You", text: "Deal. I'll send them Thursday evening." },
    { sender: "Kai Moreno", text: "Perfect 👍" },
  ],
}

function context(ref: string): SourceContext {
  const prefix = ref.split(":")[0] ?? ""
  if (prefix === "msg") {
    const chat = CHAT[ref] ?? [
      {
        sender: "Lena Ortiz",
        text: "Before the review, can we cover Spanish too? Half the pilot users write in Spanish.",
      },
      { sender: "Tom Becker", text: "The runner logs are on the shared box, I can give read access." },
      { sender: "Lena Ortiz", text: "Nobody took the Spanish queries yet, right?" },
    ]
    const anchor = CHAT[ref] ? 2 : 0
    return {
      kind: "messages",
      items: chat.map((m, i) => ({
        ref: i === anchor ? ref : null,
        sender: m.sender,
        at: ago((chat.length - i) * 9 * 60_000 + 4 * DAY),
        text: m.text,
        anchor: i === anchor,
      })),
    }
  }
  if (prefix === "note" || prefix === "document")
    return {
      kind: "note",
      title: prefix === "document" ? "Northbridge evaluation plan.md" : "Harbour launch plan",
      text: "## Plan\n\nLaunch: 2 March. Pilot with two clinics in February, as agreed on the call.\n\nThe evaluation set moves to 120 queries; 40 in Spanish. Nightly run at 02:00 on the shared runner.",
      file: true,
    }
  return { kind: "unsupported", prefix }
}

export function memoryMock(): Pick<
  Platform,
  | "memoryRead"
  | "memorySources"
  | "memoryConfirm"
  | "memoryDiscard"
  | "memoryCorrect"
  | "memoryForget"
  | "memorySourceContext"
  | "memoryOpenSource"
  | "memoryReviewShow"
  | "memoryReviewDecide"
  | keyof ReturnType<typeof memoryAddMock>
> {
  const marked = (e: MemoryEntry): MemoryEntry =>
    scenario === "changed" && MARKED[e.ref] ? { ...e, sourceReview: MARKED[e.ref] ?? null } : e
  let entries: MemoryEntry[] =
    scenario === "none" ? [] : scenario === "many" ? many() : [...seed(), ...relationships()].map(marked)
  let next = 50

  const find = (ref: string) => {
    const e = entries.find((x) => x.ref === ref)
    if (!e) throw new Error(`the record ${ref} is not in the local store`)
    return e
  }
  const write = async () => {
    await delay(500)
    if (fail === "write") throw new Error(BUSY)
  }
  const update = (ref: string, status: string, standing?: string) => {
    const old = find(ref)
    const e = { ...old, status, updatedAt: new Date().toISOString(), standing: standing ?? old.standing ?? null }
    entries = entries.map((x) => (x.ref === ref ? e : x))
    return e
  }

  // memo closes a batch with nothing accepted as rejected.
  const review = (ref: string, accept: string[]) => {
    const e = find(ref)
    const findings = (e.findings ?? []).map((f) => {
      const accepted = accept.includes(f.id)
      // The mock has no store behind it: a created fact is not added, a created task is one the Tasks mock holds.
      const created = !accepted ? null : f.kind === "task" ? CLINICS_TASK : null
      return { ...f, outcome: accepted ? "accepted" : "rejected", created }
    })
    const done = { ...update(ref, accept.length ? "approved" : "rejected"), findings }
    entries = entries.map((x) => (x.ref === ref ? done : x))
    return done
  }

  return {
    ...memoryAddMock((batch) => {
      entries = [batch, ...entries]
    }),
    async memoryReviewShow(ref, id) {
      await delay(400)
      const review = REVIEWS[id]
      if (!review || find(ref).sourceReview?.id !== id)
        throw new Error("This review is not about this record any more.")
      return review
    },
    async memoryReviewDecide(ref, _id, answer, reason) {
      await write()
      if (answer === "dismiss" && !reason?.trim()) throw new Error("Say in a few words why it does not matter.")
      const e = find(ref)
      const status = answer !== "withdraw" ? e.status : e.type === "fact" ? "reversed" : "stale"
      const done = { ...update(ref, status), sourceReview: null }
      entries = entries.map((x) => (x.ref === ref ? done : x))
      return done
    },
    async memorySourceContext(ref) {
      await delay(350)
      return context(ref)
    },
    async memoryOpenSource() {
      await delay(200)
    },
    async memoryRead(): Promise<MemoryRead> {
      await delay(700)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: "0.124.0", need: "0.131.11" }
      if (fail === "read") throw new Error(BUSY)
      return {
        kind: "ready",
        entries: [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        more: scenario === "many",
        activity: scenario === "none" ? [] : ACTIVITY,
        activityError: null,
        revoke: params.get("memory-revoke") !== "old",
        roles: ROLES,
      }
    },
    async memorySources(ref) {
      await delay(400)
      const known = SOURCES[ref]
      if (scenario === "gone" && ref === "memory:41") return [...(known ?? []).slice(0, 2), GONE]
      if (known) return known
      const e = find(ref)
      return Array.from({ length: e.links }, (_, i) => ({
        ref: `note:${200 + i}`,
        kind: "note",
        title: `${e.subjectName ?? "Notes"}, part ${i + 1}`,
        sender: null,
        at: e.createdAt,
        excerpt: "A line from the note this rests on.",
        tool: "obsidian",
        missing: false,
      }))
    },
    async memoryConfirm(ref, accept) {
      await write()
      const e = find(ref)
      if (e.findings) return review(ref, accept ?? e.findings.map((f) => f.id))
      if (e.type === "action") {
        const done = { ...update(ref, "approved"), task: PRICING_TASK }
        entries = entries.map((x) => (x.ref === ref ? done : x))
        return done
      }
      if (e.type === "relationship") return update(ref, "confirmed", "confirmed")
      return update(ref, e.type === "fact" ? "accepted" : "confirmed")
    },
    async memoryDiscard(ref) {
      await write()
      const e = find(ref)
      if (e.findings) return review(ref, [])
      if (e.type === "memory") return update(ref, "stale")
      if (e.type === "action") return update(ref, "rejected")
      if (e.type === "relationship") return update(ref, "rejected", "rejected")
      if (e.status === "proposed") return update(ref, "rejected")
      if (e.status === "accepted" && e.kind === "decision") return update(ref, "reversed")
      if (e.status === "accepted" && e.author?.type === "person") throw new Error("fact.owner-written")
      if (e.status === "accepted" && e.supersedes) throw new Error("fact.revoke-correction")
      if (e.status === "accepted" && params.get("memory-revoke") !== "old") return update(ref, "proposed")
      throw new Error("Only a proposed fact or an accepted decision can be discarded.")
    },
    async memoryCorrect(ref, text) {
      await write()
      const old = find(ref)
      update(ref, "superseded")
      const added: MemoryEntry = {
        ...old,
        ref: `${old.type}:${next++}`,
        text,
        status: old.type === "fact" ? "accepted" : "confirmed",
        author: OWNER,
        supersedes: ref,
        sourceReview: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
      }
      entries = [added, ...entries]
      return added
    },
    async memoryForget(ref) {
      await write()
      const e = find(ref)
      entries = entries.filter((x) => x.ref !== ref)
      return { ref, links: e.links }
    },
  }
}

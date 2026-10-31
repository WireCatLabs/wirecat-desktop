import type { AgentCall, MemoryEntry, MemoryRead, MemorySource } from "./memory-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// The Memory page's stand-in for memo, with made-up people only. `?memory=none` holds nothing, `missing` has no memo,
// `old` an older memo, `many` 300 entries across 40 days, `gone` one source deleted since. `?memory-fail=read` fails
// the read (another sync holds the store), `?memory-fail=write` fails every write the same way.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("memory")
const fail = params.get("memory-fail")
const BUSY = "another process holds the store (store.busy); try again in a minute"

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Times from now, so "Today" and "Yesterday" hold whichever day the build is opened. */
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

const base = {
  subject: null,
  subjectName: null,
  subjectIsOwner: false,
  scope: "work",
  project: null,
  supersedes: null,
  reason: null,
  account: null,
  target: null,
  updatedAt: null,
} as const

const agent = (name: string) => ({ type: "bot", name })
const OWNER = { type: "person", name: null }

function seed(): MemoryEntry[] {
  return [
    {
      ...base,
      ref: "memory:41",
      type: "memory",
      kind: "preference",
      text: "Kai Sample prefers calls on Friday afternoons and asks for the agenda the evening before.",
      status: "proposed",
      subject: "person:7",
      subjectName: "Kai Sample",
      author: agent("claude-code"),
      links: 3,
      createdAt: ago(2 * HOUR),
    },
    {
      ...base,
      ref: "fact:17",
      type: "fact",
      kind: "decision",
      text: "Harbour launch moves to 2 March; the pilot with two clinics stays in February.",
      status: "proposed",
      project: "HRB",
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
      text: "Here is the pricing table I promised, see the second tab.",
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
      text: "Ana Ruiz is moving to Valencia in December and is looking for a flat near the old town.",
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
      subject: "person:7",
      subjectName: "Kai Sample",
      author: agent("claude-code"),
      links: 1,
      createdAt: ago(3 * DAY + 2 * HOUR),
    },
    {
      ...base,
      ref: "memory:31",
      type: "memory",
      kind: "preference",
      text: "Kai Sample prefers Monday morning calls.",
      status: "stale",
      subject: "person:7",
      subjectName: "Kai Sample",
      author: agent("claude-code"),
      links: 2,
      createdAt: ago(19 * DAY),
    },
  ]
}

const PEOPLE = ["Kai Sample", "Ana Ruiz", "Project Harbour", "Lena Ortiz", "Tom Becker"]
const AGENTS = ["claude-code", "hermes", "openclaw", "codex"]
const STATUSES = ["proposed", "confirmed", "confirmed", "stale", "superseded"]

function many(): MemoryEntry[] {
  return Array.from({ length: 300 }, (_, i) => {
    const fact = i % 3 === 1
    const person = PEOPLE[i % PEOPLE.length] ?? "Kai Sample"
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
      author: i % 7 === 0 ? OWNER : agent(AGENTS[i % AGENTS.length] ?? "claude-code"),
      links: 1 + (i % 4),
      createdAt: ago(Math.floor((i * 40) / 300) * DAY + (i % 9) * HOUR),
    }
  })
}

const SOURCES: Record<string, MemorySource[]> = {
  "memory:41": [
    {
      ref: "msg:telegram/1/77/905",
      kind: "message",
      title: null,
      sender: "Kai Sample",
      at: ago(4 * DAY),
      excerpt: "Friday after 3 works best for me, send the points the night before?",
      tool: "telegram",
      missing: false,
    },
    {
      ref: "msg:telegram/1/77/612",
      kind: "message",
      title: null,
      sender: "Kai Sample",
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

export function memoryMock(): Pick<
  Platform,
  "memoryRead" | "memorySources" | "memoryConfirm" | "memoryDiscard" | "memoryCorrect" | "memoryForget"
> {
  let entries: MemoryEntry[] = scenario === "none" ? [] : scenario === "many" ? many() : seed()
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
  const update = (ref: string, status: string) => {
    const e = { ...find(ref), status, updatedAt: new Date().toISOString() }
    entries = entries.map((x) => (x.ref === ref ? e : x))
    return e
  }

  return {
    async memoryRead(): Promise<MemoryRead> {
      await delay(700)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: "0.124.0", need: "0.130.0" }
      if (fail === "read") throw new Error(BUSY)
      return {
        kind: "ready",
        entries: [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        more: scenario === "many",
        activity: scenario === "none" ? [] : ACTIVITY,
        activityError: null,
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
    async memoryConfirm(ref) {
      await write()
      const e = find(ref)
      return update(ref, e.type === "fact" ? "accepted" : e.type === "action" ? "approved" : "confirmed")
    },
    async memoryDiscard(ref) {
      await write()
      const e = find(ref)
      if (e.type === "memory") return update(ref, "stale")
      if (e.type === "action") return update(ref, "rejected")
      if (e.status === "proposed") return update(ref, "rejected")
      if (e.status === "accepted" && e.kind === "decision") return update(ref, "reversed")
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

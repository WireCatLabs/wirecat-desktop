import { valuesOf } from "@/domain/query-terms"
import type {
  MeetingDetails,
  MeetingPage,
  MeetingParticipant,
  MeetingRow,
  MeetingSource,
  TranscriptLine,
} from "./bindings"
import { delay } from "./mock-delay"
import { memoDefault, OLD_MEMO } from "./mock-memo"
import type { Platform } from "./types"

// memo's `meetings list|show` (`?section=meetings`): this week's meetings and calls around today, with three at one
// time, a multi-day offsite, a call past midnight and a long transcript, plus two months of history for the table.
// `?meetings=empty` has none, `many` 1 400 so the table pages and a month window is cut at 500, `fail` refuses
// every read, `old` and `missing` are a memo too old or not installed; `?meetings-fail=show` refuses one meeting.
const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("meetings") ?? memoDefault({ missing: "missing", old: "old", failing: "fail" })
const failing = params.get("meetings-fail")

const MIN = 60_000
const HOUR = 60 * MIN
/** Local midnight `days` from today, plus `hours`: the mock follows the computer's clock so the week is never empty. */
const local = (days: number, hours = 0) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return new Date(d.getTime() + hours * HOUR)
}

const CALENDAR: MeetingSource = {
  provider: "google-calendar",
  account: "ana@example.org",
  source: "google-calendar:ana@example.org",
  label: "Google Calendar · ana@example.org",
  via: "calendar",
}
const ZOOM: MeetingSource = {
  provider: "zoom",
  account: "ana@example.org",
  source: "zoom:ana@example.org",
  label: "Zoom · ana@example.org",
  via: "meeting",
}
const PHONE: MeetingSource = {
  provider: "phone",
  account: "import",
  source: "phone:import",
  label: "Phone",
  via: "meeting",
}
const TELEGRAM: MeetingSource = {
  provider: "telegram",
  account: "personal",
  source: "telegram:personal",
  label: "Telegram · personal",
  via: "meeting",
}

const LENA: MeetingParticipant = {
  name: "Lena Ortiz",
  email: "lena@example.org",
  person: { ref: "person:7", name: "Lena Ortiz" },
  organizer: true,
}
const KAI: MeetingParticipant = {
  name: "Kai Moreno",
  email: "kai@example.org",
  person: { ref: "person:4", name: "Kai Moreno" },
  organizer: false,
}
const GUEST: MeetingParticipant = { name: null, email: "guest@example.net", person: null, organizer: false }

type Seed = Partial<MeetingRow> & { title: string; start: Date; end: Date }

const row = (i: number, s: Seed): MeetingRow => {
  const { start, end, ...rest } = s
  return {
    ref: `event:${600 + i}`,
    kind: "meeting",
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    durationMs: end.getTime() - start.getTime(),
    allDay: false,
    timezone: "Europe/Madrid",
    status: "confirmed",
    links: [],
    sources: [CALENDAR],
    participants: [LENA, KAI],
    participantsCount: 2,
    hasRecording: false,
    hasTranscript: false,
    hasSummary: false,
    documents: [],
    pendingFindings: 0,
    ...rest,
  }
}

const zoomLink = { source: "zoom", url: "https://zoom.us/j/1000000001" }

function week(): Seed[] {
  const standups = [-3, -2, -1, 0, 1].map(
    (d): Seed => ({
      title: "Standup",
      start: local(d, 9.5),
      end: local(d, 9.75),
      sources: [CALENDAR, ZOOM],
      links: [zoomLink],
      hasTranscript: d < 0,
    }),
  )
  return [
    ...standups,
    {
      ref: "event:665",
      title: "Board review",
      start: local(0, 12),
      end: local(0, 15),
      sources: [CALENDAR, ZOOM],
      links: [zoomLink],
      participants: [LENA, KAI, GUEST],
      participantsCount: 3,
      hasRecording: true,
      hasTranscript: true,
      hasSummary: true,
      documents: [{ ref: "document:40", title: "Q4 plan", role: "attachment" }],
      pendingFindings: 3,
    },
    {
      title: "Kai Moreno",
      kind: "call",
      start: local(-1, 10 + 1 / 3),
      end: local(-1, 11 + 1 / 30),
      sources: [PHONE],
      participants: [KAI],
      participantsCount: 1,
      hasTranscript: true,
    },
    { title: "Design review", start: local(1, 10), end: local(1, 11), sources: [CALENDAR] },
    { title: "Hiring sync", start: local(1, 10), end: local(1, 11), sources: [CALENDAR] },
    { title: "Vendor call", start: local(1, 10.5), end: local(1, 11.5), sources: [CALENDAR, ZOOM], links: [zoomLink] },
    {
      title: "Team offsite",
      kind: "event",
      start: local(2),
      end: local(4),
      allDay: true,
      participants: [],
      participantsCount: 0,
    },
    {
      title: "Lena Ortiz",
      kind: "call",
      start: local(-2, 23.5),
      end: local(-1, 0.7),
      sources: [TELEGRAM],
      participants: [LENA],
      participantsCount: 1,
    },
    { title: "1:1 Lena", start: local(2, 16), end: local(2, 16.5), sources: [CALENDAR], participants: [LENA] },
  ]
}

const history = (): Seed[] =>
  Array.from({ length: 40 }, (_, i) => ({
    title: ["Weekly review", "Client call", "Planning"][i % 3] ?? "Planning",
    start: local(-7 - i * 1.5, 11),
    end: local(-7 - i * 1.5, 12),
    hasTranscript: i % 2 === 0,
    sources: i % 2 === 0 ? [CALENDAR, ZOOM] : [CALENDAR],
  }))

const many = (): Seed[] =>
  Array.from({ length: 1_400 }, (_, i) => ({
    title: `Synthetic meeting ${i + 1}`,
    start: local(-15 + Math.floor(i / 40), 8 + (i % 10)),
    end: local(-15 + Math.floor(i / 40), 8.5 + (i % 10)),
  }))

const rows = (): MeetingRow[] =>
  (scenario === "empty" ? [] : scenario === "many" ? many() : [...week(), ...history()]).map((s, i) => row(i, s))

function matches(r: MeetingRow, query: string): boolean {
  const kinds = valuesOf(query, "kind")
  const sources = valuesOf(query, "source")
  const people = valuesOf(query, "person")
  const transcript = valuesOf(query, "has_transcript")
  const words = query
    .replace(/\S+:("[^"]*"|\[[^\]}]*[\]}]|\S+)/g, "")
    .split(/\s+/)
    .filter(Boolean)
  return (
    (kinds.length === 0 || kinds.includes(r.kind)) &&
    (sources.length === 0 || r.sources.some((s) => sources.includes(s.provider) || sources.includes(s.source))) &&
    (people.length === 0 || r.participants.some((p) => p.person && people.includes(p.person.ref))) &&
    (transcript.length === 0 || transcript.includes(String(r.hasTranscript))) &&
    words.every((w) => (r.title ?? "").toLowerCase().includes(w.toLowerCase()))
  )
}

const SPEAKERS = [LENA, KAI]
const transcriptLines = (total: number): TranscriptLine[] =>
  Array.from({ length: total }, (_, i) => {
    const who = SPEAKERS[i % 2] ?? LENA
    return {
      position: i,
      offsetMs: i * 7_000 + 4_000,
      speaker: who.name,
      person: who.person,
      text:
        i % 9 === 4
          ? "The budget for next year stays at the synthetic figure we agreed on."
          : `Point ${i + 1} of the synthetic agenda, with nothing from a real meeting.`,
    }
  })

const PART = 100

function show(ref: string, cursor: number): MeetingDetails {
  // A document names a meeting by its record (`meeting:<account>/<id>`); memo's show takes that ref too.
  const meeting = rows().find((r) => r.ref === ref || (ref.startsWith("meeting:") && r.ref === "event:665"))
  if (!meeting) throw new Error(`no meeting ${ref} in the store`)
  const total = meeting.title === "Board review" ? 1_240 : 24
  return {
    meeting,
    description: meeting.title === "Board review" ? "Agenda: the fourth quarter plan and the hiring budget." : null,
    location: null,
    summaries: meeting.hasSummary
      ? [
          {
            source: "zoom",
            title: null,
            overview: "The board agreed on the fourth quarter plan and asked for a hiring budget by Friday.",
            sections: [{ label: "Budget", text: "The synthetic budget grows by four percent." }],
            nextSteps: ["Lena sends the plan to the board", "Kai drafts the hiring budget"],
          },
        ]
      : [],
    transcript: meeting.hasTranscript
      ? {
          source: "zoom",
          language: "en",
          offset: cursor,
          total,
          hasMore: cursor + PART < total,
          lines: transcriptLines(total).slice(cursor, cursor + PART),
        }
      : null,
    findings: meeting.pendingFindings ? [{ id: "512", status: "proposed", findings: 4, pending: 3 }] : [],
  }
}

const FAILED = "another memo sync holds the store; try again when it ends"

export function meetingsMock(): Pick<Platform, "meetingsList" | "meetingsShow"> {
  return {
    async meetingsList(query, window, page, limit) {
      await delay(450)
      if (scenario === "fail") throw new Error(FAILED)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: OLD_MEMO, need: "0.133.0" }
      const from = window ? Date.parse(window.from) : Number.NEGATIVE_INFINITY
      const to = window ? Date.parse(window.to) : Number.POSITIVE_INFINITY
      const found = rows()
        .filter((r) => Date.parse(r.startedAt ?? "") < to && Date.parse(r.endedAt ?? "") > from && matches(r, query))
        .sort((a, b) => {
          const order = (a.startedAt ?? "").localeCompare(b.startedAt ?? "")
          return window ? order : -order
        })
      const meetings = found.slice((page - 1) * limit, page * limit)
      const accounts = [...new Set(rows().flatMap((r) => r.sources.map((s) => s.source)))].sort()
      const result: MeetingPage = {
        meetings,
        total: found.length,
        totalMore: false,
        more: page * limit < found.length,
        accounts,
      }
      return { kind: "ready", page: result }
    },
    async meetingsShow(ref, cursor) {
      await delay(400)
      if (failing === "show") throw new Error(FAILED)
      return show(ref, cursor)
    },
  }
}

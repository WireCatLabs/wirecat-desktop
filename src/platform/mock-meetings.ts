import { valuesOf } from "@/domain/query-terms"
import type {
  MeetingDetails,
  MeetingFound,
  MeetingPage,
  MeetingParticipant,
  MeetingRow,
  MeetingSource,
  TranscriptLine,
} from "./bindings"
import { delay } from "./mock-delay"
import { memoDefault, OLD_MEMO } from "./mock-memo"
import type { Platform } from "./types"

// memo's `meetings list|show` (`?section=meetings`): this week's meetings and calls around today, with two, three and
// five at one time, a multi-day offsite, a call past midnight, a full card (Board review) and a nearly empty one (ML
// Project), and a long transcript, plus two months of history for the table.
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
  calendar: "Work",
  pageUrl: "https://www.google.com/calendar/event?eid=ZXhhbXBsZQ",
  ownResponse: "accepted",
  conference: "Google Meet",
  ref: null,
}
const ZOOM: MeetingSource = {
  provider: "zoom",
  account: "ana@example.org",
  source: "zoom:ana@example.org",
  label: "Zoom · ana@example.org",
  via: "meeting",
  calendar: null,
  pageUrl: null,
  ownResponse: null,
  conference: null,
  ref: null,
}
const PHONE: MeetingSource = {
  provider: "phone",
  account: "import",
  source: "phone:import",
  label: "Phone",
  via: "meeting",
  calendar: null,
  pageUrl: null,
  ownResponse: null,
  conference: null,
  ref: null,
}
const TELEGRAM: MeetingSource = {
  provider: "telegram",
  account: "personal",
  source: "telegram:personal",
  label: "Telegram · personal",
  via: "meeting",
  calendar: null,
  pageUrl: null,
  ownResponse: null,
  conference: null,
  ref: null,
}

/** A pbx profile's call: the source names its store record, which pbx's `meetings show` reads. */
const pbx = (meeting: number): MeetingSource => ({
  provider: "asterisk",
  account: "office",
  source: "asterisk:office",
  label: "Asterisk · office",
  via: "meeting",
  calendar: null,
  pageUrl: null,
  ownResponse: null,
  conference: null,
  ref: `meeting:4/${meeting}`,
})

const LENA: MeetingParticipant = {
  name: "Lena Ortiz",
  email: "lena@example.org",
  person: { ref: "person:7", name: "Lena Ortiz" },
  organizer: true,
  response: "accepted",
}
const KAI: MeetingParticipant = {
  name: "Kai Moreno",
  email: "kai@example.org",
  person: { ref: "person:4", name: "Kai Moreno" },
  organizer: false,
  response: "tentative",
}
const GUEST: MeetingParticipant = {
  name: null,
  email: "guest@example.net",
  person: null,
  organizer: false,
  response: "declined",
}

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
    seriesId: null,
    recurrence: null,
    ...rest,
  }
}

const zoomLink = { source: "zoom:ana@example.org", url: "https://zoom.us/j/1000000001" }
const meetLink = { source: "google-calendar:ana@example.org", url: "https://meet.google.com/abc-defg-hij" }

function week(): Seed[] {
  const standups = [-3, -2, -1, 0, 1].map(
    (d): Seed => ({
      title: "Standup",
      start: local(d, 9.5),
      end: local(d, 9.75),
      sources: [{ ...CALENDAR, conference: "Zoom Meeting" }, ZOOM],
      links: [zoomLink],
      hasTranscript: d < 0,
      seriesId: "31",
      recurrence: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
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
      links: [meetLink, zoomLink],
      participants: [LENA, KAI, GUEST],
      participantsCount: 3,
      hasRecording: true,
      hasTranscript: true,
      hasSummary: true,
      documents: [{ ref: "document:40", title: "Q4 plan", role: "attachment" }],
      pendingFindings: 3,
      seriesId: "18",
      recurrence: "RRULE:FREQ=MONTHLY;INTERVAL=3",
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
    {
      title: "+34 600 555 014 → 201",
      kind: "call",
      start: local(-1, 16),
      end: local(-1, 16.05),
      sources: [pbx(77)],
      participants: [LENA],
      participantsCount: 1,
      hasRecording: true,
    },
    {
      title: "201 → +34 600 555 022",
      kind: "call",
      start: local(-2, 9),
      end: local(-2, 9.1),
      sources: [pbx(71)],
      participants: [KAI],
      participantsCount: 1,
      hasRecording: true,
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
    { title: "Roadmap", start: local(-1, 14), end: local(-1, 16), sources: [CALENDAR] },
    { title: "Budget check-in", start: local(-1, 14.75), end: local(-1, 15.5), sources: [CALENDAR] },
    {
      title: "Sprint planning",
      start: local(-2, 13),
      end: local(-2, 15),
      sources: [CALENDAR, ZOOM],
      links: [zoomLink],
    },
    { title: "Client demo", start: local(-2, 13), end: local(-2, 14), sources: [CALENDAR] },
    { title: "Interview", start: local(-2, 13.5), end: local(-2, 14.5), sources: [CALENDAR], participants: [GUEST] },
    { title: "Ops review", start: local(-2, 14), end: local(-2, 15), sources: [CALENDAR] },
    { title: "Coffee chat", start: local(-2, 14.25), end: local(-2, 14.75), sources: [CALENDAR] },
    {
      title: "ML Project",
      kind: "event",
      start: local(-3, 11),
      end: local(-3, 13),
      sources: [CALENDAR],
      participants: [],
      participantsCount: 0,
    },
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
  const all = rows()
  const meeting =
    all.find((r) => r.ref === ref || r.sources.some((s) => s.ref === ref)) ??
    all.find((r) => ref.startsWith("meeting:") && r.ref === "event:665")
  if (!meeting) throw new Error(`no meeting ${ref} in the store`)
  const total = meeting.title === "Board review" ? 1_240 : 24
  return {
    meeting,
    description: meeting.title === "Board review" ? "Agenda: the fourth quarter plan and the hiring budget." : null,
    location: meeting.title === "Board review" ? "Atlas room, third floor" : null,
    attachments:
      meeting.title === "Board review"
        ? [
            { fileId: "q4-plan", title: "Q4 plan", document: "document:40" },
            { fileId: "hiring", title: "Hiring budget.xlsx", document: null },
          ]
        : [],
    summaries: meeting.hasSummary
      ? [
          {
            source: "zoom",
            title: null,
            overview: "The board agreed on the fourth quarter plan and asked for a hiring budget by Friday.",
            sections: [{ label: "Budget", text: "The synthetic budget grows by four percent." }],
            nextSteps: ["Lena sends the plan to the board", "Kai drafts the hiring budget"],
            url: "https://docs.google.com/document/d/synthetic-notes",
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

/**
 * pbx's two calls by their record or their own id (`<uniqueid>#<sequence>`, as a link names it): 77's recording is a
 * file here, 71's stays on the phone system. `?recording=gone|old|large|gsm` changes 77's: the file was removed, a pbx
 * too old to say where, a file too large to play, a GSM file the window cannot play.
 */
const CALLS: Record<string, { ref: string; here: boolean }> = {
  "meeting:4/77": { ref: "meeting:4/77", here: true },
  "1731571200.42#3": { ref: "meeting:4/77", here: true },
  "meeting:4/71": { ref: "meeting:4/71", here: false },
  "1731484800.17#1": { ref: "meeting:4/71", here: false },
}

function found(provider: string, profile: string, meeting: string): MeetingFound {
  const call = provider === "asterisk" && profile === "office" ? CALLS[meeting] : undefined
  if (!call) throw new Error(`pbx: no meeting ${meeting} in the store (meeting.not-found)`)
  const name = call.here ? "out-201-1731571200.42.wav" : "in-201-1731484800.17.WAV"
  if (!call.here) return { ref: call.ref, recording: { kind: "elsewhere", name } }
  const variant = params.get("recording")
  if (variant === "gone") return { ref: call.ref, recording: { kind: "gone", name } }
  if (variant === "old") return { ref: call.ref, recording: { kind: "unknown", name } }
  const gsm = variant === "gsm"
  const size = variant === "large" ? 300 * 1024 * 1024 : TONE_SECONDS * RATE * 2 + 44
  return {
    ref: call.ref,
    recording: { kind: "here", name, mime: gsm ? "audio/x-gsm" : "audio/wav", size, tooLarge: variant === "large" },
  }
}

const RATE = 8_000
const TONE_SECONDS = 3

/** A synthetic recording: three seconds of a soft 440 Hz tone, 16-bit mono WAV at a phone line's 8 kHz. */
function tone(): ArrayBuffer {
  const samples = TONE_SECONDS * RATE
  const view = new DataView(new ArrayBuffer(44 + samples * 2))
  const text = (at: number, word: string) => {
    for (let i = 0; i < word.length; i++) view.setUint8(at + i, word.charCodeAt(i))
  }
  text(0, "RIFF")
  view.setUint32(4, 36 + samples * 2, true)
  text(8, "WAVEfmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, RATE, true)
  view.setUint32(28, RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, "data")
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.sin((2 * Math.PI * 440 * i) / RATE) * 6_000, true)
  return view.buffer
}

export function meetingsMock(): Pick<
  Platform,
  "meetingsList" | "meetingsShow" | "meetingFind" | "meetingRecordingRead" | "meetingRecordingOpen"
> {
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
    async meetingFind(provider, profile, meeting) {
      await delay(350)
      return found(provider, profile, meeting)
    },
    async meetingRecordingRead(provider, profile, meeting) {
      await delay(300)
      if (found(provider, profile, meeting).recording.kind !== "here") throw new Error("not on this computer")
      return tone()
    },
    async meetingRecordingOpen() {
      await delay(300)
    },
  }
}

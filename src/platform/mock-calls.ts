import type { CallOpened, ClientCall, ToolNetwork } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const HOUR = 3_600_000
const at = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString()

/**
 * A client's calls as cli-core's `meetings` lists them: a phone line's call with a transcript, one without, a Zoom
 * meeting, and a line WireCat has no tool for. Numbers and names are made up; `?calls=old` is a CLI from before
 * cli-core 0.650.0, which names no calls.
 */
export const MOCK_CALLS: ClientCall[] = [
  {
    ref: "meeting:4/77",
    meetingId: 77,
    provider: "asterisk",
    account: "office",
    tool: "pbx",
    title: "+34 600 555 014 → 201 Ana Ruiz",
    startedAt: at(26),
    durationMs: 184_000,
    hasTranscript: true,
  },
  {
    ref: "meeting:4/71",
    meetingId: 71,
    provider: "asterisk",
    account: "office",
    tool: "pbx",
    title: "201 Ana Ruiz → +34 600 555 014",
    startedAt: at(75),
    durationMs: 42_000,
    hasTranscript: false,
  },
  {
    ref: "meeting:2/5",
    meetingId: 5,
    provider: "zoom",
    account: "ana@example.org",
    tool: "zm",
    title: "Delivery plan review",
    startedAt: at(140),
    durationMs: 1_920_000,
    hasTranscript: true,
  },
  {
    ref: "meeting:9/3",
    meetingId: 3,
    provider: "beeline",
    account: "line",
    tool: null,
    title: "Входящий звонок · Ана ↔ +7 900 555-01-02",
    startedAt: at(300),
    durationMs: 61_000,
    hasTranscript: false,
  },
]

export const mockCalls = (): ClientCall[] | null => (params.get("calls") === "old" ? null : MOCK_CALLS)

const opened = (meeting: number, transcript: boolean): CallOpened => ({
  show: {
    item: {
      ref: `meeting:4/${meeting}`,
      participants: [
        { name: "Ana Ruiz", email: null, role: "manager", person: null },
        { name: null, email: null, role: "client", person: { ref: "person:7", name: "Lena Ortiz" } },
      ],
    },
  },
  transcript: transcript
    ? {
        items: [
          {
            lines: [
              { position: 1, offset_ms: 0, end_ms: 4000, speaker: "Ana Ruiz", text: "Hello, Northstar, Ana speaking." },
              { position: 2, offset_ms: 4200, end_ms: 9000, speaker: null, text: "Hi, it's Lena about the delivery." },
              { position: 3, offset_ms: 9500, end_ms: 15000, speaker: "Ana Ruiz", text: "It leaves on Friday." },
            ],
          },
        ],
      }
    : null,
})

const NETWORK: Record<string, ToolNetwork> = {
  memo: { kind: "undeclared" },
  max: { kind: "undeclared" },
  email: {
    kind: "declared",
    hosts: ["login.microsoftonline.com", "accounts.google.com", "imap.gmail.com", "smtp.gmail.com"],
    userHosts: "the mail server you sign in to",
  },
  pbx: { kind: "declared", hosts: [], userHosts: "the Asterisk CDR database or SFTP server you set up" },
}

export function callsMock(): Pick<Platform, "callOpen" | "toolNetwork"> {
  return {
    async callOpen(_tool, _profile, meeting, transcript) {
      await delay(500)
      if (params.get("calls") === "fail") throw new Error("pbx: the store is busy, try again (store.busy)")
      return opened(meeting, transcript)
    },
    async toolNetwork(id) {
      await delay(150)
      return NETWORK[id] ?? { kind: "declared", hosts: [`api.${id}.example`], userHosts: null }
    },
  }
}

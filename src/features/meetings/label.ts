import type { Lang } from "@/i18n"
import type { MeetingRow } from "@/platform/bindings"
import { sourceOf } from "@/shared/SourceIcon"
import type { meetingMessages } from "./messages"

type M = (typeof meetingMessages)["en"]

const services = (meeting: MeetingRow) => [...new Set(meeting.sources.map((s) => sourceOf(s.provider).name))]

/** A meeting's name for screen readers, said once: title, when, where it came from, and what it carries. */
export function meetingLabel(meeting: MeetingRow, m: M, lang: Lang): string {
  const start = meeting.startedAt ? new Date(meeting.startedAt) : null
  const end = meeting.endedAt ? new Date(meeting.endedAt) : null
  const day = (d: Date) => d.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })
  const time = (d: Date) => d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })
  const when = !start
    ? ""
    : meeting.allDay
      ? `${day(start)}, ${m.allDay}`
      : `${day(start)} ${time(start)}${end ? ` – ${time(end)}` : ""}`
  return [
    meeting.title ?? m.columns.title,
    when,
    ...services(meeting),
    meeting.hasTranscript && m.transcript,
    meeting.hasSummary && m.summary,
    meeting.hasRecording && m.recording,
    meeting.pendingFindings > 0 && m.toConfirm(meeting.pendingFindings),
  ]
    .filter(Boolean)
    .join(", ")
}

export { services }

import { AlignLeft, CalendarDays, Disc, FileText, Phone, Video } from "lucide-react"
import { useLang, useMessages } from "@/i18n"
import type { MeetingRow } from "@/platform/bindings"
import { SourceIcon } from "@/shared/SourceIcon"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { meetingMessages } from "./messages"

const ICON = "size-[0.9rem] shrink-0"
const MESSENGERS = new Set(["telegram", "max", "whatsapp"])

/** A meeting's kind by shape: a camera, a bare calendar event, a phone, or the messenger a call came through. */
export function KindIcon({ meeting, className = ICON }: { meeting: MeetingRow; className?: string }) {
  if (meeting.kind === "call") {
    const messenger = meeting.sources.find((s) => MESSENGERS.has(s.provider))
    return messenger ? (
      <SourceIcon provider={messenger.provider} className={className} />
    ) : (
      <Phone className={className} aria-hidden />
    )
  }
  if (meeting.kind === "event") return <CalendarDays className={className} aria-hidden />
  return <Video className={className} aria-hidden />
}

/** "9:30 AM" in English, "09:30" in Russian and Spanish, as the hour gutter writes them. */
const timeText = (iso: string | null, lang: string) =>
  iso ? new Date(iso).toLocaleTimeString(lang, { hour: lang === "en" ? "numeric" : "2-digit", minute: "2-digit" }) : ""

/** What a meeting carries, as icons; each is named in the meeting's own label, so they stay hidden here. */
function Badges({ meeting, count }: { meeting: MeetingRow; count: boolean }) {
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-[0.2rem] text-ink-dim" aria-hidden>
      {meeting.hasTranscript && <FileText className="size-[0.8rem]" />}
      {meeting.hasSummary && <AlignLeft className="size-[0.8rem]" />}
      {meeting.hasRecording && <Disc className="size-[0.8rem]" />}
      {meeting.pendingFindings > 0 && (
        <span className="inline-flex items-center gap-[0.15rem]">
          <Lamp tone="warn" size="sm" />
          {count && <span className="font-mono text-[0.85rem] text-ink-soft">{meeting.pendingFindings}</span>}
        </span>
      )}
    </span>
  )
}

const past = (m: MeetingRow) => !!m.endedAt && Date.parse(m.endedAt) < Date.now()
const now = (m: MeetingRow) =>
  !!m.startedAt && !!m.endedAt && Date.parse(m.startedAt) <= Date.now() && Date.now() < Date.parse(m.endedAt)
const cancelled = (m: MeetingRow) => m.status === "cancelled"

/** A meeting in the week's time grid: a filled block with a bar for a meeting, a dashed outline for a call. */
export function MeetingBlock({
  meeting,
  minutes,
  fromBefore,
  goesOn,
}: {
  meeting: MeetingRow
  minutes: number
  fromBefore: boolean
  goesOn: boolean
}) {
  const lang = useLang()
  const m = useMessages(meetingMessages)
  const call = meeting.kind === "call"
  const two = minutes >= 45
  // A part that began the day before starts at this day's midnight, marked as carried over.
  const start = fromBefore
    ? `← ${timeText(new Date(new Date().setHours(0, 0, 0, 0)).toISOString(), lang)}`
    : timeText(meeting.startedAt, lang)
  return (
    <span
      className={cx(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-control px-[0.35rem] py-[0.1rem] text-[0.85rem] leading-[1.25rem]",
        "transition-colors duration-(--motion-fast) hover:border-ink-dim",
        call
          ? "border border-line-strong border-dashed bg-app"
          : "border border-line-strong border-l-[3px] border-l-ink-soft bg-app-2",
        past(meeting) ? "text-ink-soft" : "text-ink",
        cancelled(meeting) && "text-ink-dim line-through",
      )}
    >
      <span className="flex min-w-0 items-center gap-[0.3rem]">
        {now(meeting) && <Lamp tone="doing" size="sm" />}
        <KindIcon meeting={meeting} />
        {!two && <span className="shrink-0 font-mono text-[0.85rem]">{start}</span>}
        <span className="truncate font-medium">{meeting.title ?? m.columns.title}</span>
        {!two && <Badges meeting={meeting} count={false} />}
      </span>
      {two && (
        <span className="flex min-w-0 items-center gap-[0.3rem] text-ink-soft">
          <span className="truncate whitespace-nowrap font-mono text-[0.85rem]">
            {start}
            {goesOn ? " →" : `–${timeText(meeting.endedAt, lang)}`}
          </span>
          <Badges meeting={meeting} count />
        </span>
      )}
    </span>
  )
}

/** A meeting as one line of a month cell or the day's list: kind, start in mono, title. */
export function MeetingLine({ meeting }: { meeting: MeetingRow }) {
  const lang = useLang()
  const m = useMessages(meetingMessages)
  return (
    <span
      className={cx(
        "flex min-w-0 items-center gap-[0.3rem] text-[0.85rem] leading-[1.45rem]",
        past(meeting) ? "text-ink-soft" : "text-ink",
        cancelled(meeting) && "text-ink-dim line-through",
      )}
    >
      <KindIcon meeting={meeting} />
      {!meeting.allDay && (
        <span className="shrink-0 font-mono text-[0.85rem]">{timeText(meeting.startedAt, lang)}</span>
      )}
      <span className="truncate">{meeting.title ?? m.columns.title}</span>
      {meeting.pendingFindings > 0 && <Lamp tone="warn" size="sm" />}
    </span>
  )
}

import { AlignLeft, Disc, FileText } from "lucide-react"
import type { ReactNode } from "react"
import { useLang, useMessages } from "@/i18n"
import type { MeetingRow } from "@/platform/bindings"
import { useMeetingOpen } from "@/shared/meeting-open"
import { SourceIcon } from "@/shared/SourceIcon"
import { type Column, DataTable } from "@/ui/DataTable"
import { Pill } from "@/ui/Pill"
import { KindIcon } from "./MeetingChip"
import { meetingMessages } from "./messages"

const open = (meeting: MeetingRow) => useMeetingOpen.setState({ ref: meeting.ref, title: meeting.title ?? "" })

/** `h:mm`, from the instants memo gave, never from a drawing. */
const clock = (meeting: MeetingRow) => {
  const ms =
    meeting.durationMs ??
    (meeting.startedAt && meeting.endedAt ? Date.parse(meeting.endedAt) - Date.parse(meeting.startedAt) : null)
  if (ms === null || meeting.allDay) return "—"
  const minutes = Math.round(ms / 60_000)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`
}

/** All meetings, newest first, a page at a time as memo cut them. */
export function MeetingsTable({
  rows,
  busy,
  loading,
}: {
  rows: readonly MeetingRow[] | null
  busy: boolean
  loading: string
}) {
  const m = useMessages(meetingMessages)
  const columns = useColumns()
  return (
    <DataTable
      label={m.rows}
      busy={busy}
      rows={rows ?? []}
      rowKey={(r) => r.ref}
      columns={columns}
      density="compact"
      minWidth="52rem"
      placeholders={rows ? 0 : 8}
      loading={loading}
      onRowClick={open}
    />
  )
}

function useColumns(): Column<MeetingRow>[] {
  const m = useMessages(meetingMessages)
  const lang = useLang()
  const c = m.columns
  const when = (r: MeetingRow) =>
    r.startedAt
      ? new Date(r.startedAt).toLocaleString(lang, {
          weekday: "short",
          day: "numeric",
          month: "short",
          ...(r.allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
        })
      : "—"
  const has = (r: MeetingRow): [string, ReactNode][] => [
    ...(r.hasTranscript
      ? [[m.transcript, <FileText key="t" className="size-4" aria-hidden />] as [string, ReactNode]]
      : []),
    ...(r.hasSummary ? [[m.summary, <AlignLeft key="s" className="size-4" aria-hidden />] as [string, ReactNode]] : []),
    ...(r.hasRecording ? [[m.recording, <Disc key="r" className="size-4" aria-hidden />] as [string, ReactNode]] : []),
  ]
  return [
    {
      id: "when",
      head: c.when,
      width: "12.5rem",
      className: "truncate font-mono text-[0.88rem] text-ink-soft tabular-nums",
      cell: when,
    },
    {
      id: "title",
      head: c.title,
      width: "minmax(12rem,1fr)",
      cell: (r) => (
        <button
          type="button"
          data-opens={r.ref}
          aria-haspopup="dialog"
          onClick={(e) => {
            e.stopPropagation()
            open(r)
          }}
          className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-rack text-left focus-visible:outline-2 focus-visible:outline-brand"
        >
          <KindIcon meeting={r} className="size-4 shrink-0 text-ink-dim" />
          <span className="truncate font-medium">{r.title ?? c.title}</span>
        </button>
      ),
    },
    {
      id: "from",
      head: c.from,
      width: "5.5rem",
      cell: (r) => (
        <span className="flex items-center gap-[0.35rem]">
          {[...new Set(r.sources.map((s) => s.provider))].map((p) => (
            <SourceIcon key={p} provider={p} labelled />
          ))}
        </span>
      ),
    },
    {
      id: "people",
      head: c.people,
      width: "minmax(8rem,12rem)",
      className: "truncate text-ink-soft",
      cell: (r) => {
        const names = r.participants.map((p) => p.person?.name ?? p.name ?? p.email).filter(Boolean)
        const rest = Math.max(r.participantsCount, names.length) - 2
        return names.length ? `${names.slice(0, 2).join(", ")}${rest > 0 ? ` ${m.plus(rest)}` : ""}` : "—"
      },
    },
    {
      id: "duration",
      head: c.duration,
      width: "5.5rem",
      className: "text-right font-mono text-[0.88rem] text-ink-soft tabular-nums",
      cell: clock,
    },
    {
      id: "has",
      head: c.has,
      width: "5.5rem",
      cell: (r) => (
        <span className="flex items-center gap-[0.35rem] text-ink-dim">
          {has(r).map(([name, icon]) => (
            <span key={name} role="img" aria-label={name}>
              {icon}
            </span>
          ))}
        </span>
      ),
    },
    {
      id: "findings",
      head: "",
      width: "8rem",
      cell: (r) => (r.pendingFindings > 0 ? <Pill tone="warn">{m.toConfirm(r.pendingFindings)}</Pill> : null),
    },
  ]
}

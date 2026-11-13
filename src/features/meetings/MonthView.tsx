import { useMemo, useRef, useState } from "react"
import { dayOf } from "@/domain/days"
import { layoutWeekRow, placeWindow, timeOf } from "@/domain/meeting-layout"
import { useLang, useMessages } from "@/i18n"
import type { MeetingRow } from "@/platform/bindings"
import { useMeetingOpen } from "@/shared/meeting-open"
import { Button } from "@/ui/Button"
import { MonthGrid } from "@/ui/MonthGrid"
import { DayList } from "./DayList"
import { meetingLabel } from "./label"
import { MeetingLine } from "./MeetingChip"
import { meetingMessages } from "./messages"

const open = (meeting: MeetingRow) => useMeetingOpen.setState({ ref: meeting.ref, title: meeting.title ?? "" })

export function MonthView({
  days,
  month,
  active,
  meetings,
  unread,
  onMove,
  onPage,
  onDay,
}: {
  days: readonly string[]
  month: string
  active: string
  meetings: readonly MeetingRow[]
  unread: (day: string) => boolean
  onMove: (day: string) => void
  onPage: (step: -1 | 1) => void
  onDay: (day: string) => void
}) {
  const m = useMessages(meetingMessages)
  const lang = useLang()
  const byRef = useMemo(() => new Map(meetings.map((x) => [x.ref, x])), [meetings])
  // Each day's meetings in start order: day-long ones by their lanes first, then the timed ones.
  const perDay = useMemo(() => {
    const { segments, rows } = placeWindow(
      meetings.flatMap((x) => timeOf(x) ?? []),
      days,
    )
    const out = new Map<string, string[]>()
    rows.forEach((row, w) => {
      for (const lane of layoutWeekRow(row).lanes.sort((a, b) => a.lane - b.lane))
        for (let d = lane.from; d <= lane.to; d++) {
          const day = days[w * 7 + d] as string
          out.set(day, [...(out.get(day) ?? []), lane.key])
        }
    })
    for (const [day, list] of segments)
      out.set(day, [
        ...(out.get(day) ?? []),
        ...[...list].sort((a, b) => a.startMin - b.startMin).flatMap((s) => (s.fromBefore ? [] : [s.key])),
      ])
    return out
  }, [meetings, days])

  const anchor = useRef<HTMLElement | null>(null)
  const [list, setList] = useState<string | null>(null)
  const today = dayOf(new Date())
  const date = (day: string, o: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00`).toLocaleDateString(lang, o)
  const weekdays = days.slice(0, 7).map((d) => date(d, { weekday: "short" }))

  return (
    <>
      <MonthGrid
        label={m.views.month}
        days={days}
        month={month}
        today={today}
        weekdays={weekdays}
        active={active}
        onMove={onMove}
        onPage={onPage}
        onDay={onDay}
        dayNumber={(d) => String(Number(d.slice(8)))}
        dayLabel={(d) => date(d, { weekday: "long", day: "numeric", month: "long" })}
        cellName={(d) =>
          m.dayCount(
            `${date(d, { weekday: "long", day: "numeric", month: "long" })}${d === today ? `, ${m.todayWord}` : ""}`,
            perDay.get(d)?.length ?? 0,
          )
        }
        renderCell={(day, lines) => {
          if (unread(day)) return <span className="px-[0.2rem] text-[0.8rem] text-ink-dim">{m.notRead}</span>
          const refs = perDay.get(day) ?? []
          const fits = refs.length > lines ? Math.max(0, lines - 1) : refs.length
          return (
            <>
              {refs.slice(0, fits).map((ref) => {
                const meeting = byRef.get(ref)
                return meeting ? (
                  <button
                    key={ref}
                    type="button"
                    tabIndex={-1}
                    aria-label={meetingLabel(meeting, m, lang)}
                    onClick={() => open(meeting)}
                    className="reveal min-w-0 cursor-pointer rounded-control px-[0.2rem] text-left hover:bg-app-2"
                  >
                    <MeetingLine meeting={meeting} />
                  </button>
                ) : null
              })}
              {refs.length > fits && (
                <Button
                  size="sm"
                  variant="ghost"
                  tabIndex={-1}
                  onClick={(e) => {
                    anchor.current = e.currentTarget
                    setList(day)
                  }}
                >
                  {m.more(refs.length - fits)}
                </Button>
              )}
            </>
          )
        }}
      />
      <DayList
        day={list}
        meetings={(list ? (perDay.get(list) ?? []) : []).flatMap((r) => byRef.get(r) ?? [])}
        anchor={anchor}
        onClose={(refocus) => {
          setList(null)
          if (refocus) anchor.current?.focus()
        }}
      />
    </>
  )
}

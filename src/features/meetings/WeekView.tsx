import { useCallback, useMemo, useRef, useState } from "react"
import { layoutDay, layoutWeekRow, placeWindow, timeOf } from "@/domain/meeting-layout"
import { useLang, useMessages } from "@/i18n"
import type { MeetingRow } from "@/platform/bindings"
import { showMeeting } from "@/shared/meeting-open"
import { MIN_MINUTES, TimeGrid } from "@/ui/TimeGrid"
import { DayList } from "./DayList"
import { meetingLabel } from "./label"
import { MeetingBlock, MeetingLine } from "./MeetingChip"
import { meetingMessages } from "./messages"

/** The all-day row is always two lanes high, so moving between weeks never moves the hours under it. */
const ALL_DAY_LANES = 2

const open = (meeting: MeetingRow) => showMeeting(meeting.ref, meeting.title)

export function WeekView({
  days,
  meetings,
  unread,
  jump,
  onDay,
}: {
  days: readonly string[]
  meetings: readonly MeetingRow[]
  unread: (day: string) => boolean
  jump: number
  onDay: (day: string) => void
}) {
  const m = useMessages(meetingMessages)
  const lang = useLang()
  const byRef = useMemo(() => new Map(meetings.map((x) => [x.ref, x])), [meetings])
  const { segments, rows } = useMemo(
    () =>
      placeWindow(
        meetings.flatMap((x) => timeOf(x) ?? []),
        days,
      ),
    [meetings, days],
  )
  const segment = useMemo(
    () => new Map([...segments].flatMap(([day, list]) => list.map((s) => [`${day}|${s.key}`, s] as const))),
    [segments],
  )
  const layout = useCallback(
    (columns: number) => new Map(days.map((d) => [d, layoutDay(segments.get(d) ?? [], columns, MIN_MINUTES)])),
    [days, segments],
  )
  const lanes = useMemo(() => layoutWeekRow(rows[0] ?? [], ALL_DAY_LANES), [rows])

  const anchor = useRef<HTMLElement | null>(null)
  const [list, setList] = useState<{ day: string; refs: string[] } | null>(null)
  const showList = (el: HTMLElement, day: string, refs: string[]) => {
    anchor.current = el
    setList({ day, refs })
  }
  const coveringDay = (i: number) => (rows[0] ?? []).filter((s) => s.from <= i && i <= s.to).map((s) => s.key)

  const head = (day: string) => {
    const d = new Date(`${day}T12:00:00`)
    return {
      short: d.toLocaleDateString(lang, { weekday: "short", day: "numeric" }),
      name: d.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }),
    }
  }

  const allDay = (
    <>
      {lanes.lanes.map((lane) => {
        const meeting = byRef.get(lane.key)
        if (!meeting) return null
        return (
          <button
            key={lane.key}
            type="button"
            aria-label={meetingLabel(meeting, m, lang)}
            onClick={() => open(meeting)}
            className="z-[1] mx-[2px] min-w-0 cursor-pointer rounded-control border border-line-strong bg-app-2 px-[0.35rem] text-left hover:border-ink-dim"
            style={{ gridColumn: `${lane.from + 1} / ${lane.to + 2}`, gridRow: lane.lane + 1 }}
          >
            <MeetingLine meeting={meeting} />
          </button>
        )
      })}
      {lanes.hidden.map((n, i) =>
        n > 0 ? (
          <button
            key={days[i]}
            type="button"
            aria-label={`${m.more(n)}, ${head(days[i] as string).name}`}
            onClick={(e) => showList(e.currentTarget, days[i] as string, coveringDay(i))}
            className="z-[1] justify-self-end self-end cursor-pointer rounded-control px-[0.3rem] font-mono text-[0.85rem] text-ink-soft hover:bg-app-3"
            style={{ gridColumn: i + 1, gridRow: 2 }}
          >
            {m.plus(n)}
          </button>
        ) : null,
      )}
    </>
  )

  return (
    <>
      <TimeGrid
        label={m.views.week}
        days={days}
        head={head}
        onDay={onDay}
        allDay={allDay}
        allDayLabel={m.allDay}
        layout={layout}
        itemLabel={(key, day) => {
          const meeting = byRef.get(key)
          if (!meeting) return key
          const s = segment.get(`${day}|${key}`)
          return [meetingLabel(meeting, m, lang), s?.fromBefore && m.fromBefore, s?.goesOn && m.continues]
            .filter(Boolean)
            .join(", ")
        }}
        columnName={(day, n) => m.dayCount(head(day).name, n)}
        onOpen={(key) => {
          const meeting = byRef.get(key)
          if (meeting) open(meeting)
        }}
        renderItem={(key, day, place) => {
          const meeting = byRef.get(key)
          const s = segment.get(`${day}|${key}`)
          return meeting ? (
            <MeetingBlock
              meeting={meeting}
              minutes={place.endMin - place.startMin}
              fromBefore={s?.fromBefore ?? false}
              goesOn={s?.goesOn ?? false}
            />
          ) : null
        }}
        renderMore={(day, more) => (
          <button
            type="button"
            aria-label={`${m.more(more.keys.length)}, ${head(day).name}`}
            onClick={(e) => showList(e.currentTarget, day, more.keys)}
            className="h-full w-full cursor-pointer rounded-control border border-line border-dashed bg-app font-mono text-[0.85rem] text-ink-soft hover:bg-app-2"
          >
            {m.plus(more.keys.length)}
          </button>
        )}
        unread={unread}
        unreadLabel={m.notRead}
        jump={jump}
      />
      <DayList
        day={list?.day ?? null}
        meetings={(list?.refs ?? []).flatMap((r) => byRef.get(r) ?? [])}
        anchor={anchor}
        onClose={(refocus) => {
          setList(null)
          if (refocus) anchor.current?.focus()
        }}
      />
    </>
  )
}

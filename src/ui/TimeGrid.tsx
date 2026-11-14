// biome-ignore-all lint/a11y/useSemanticElements: a day column is a group of buttons, not a form's fieldset
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useLang } from "@/i18n"
import { dayOf } from "./Calendar"
import { cx } from "./cx"
import { focusInPlace } from "./motion"
import { TipPanel, useTip } from "./Tooltip"

const HOUR_REM = 4
/** The drawn minimum: one line of text, 1.5rem at 4rem an hour. */
export const MIN_MINUTES = (1.5 / HOUR_REM) * 60
/** The narrowest block that still shows its icon and about five letters of its title. */
const BLOCK_REM = 4.6
/** What a block keeps at its left edge where a later one is drawn over it: its bar and its icon. */
const INDENT_REM = 1.15

const DAY_MINUTES = 1_440

/** How wide a readable block is and what a covered one keeps, as fractions of a day column's width. */
export type Room = { block: number; indent: number }

/** Where the caller's layout put a block or a "+N" marker: minutes from midnight, and fractions of the day's width. */
export type Placed =
  | { type: "event"; key: string; startMin: number; endMin: number; left: number; width: number }
  | { type: "more"; startMin: number; endMin: number; keys: string[]; left: number; width: number }

const rem = (minutes: number) => `${(minutes / 60) * HOUR_REM}rem`
const minutesNow = (d: Date) => d.getHours() * 60 + d.getMinutes()

type Props = {
  label: string
  days: readonly string[]
  /** A day's header (weekday and number) and its full name, which names its column for screen readers. */
  head: (day: string) => { short: ReactNode; name: string }
  /** A day's header opens it elsewhere (the month); none, and the header is plain text. */
  onDay?: (day: string) => void
  /** The bars above the hours, placed by the caller in a 7-column, 2-row grid. */
  allDay?: ReactNode
  allDayLabel: string
  /** Each day's blocks, placed for the room a day column gives: the grid measures it. */
  layout: (room: Room) => ReadonlyMap<string, readonly Placed[]>
  /** What a block shows, its full name for screen readers, and what a click does. */
  renderItem: (key: string, day: string, place: Extract<Placed, { type: "event" }>) => ReactNode
  itemLabel: (key: string, day: string) => string
  /** What hover and keyboard focus show over a block, for what a short block has no room to print. */
  itemTip?: (key: string, day: string) => ReactNode
  /** A day column's name for screen readers, from its date and how many meetings it holds. */
  columnName: (day: string, count: number) => string
  onOpen: (key: string) => void
  renderMore: (day: string, more: Extract<Placed, { type: "more" }>) => ReactNode
  /** Days the read did not reach; they say so instead of showing nothing. */
  unread?: (day: string) => boolean
  unreadLabel?: string
  /** Changes when the caller wants the grid scrolled to now again (Today). */
  jump?: number
}

/**
 * A week as columns of 24 hours with meetings placed in them (`layoutDay`): an hour gutter, a header per day, an
 * all-day row, a now-line. One tab stop: the arrows move between blocks, Up and Down in a day, Left and Right to the
 * block nearest in time on the next day that has one, Home and End to the week's ends. The hours scroll inside.
 */
export function TimeGrid(props: Props) {
  const { label, days, head, onDay, allDay, allDayLabel, layout, itemLabel, onOpen, unread, unreadLabel, jump } = props
  const lang = useLang()
  const scroller = useRef<HTMLDivElement>(null)
  const room = useRoom(scroller)
  const now = useNow()
  const today = dayOf(now)
  const [active, setActive] = useState<string | null>(null)

  const placed = useMemo(() => layout(room), [layout, room])
  // The roving order: by day, then by time; one meeting across midnight is one stop, on its first day here.
  const stops = useMemo(() => {
    const seen = new Set<string>()
    return days.flatMap((day, d) =>
      (placed.get(day) ?? [])
        .filter((p): p is Extract<Placed, { type: "event" }> => p.type === "event")
        .sort((a, b) => a.startMin - b.startMin || a.left - b.left)
        .filter((p) => !seen.has(p.key) && Boolean(seen.add(p.key)))
        .map((p) => ({ key: p.key, d, startMin: p.startMin })),
    )
  }, [days, placed])
  const current = stops.find((s) => s.key === active)?.key ?? stops[0]?.key ?? null

  const toNow = () => {
    const box = scroller.current
    if (!box) return
    const hour = box.scrollHeight / 24
    box.scrollTop = days.includes(today) ? Math.max(0, (minutesNow(new Date()) / 60 - 1) * hour) : 8 * hour
  }
  // Once on the first week shown, and again on Today; moving between weeks keeps the scroll where the owner left it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the first paint and a new jump scroll
  useLayoutEffect(toNow, [jump])

  const focus = (key: string | undefined) => {
    if (!key) return
    setActive(key)
    focusInPlace(scroller.current?.querySelector<HTMLElement>(`[data-stop="${CSS.escape(key)}"]`) ?? null, "center")
  }
  const onKey = (e: KeyboardEvent, key: string) => {
    const at = stops.findIndex((s) => s.key === key)
    const here = stops[at]
    if (!here) return
    const nearestOn = (step: number) => {
      for (let d = here.d + step; d >= 0 && d < days.length; d += step) {
        const there = stops.filter((s) => s.d === d)
        if (there.length)
          return there.reduce((a, b) =>
            Math.abs(b.startMin - here.startMin) < Math.abs(a.startMin - here.startMin) ? b : a,
          )
      }
      return undefined
    }
    const sameDay = (step: number) => {
      const next = stops[at + step]
      return next?.d === here.d ? next : undefined
    }
    let to: (typeof stops)[number] | undefined
    switch (e.key) {
      case "ArrowDown":
        to = sameDay(1)
        break
      case "ArrowUp":
        to = sameDay(-1)
        break
      case "ArrowRight":
        to = nearestOn(1)
        break
      case "ArrowLeft":
        to = nearestOn(-1)
        break
      case "Home":
        to = stops[0]
        break
      case "End":
        to = stops.at(-1)
        break
      default:
        return
    }
    e.preventDefault()
    focus(to?.key)
  }

  const hourLabel = (h: number) =>
    new Intl.DateTimeFormat(lang, lang === "en" ? { hour: "numeric" } : { hour: "2-digit", minute: "2-digit" }).format(
      new Date(2000, 0, 1, h),
    )
  const columnsClass = "grid grid-cols-[3.6rem_repeat(7,minmax(0,1fr))]"

  return (
    <section
      aria-label={label}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-rack border border-line-strong bg-app"
    >
      <div className={cx(columnsClass, "border-line border-b")}>
        <span />
        {days.map((day) => {
          const { short } = head(day)
          const isToday = day === today
          const face = (
            <span className={cx("inline-flex items-center gap-[0.35rem]", isToday && "font-semibold text-ink")}>
              {isToday && <span className="size-[0.4rem] rounded-full bg-brand" aria-hidden />}
              {short}
            </span>
          )
          return (
            <div key={day} className="border-line border-l px-[0.5rem] py-[0.45rem] text-[0.9rem] text-ink-soft">
              {onDay ? (
                <button
                  type="button"
                  onClick={() => onDay(day)}
                  className="cursor-pointer rounded-control hover:text-ink"
                >
                  {face}
                </button>
              ) : (
                face
              )}
            </div>
          )
        })}
      </div>
      <div className={cx(columnsClass, "border-line border-b")}>
        <span className="self-center px-[0.4rem] text-right font-mono text-[0.85rem] text-ink-dim">{allDayLabel}</span>
        <div className="relative col-span-7 grid min-h-[3.4rem] grid-cols-7 grid-rows-[repeat(2,1.5rem)] gap-y-[0.15rem] py-[0.15rem]">
          {days.map((day, i) => (
            <span
              key={day}
              aria-hidden
              className="row-span-2 border-line border-l"
              style={{ gridColumn: i + 1, gridRow: "1 / span 2" }}
            />
          ))}
          {allDay}
        </div>
      </div>
      <div ref={scroller} className="ring-inside relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className={cx(columnsClass, "relative")} style={{ height: rem(DAY_MINUTES) }}>
          <div aria-hidden className="relative">
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span
                key={h}
                className="-translate-y-1/2 absolute right-[0.45rem] font-mono text-[0.85rem] text-ink-dim tabular-nums"
                style={{ top: rem(h * 60) }}
              >
                {hourLabel(h)}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const items = placed.get(day) ?? []
            const count = new Set(items.flatMap((p) => (p.type === "event" ? [p.key] : p.keys))).size
            return (
              <div
                key={day}
                role="group"
                aria-label={props.columnName(day, count)}
                className="relative border-line border-l"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent 0, transparent calc(4rem - 1px), var(--line) calc(4rem - 1px), var(--line) 4rem)",
                }}
              >
                {unread?.(day) ? (
                  <p className="sticky top-[0.5rem] px-[0.5rem] text-[0.85rem] text-ink-dim">{unreadLabel}</p>
                ) : (
                  items.map((p) =>
                    p.type === "event" ? (
                      <Block
                        key={p.key}
                        place={p}
                        label={itemLabel(p.key, day)}
                        tip={props.itemTip?.(p.key, day)}
                        current={p.key === current}
                        onFocus={() => setActive(p.key)}
                        onKeyDown={(e) => onKey(e, p.key)}
                        onOpen={() => onOpen(p.key)}
                      >
                        {props.renderItem(p.key, day, p)}
                      </Block>
                    ) : (
                      <div
                        key={`more-${p.startMin}`}
                        className="absolute px-[1px]"
                        style={{
                          top: rem(p.startMin),
                          height: rem(p.endMin - p.startMin),
                          left: `${p.left * 100}%`,
                          width: `${p.width * 100}%`,
                        }}
                      >
                        {props.renderMore(day, p)}
                      </div>
                    ),
                  )
                )}
                {day === today && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-10 h-[2px] bg-brand"
                    style={{ top: rem(minutesNow(now)) }}
                  >
                    <span className="-left-[0.25rem] -top-[0.2rem] absolute size-[0.5rem] rounded-full bg-brand" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Long enough that a pointer crossing the week on its way elsewhere opens nothing. */
const TIP_DELAY = 450

function Block(props: {
  place: Extract<Placed, { type: "event" }>
  label: string
  tip: ReactNode
  current: boolean
  onFocus: () => void
  onKeyDown: (e: KeyboardEvent) => void
  onOpen: () => void
  children: ReactNode
}) {
  const { place: p, tip: content } = props
  const anchor = useRef<HTMLButtonElement>(null)
  const tipId = useId()
  // Keyboard only: a click opens the dialog, and the focus it hands back on close must not pop a tip over the week.
  const tip = useTip({ delay: TIP_DELAY, keyboardOnly: true, disabled: !content })
  return (
    <button
      ref={anchor}
      type="button"
      data-stop={p.key}
      aria-label={props.label}
      tabIndex={props.current ? 0 : -1}
      {...tip.hover}
      onFocus={(e) => {
        props.onFocus()
        tip.focus.onFocus(e)
      }}
      onBlur={tip.focus.onBlur}
      onPointerDown={tip.hide}
      onKeyDown={props.onKeyDown}
      onClick={props.onOpen}
      className="reveal absolute cursor-pointer px-[1px] text-left focus-visible:z-[5]"
      style={{
        top: rem(p.startMin),
        height: rem(p.endMin - p.startMin),
        left: `${p.left * 100}%`,
        width: `${p.width * 100}%`,
      }}
    >
      {props.children}
      {/* Mounted only while open: a busy week holds hundreds of blocks. */}
      {tip.open && (
        <TipPanel id={tipId} anchor={anchor} open className="w-auto max-w-[20rem] px-2 py-1">
          {content}
        </TipPanel>
      )}
    </button>
  )
}

/** A day column's room for blocks, from one observer on the grid; it changes only when the fractions do. */
function useRoom(scroller: RefObject<HTMLDivElement | null>) {
  const [room, setRoom] = useState<Room>({ block: 0.5, indent: 0.25 })
  useEffect(() => {
    const box = scroller.current
    if (!box || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const day = (box.clientWidth - 3.6 * remPx) / 7 / remPx
      if (day <= 0) return
      const next = { block: Math.min(1, BLOCK_REM / day), indent: Math.min(0.5, INDENT_REM / day) }
      // Rounded, so a window dragged a pixel wider does not lay the week out again.
      const round = (n: number) => Math.round(n * 100) / 100
      setRoom((r) =>
        round(r.block) === round(next.block) && round(r.indent) === round(next.indent)
          ? r
          : { block: round(next.block), indent: round(next.indent) },
      )
    }
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    measure()
    return () => observer.disconnect()
  }, [scroller])
  return room
}

/** The clock, once a minute: one timer for the now-line, nothing else re-renders on time. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

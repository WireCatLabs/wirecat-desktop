import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { type Lang, useLang, useMessages } from "@/i18n"
import { Button } from "./Button"
import { cx } from "./cx"
import { ExpandChevron } from "./ExpandChevron"
import { uiMessages } from "./messages"
import { useCloseOutside, useListPlacement } from "./popup-list"

/** A local calendar day, `YYYY-MM-DD`; never through UTC, which moves an evening to the next day. */
export const dayOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const parse = (day: string) => {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}
const shift = (day: string, days: number) => {
  const d = parse(day)
  d.setDate(d.getDate() + days)
  return dayOf(d)
}
/** The same day of another month, or that month's last day when it is shorter (31 Jan → 28 Feb). */
const shiftMonth = (day: string, months: number) => {
  const d = parse(day)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), last))
  return dayOf(target)
}

/** English calendars start on Sunday; Russian and Spanish ones on Monday. */
const weekStart = (lang: Lang) => (lang === "en" ? 0 : 1)
const capital = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

export type DaySpan = { from: string; to?: string }

type Props = {
  /** The chosen day, or the two ends of a chosen span. */
  selected: DaySpan | null
  onPick: (day: string) => void
  /** Where the keyboard starts when nothing is chosen; today by default. */
  today?: string
  /** Takes focus on the chosen day (or today) as soon as it shows, so "Another day" can be picked at once. */
  autoFocus?: boolean
  label: string
}

/**
 * A month as a table of day buttons, keyed as the WAI-ARIA APG date picker is. One day is in the tab order; arrows move a day or a week, Page Up and Page
 * Down a month (with Shift a year), Home and End to the week's ends, Enter or Space picks.
 */
export function Calendar({ selected, onPick, today = dayOf(new Date()), autoFocus = false, label }: Props) {
  const m = useMessages(uiMessages)
  const lang = useLang()
  const [focus, setFocus] = useState(selected?.from ?? today)
  const [direction, setDirection] = useState<0 | 1 | -1>(0)
  const grid = useRef<HTMLTableElement>(null)
  const moved = useRef(false)
  const hintId = useId()

  const start = weekStart(lang)
  const view = parse(focus)
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const lead = (first.getDay() - start + 7) % 7
  const origin = dayOf(new Date(first.getFullYear(), first.getMonth(), 1 - lead))
  // Always six weeks, so the popover keeps its height from month to month.
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => shift(origin, w * 7 + d)))
  const month = `${capital(new Intl.DateTimeFormat(lang, { month: "long" }).format(view))} ${view.getFullYear()}`
  const weekdays = weeks[0]?.map((d) => ({
    short: new Intl.DateTimeFormat(lang, { weekday: "short" }).format(parse(d)),
    long: new Intl.DateTimeFormat(lang, { weekday: "long" }).format(parse(d)),
  }))
  const full = new Intl.DateTimeFormat(lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  const [lo, hi] = selected
    ? selected.to && selected.to < selected.from
      ? [selected.to, selected.from]
      : [selected.from, selected.to ?? selected.from]
    : ["", ""]

  // A day chosen from outside (Today under the calendar) brings its month into view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new chosen day moves the view
  useEffect(() => {
    if (selected?.from) go(selected.from)
  }, [selected?.from])

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on mount
  useEffect(() => {
    if (!autoFocus) return
    // A frame later: the popover is placed (and visible) only after its own layout pass.
    const frame = requestAnimationFrame(() =>
      grid.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(frame)
  }, [])

  // Focus follows the active day only after a key moved it, never after a click on the month arrows.
  useLayoutEffect(() => {
    if (!moved.current) return
    moved.current = false
    grid.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus({ preventScroll: true })
  }, [focus])

  const go = (day: string) => {
    const a = parse(focus)
    const b = parse(day)
    const monthDiff = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()
    if (monthDiff !== 0) setDirection(monthDiff > 0 ? 1 : -1)
    setFocus(day)
  }
  const move = (day: string) => {
    moved.current = true
    go(day)
  }

  const target = (key: string, shiftKey: boolean): string | null => {
    const weekday = (parse(focus).getDay() - start + 7) % 7
    switch (key) {
      case "ArrowLeft":
        return shift(focus, -1)
      case "ArrowRight":
        return shift(focus, 1)
      case "ArrowUp":
        return shift(focus, -7)
      case "ArrowDown":
        return shift(focus, 7)
      case "PageUp":
        return shiftMonth(focus, shiftKey ? -12 : -1)
      case "PageDown":
        return shiftMonth(focus, shiftKey ? 12 : 1)
      case "Home":
        return shift(focus, -weekday)
      case "End":
        return shift(focus, 6 - weekday)
      default:
        return null
    }
  }
  const onKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const next = target(e.key, e.shiftKey)
    if (!next) return
    e.preventDefault()
    move(next)
  }

  return (
    <div className="flex w-[17.5rem] flex-col gap-[0.4rem]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={m.previousMonth}
          title={m.previousMonth}
          onClick={() => go(shiftMonth(focus, -1))}
          className="grid size-8 cursor-pointer place-items-center rounded-[0.35rem] text-ink-soft hover:bg-app-3 hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <h2 aria-live="polite" className="text-[0.95rem] font-semibold text-ink">
          {month}
        </h2>
        <button
          type="button"
          aria-label={m.nextMonth}
          title={m.nextMonth}
          onClick={() => go(shiftMonth(focus, 1))}
          className="grid size-8 cursor-pointer place-items-center rounded-[0.35rem] text-ink-soft hover:bg-app-3 hover:text-ink"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <table
        ref={grid}
        aria-label={label}
        aria-describedby={hintId}
        onKeyDown={onKey}
        className="w-full table-fixed border-collapse"
      >
        <thead>
          <tr>
            {weekdays?.map((w) => (
              <th key={w.long} scope="col" abbr={w.long} className="h-7 text-[0.8rem] font-medium text-ink-dim">
                {w.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          key={focus.slice(0, 7)}
          className={cx(
            direction === 1 && "motion-safe:animate-[month-next_200ms_var(--ease-out-quart)]",
            direction === -1 && "motion-safe:animate-[month-prev_200ms_var(--ease-out-quart)]",
          )}
        >
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const inMonth = parse(day).getMonth() === view.getMonth()
                const end = day === lo || day === hi
                const between = selected !== null && day > lo && day < hi
                return (
                  <td key={day} className="p-0">
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === focus ? 0 : -1}
                      aria-pressed={end || between}
                      aria-label={full.format(parse(day))}
                      aria-current={day === today ? "date" : undefined}
                      onClick={() => {
                        setFocus(day)
                        onPick(day)
                      }}
                      className={cx(
                        "relative grid h-[2.2rem] w-full cursor-pointer place-items-center font-mono text-[0.9rem] tabular-nums transition-colors duration-150",
                        end
                          ? "rounded-[0.35rem] bg-brand font-semibold text-brand-ink hover:bg-brand-hover"
                          : between
                            ? "bg-brand-soft text-ink hover:bg-brand/20"
                            : cx("rounded-[0.35rem] hover:bg-app-3", inMonth ? "text-ink" : "text-ink-dim/70"),
                      )}
                    >
                      {parse(day).getDate()}
                      {day === today && !end && (
                        <span aria-hidden className="absolute bottom-[0.3rem] size-[0.22rem] rounded-full bg-brand" />
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p id={hintId} className="sr-only">
        {m.calendarKeys}
      </p>
    </div>
  )
}

type PopoverProps = {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  /** `refocus` is false when the owner clicked elsewhere: focus goes where they clicked. */
  onClose: (refocus: boolean) => void
  label: string
  children: ReactNode
}

/**
 * A calendar floating under its anchor, rendered where it is declared (not in a portal) so it works inside a modal
 * dialog's top layer. Escape closes it and nothing else.
 */
export function DatePopover({ open, anchor, onClose, label, children }: PopoverProps) {
  const box = useRef<HTMLDivElement>(null)
  const place = useListPlacement(open, anchor, box, 440)
  const inside = useMemo(() => [box, anchor], [anchor])
  const outside = useCallback(() => onClose(false), [onClose])
  useCloseOutside(open, inside, outside)
  if (!open) return null
  return (
    <div
      ref={box}
      role="dialog"
      aria-label={label}
      style={place}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          // The task dialog around it would close on this Escape too.
          e.preventDefault()
          e.stopPropagation()
          onClose(true)
        }
      }}
      className="fixed z-50 flex flex-col gap-[0.5rem] rounded-[0.45rem] border border-line bg-app p-[0.6rem] text-ink shadow-panel motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]"
    >
      {children}
    </div>
  )
}

/** The row under a calendar: Today on the left, the caller's own actions on the right. */
export function CalendarFooter({ onToday, children }: { onToday: () => void; children?: ReactNode }) {
  const m = useMessages(uiMessages)
  return (
    <div className="flex items-center justify-between gap-2 border-line border-t pt-[0.5rem]">
      <Button size="sm" variant="ghost" onClick={onToday}>
        {m.today}
      </Button>
      <span className="flex gap-1">{children}</span>
    </div>
  )
}

type FieldProps = {
  /** `YYYY-MM-DD`, or "" for no date. */
  value: string
  onChange: (day: string) => void
  /** How the chosen day reads on the button. */
  format: (day: string) => string
  "aria-label": string
  className?: string
}

/** A date field: a button showing the day that opens a calendar, with Today and No date under it. */
export function DateField({ value, onChange, format, className, ...aria }: FieldProps) {
  const m = useMessages(uiMessages)
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }
  const pick = (day: string) => {
    onChange(day)
    close(true)
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={aria["aria-label"]}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && e.key === "ArrowDown") {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cx(
          "flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-[0.35rem] border border-line-strong bg-app pr-1.5 pl-2 text-left text-[0.875rem] hover:border-ink-dim/60",
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-ink-dim" aria-hidden />
        <span className={cx("min-w-0 flex-1 truncate", value ? "font-mono text-ink" : "text-ink-dim")}>
          {value ? format(value) : m.noDate}
        </span>
        <ExpandChevron open={open} />
      </button>
      <DatePopover open={open} anchor={button} onClose={close} label={aria["aria-label"]}>
        <Calendar selected={value ? { from: value } : null} onPick={pick} autoFocus label={aria["aria-label"]} />
        <CalendarFooter onToday={() => pick(dayOf(new Date()))}>
          {value && (
            <Button size="sm" variant="ghost" onClick={() => pick("")}>
              {m.noDate}
            </Button>
          )}
        </CalendarFooter>
      </DatePopover>
    </>
  )
}

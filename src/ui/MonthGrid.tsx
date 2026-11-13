// biome-ignore-all lint/a11y/useSemanticElements: an APG grid of focusable cells, which a <table> cannot be
// biome-ignore-all lint/a11y/useFocusableInteractive: only the grid's one active cell is in the tab order
import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from "react"
import { shift } from "./Calendar"
import { cx } from "./cx"
import { focusInPlace } from "./motion"

/** One line of a cell, in rem: a meeting's line or the "+N more" button. */
const LINE_REM = 1.45
/** The day number's own line. */
const HEAD_REM = 1.7

type Props = {
  label: string
  /** Forty-two `YYYY-MM-DD` days, six whole weeks. */
  days: readonly string[]
  /** `YYYY-MM`: the other months' days are dimmed. */
  month: string
  today: string
  weekdays: readonly string[]
  /** The cell with the tab stop; the arrows ask for another through `onMove`. */
  active: string
  onMove: (day: string) => void
  /** Page Up and Page Down: the month before or after. */
  onPage: (step: -1 | 1) => void
  dayNumber: (day: string) => string
  /** A cell's name for screen readers: its date and how many meetings it holds. */
  cellName: (day: string) => string
  /** The day number opens that day's week. */
  onDay: (day: string) => void
  dayLabel: (day: string) => string
  /** What a cell holds under its number, given how many lines fit. */
  renderCell: (day: string, lines: number) => ReactNode
}

/**
 * Six weeks of days as the WAI-ARIA APG grid: one tab stop on the active cell, arrows by day and week, Home and End to
 * the week's ends, Ctrl+Home and Ctrl+End to the month's first and last day, Page Up and Page Down by a month. Enter goes into
 * the cell, to its day number and meetings; Escape comes back to the cell.
 */
export function MonthGrid(props: Props) {
  const { label, days, month, today, weekdays, active, onMove, onPage, dayNumber, cellName, onDay, dayLabel } = props
  const grid = useRef<HTMLDivElement>(null)
  const lines = useLines(grid)
  const moved = useRef(false)

  // An arrow that lands on a day of another window waits for that window to draw, then focuses it.
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    focusInPlace(grid.current?.querySelector<HTMLElement>(`[data-day="${active}"]`) ?? null)
  }, [active])

  const move = (day: string) => {
    if (day === active) return
    moved.current = true
    onMove(day)
  }
  const onKey = (e: KeyboardEvent<HTMLElement>, day: string, index: number) => {
    if (e.target !== e.currentTarget) {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.focus()
      }
      // Inside a cell, Tab goes round its own buttons; the grid keeps its one tab stop.
      if (e.key === "Tab") {
        const inside = [...e.currentTarget.querySelectorAll<HTMLElement>("button")]
        const at = inside.indexOf(e.target as HTMLElement)
        e.preventDefault()
        inside[(at + (e.shiftKey ? -1 : 1) + inside.length) % inside.length]?.focus()
      }
      return
    }
    const col = index % 7
    switch (e.key) {
      case "ArrowRight":
        move(shift(day, 1))
        break
      case "ArrowLeft":
        move(shift(day, -1))
        break
      case "ArrowDown":
        move(shift(day, 7))
        break
      case "ArrowUp":
        move(shift(day, -7))
        break
      case "Home":
        move(e.ctrlKey ? `${month}-01` : shift(day, -col))
        break
      case "End":
        move(e.ctrlKey ? (days.filter((d) => d.startsWith(month)).at(-1) ?? day) : shift(day, 6 - col))
        break
      case "PageUp":
        moved.current = true
        onPage(-1)
        break
      case "PageDown":
        moved.current = true
        onPage(1)
        break
      case "Enter":
        e.currentTarget.querySelector<HTMLElement>("button")?.focus()
        break
      default:
        return
    }
    e.preventDefault()
  }

  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7))
  return (
    <div
      ref={grid}
      role="grid"
      aria-label={label}
      className="ring-inside flex min-h-0 flex-1 flex-col overflow-hidden rounded-rack border border-line-strong bg-app"
    >
      <div role="row" className="grid grid-cols-7 border-line border-b">
        {weekdays.map((w, i) => (
          <span
            key={w}
            role="columnheader"
            className={cx("px-[0.5rem] py-[0.45rem] text-[0.85rem] text-ink-soft", i > 0 && "border-line border-l")}
          >
            {w}
          </span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr">
        {weeks.map((week, w) => (
          <div
            key={week[0]}
            role="row"
            className={cx("grid min-h-[6rem] grid-cols-7", w > 0 && "border-line border-t")}
          >
            {week.map((day, i) => {
              const index = w * 7 + i
              const other = !day.startsWith(month)
              return (
                <div
                  key={day}
                  role="gridcell"
                  data-day={day}
                  aria-label={cellName(day)}
                  tabIndex={day === active ? 0 : -1}
                  onKeyDown={(e) => onKey(e, day, index)}
                  className={cx(
                    "flex min-w-0 flex-col gap-[0.1rem] overflow-hidden px-[0.3rem] pt-[0.25rem] pb-[0.2rem]",
                    i > 0 && "border-line border-l",
                    other && "bg-app-2/50",
                  )}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={dayLabel(day)}
                    onClick={() => onDay(day)}
                    className={cx(
                      "grid h-[1.45rem] min-w-[1.45rem] cursor-pointer place-items-center self-start rounded-full px-[0.3rem] font-mono text-[0.85rem] tabular-nums hover:bg-app-3",
                      day === today
                        ? "bg-brand font-semibold text-brand-ink hover:bg-brand-hover"
                        : other
                          ? "text-ink-dim"
                          : "text-ink-soft",
                    )}
                  >
                    {dayNumber(day)}
                  </button>
                  {props.renderCell(day, lines)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** How many lines a cell holds, from one observer on the grid; never fewer than one. */
function useLines(grid: RefObject<HTMLDivElement | null>) {
  const [lines, setLines] = useState(3)
  useEffect(() => {
    const box = grid.current
    if (!box || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const cell = box.querySelector<HTMLElement>('[role="gridcell"]')
      if (!cell) return
      const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      setLines(Math.max(1, Math.floor((cell.clientHeight / remPx - HEAD_REM) / LINE_REM)))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    measure()
    return () => observer.disconnect()
  }, [grid])
  return lines
}

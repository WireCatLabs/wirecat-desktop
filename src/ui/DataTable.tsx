// biome-ignore-all lint/a11y/useSemanticElements lint/a11y/useFocusableInteractive: ARIA table on a grid (sticky lead)
import { ChevronDown } from "lucide-react"
import { type CSSProperties, type MouseEvent, type ReactNode, useState } from "react"
import { useMessages } from "@/i18n"
import { cx } from "./cx"
import { uiMessages } from "./messages"
import { Skeleton } from "./Skeleton"

export type Column<T> = {
  id: string
  head: string
  /** Named for screen readers only. */
  hideHead?: boolean
  /** A CSS grid track: `7.6rem`, `minmax(0,1fr)`, `var(--priority)`. */
  width: string
  /** Stays in view while the table scrolls sideways; lead columns come first. */
  lead?: boolean
  sortBy?: (row: T) => number | string
  cell: (row: T) => ReactNode
  className?: string
}

type Sort = { id: string; dir: 1 | -1 }

/**
 * `roomy` holds rows that are edited in place (Tasks); `compact` a dense list of read-only rows that open (Search).
 */
type Density = "roomy" | "compact"

const LOOK: Record<Density, { table: string; head: string; grid: string; row: string; cell: string }> = {
  roomy: {
    table: "",
    head: "min-h-[2.6rem] border-line border-b",
    grid: "gap-x-[0.9rem] pr-[1.3rem] xl:gap-x-[1.2rem]",
    row: "min-h-[3.6rem]",
    // On the cells, not the row: the sticky lead group's background has to cover the whole row height.
    cell: "py-[0.7rem]",
  },
  compact: {
    table: "text-[0.95rem]",
    head: "py-[0.55rem] border-line-strong border-b",
    grid: "gap-x-[0.9rem] pr-[0.9rem]",
    // A <table> row of 2.6rem stood half a collapsed border taller; the same pitch keeps a long list as long.
    row: "h-[calc(2.6rem+0.5px)] border-line border-b",
    cell: "",
  },
}

const LEAD =
  "sticky left-0 z-[1] grid items-center gap-x-[inherit] self-stretch bg-app pl-[1.3rem] group-data-[scrolled]/rack:shadow-[1px_0_0_var(--color-line)]"

/** The order is fixed when the owner sorts, not when a value changes: an edited row stays where it is (rule 9). */
function sortKeys<T>(rows: readonly T[], key: (row: T) => string, by: (row: T) => number | string, dir: 1 | -1) {
  return [...rows]
    .sort((a, b) => {
      const x = by(a)
      const y = by(b)
      return x < y ? -dir : x > y ? dir : 0
    })
    .map(key)
}

type Props<T> = {
  label?: string
  rows: readonly T[]
  rowKey: (row: T) => string
  columns: readonly Column<T>[]
  density?: Density
  /** The lead columns' share of the row, as one grid track. */
  leadWidth?: string
  /** Below this width the table scrolls sideways inside its frame. */
  minWidth: string
  /** CSS variables the column widths name. */
  style?: CSSProperties
  /** Content between the header and the first row, as wide as the table. */
  top?: ReactNode
  /** What belongs to a row and shows under it: a notice, an opened row's details. */
  below?: (row: T) => ReactNode
  onRowClick?: (row: T, e: MouseEvent<HTMLDivElement>) => void
  selected?: (row: T) => boolean
  /** Rows held at the real row height while the first answer is on its way; the first one announces `loading`. */
  placeholders?: number
  loading?: string
  /** A new answer is on its way: the rows on screen stay and dim. */
  busy?: boolean
  /** Shows one page of the sorted rows, from 1; the caller's `Pager` moves it. */
  page?: { index: number; size: number }
}

export function DataTable<T>(props: Props<T>) {
  const { rows, rowKey, columns, density = "roomy", placeholders = 0, busy = false } = props
  const m = useMessages(uiMessages)
  const [sort, setSort] = useState<Sort | null>(null)
  const [sorted, setSorted] = useState<string[]>([])
  const [scrolled, setScrolled] = useState(false)
  const look = LOOK[density]
  const lead = columns.filter((c) => c.lead)
  const rest = columns.filter((c) => !c.lead)
  const leadTrack = lead.map((c) => c.width).join(" ")
  const restTracks = rest.map((c) => c.width).join(" ")
  const tracks = { gridTemplateColumns: lead.length ? `${props.leadWidth ?? "auto"} ${restTracks}` : restTracks }
  // With lead columns the lead group is the first track and carries the left padding, so its background covers it.
  const grid = cx("grid items-center", look.grid, lead.length === 0 && "pl-[1.3rem]")

  const byKey = new Map(rows.map((r) => [rowKey(r), r]))
  const keys = rows.map(rowKey)
  const inSorted = new Set(sorted)
  const order = sort ? [...sorted.filter((k) => byKey.has(k)), ...keys.filter((k) => !inSorted.has(k))] : keys
  const paged = props.page
    ? order.slice((props.page.index - 1) * props.page.size, props.page.index * props.page.size)
    : order
  const shown = paged.map((k) => byKey.get(k)).filter((r): r is T => r !== undefined)

  const head = (c: Column<T>) => {
    if (c.hideHead) return <span className="sr-only">{c.head}</span>
    const by = c.sortBy
    if (!by) return c.head
    const on = sort?.id === c.id
    return (
      <button
        type="button"
        onClick={() => {
          const dir = on && sort?.dir === 1 ? -1 : 1
          setSort({ id: c.id, dir })
          setSorted(sortKeys(rows, rowKey, by, dir))
        }}
        aria-label={m.sortBy(c.head)}
        aria-pressed={on}
        className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 hover:text-ink"
      >
        <span className="min-w-0 truncate">{c.head}</span>
        <ChevronDown
          aria-hidden
          className={cx("size-[0.85rem] transition-transform", !on && "invisible", sort?.dir === -1 && "rotate-180")}
        />
      </button>
    )
  }
  // A header never wraps: a two-line header made its row taller than the others' and pushed its column's cells down.
  // The padding keeps the sort button's focus ring inside the clipped box.
  const columnHead = (c: Column<T>) => (
    <span key={c.id} role="columnheader" className="-m-[0.15rem] min-w-0 truncate p-[0.15rem]">
      {head(c)}
    </span>
  )
  const cell = (c: Column<T>, r: T) => (
    <span key={c.id} role="cell" className={cx("min-w-0", look.cell, c.className)}>
      {c.cell(r)}
    </span>
  )
  const leadGroup = (children: ReactNode) =>
    lead.length > 0 && (
      <span className={LEAD} style={{ gridTemplateColumns: leadTrack }}>
        {children}
      </span>
    )

  return (
    <div
      aria-busy={busy || undefined}
      data-scrolled={scrolled || undefined}
      onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
      className={cx(
        "group/rack overflow-x-auto overflow-y-hidden rounded-[0.2rem] border border-line-strong bg-app transition-opacity duration-(--motion-normal)",
        busy && rows.length > 0 && "opacity-60",
      )}
    >
      <div
        role="table"
        aria-label={props.label}
        className={look.table}
        style={{ minWidth: props.minWidth, ...props.style }}
      >
        <div
          role="row"
          style={tracks}
          className={cx(grid, look.head, "text-left text-[0.9rem] font-medium text-ink-dim")}
        >
          {leadGroup(lead.map(columnHead))}
          {rest.map(columnHead)}
        </div>
        {props.top && (
          <div role="row">
            <div role="cell">{props.top}</div>
          </div>
        )}
        <div role="rowgroup">
          {shown.map((r) => {
            const key = rowKey(r)
            const under = props.below?.(r)
            return (
              <div key={key} data-row={key} className={cx(density === "roomy" && "border-line not-first:border-t")}>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: a click on the row is a shortcut for a button in it */}
                <div
                  role="row"
                  style={tracks}
                  onClick={props.onRowClick && ((e) => props.onRowClick?.(r, e))}
                  className={cx(
                    grid,
                    "group",
                    look.row,
                    props.onRowClick && "cursor-pointer transition-colors duration-(--motion-fast) hover:bg-app-2",
                    props.selected?.(r) && "bg-app-2",
                  )}
                >
                  {leadGroup(lead.map((c) => cell(c, r)))}
                  {rest.map((c) => cell(c, r))}
                </div>
                {under && (
                  <div role="row">
                    <div role="cell">{under}</div>
                  </div>
                )}
              </div>
            )
          })}
          {Array.from({ length: placeholders }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
            <div key={i} role="row" className={cx("flex items-center px-[1.3rem]", look.row)}>
              <Skeleton className="h-[1.3rem] w-full" {...(i === 0 && props.loading ? { label: props.loading } : {})} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

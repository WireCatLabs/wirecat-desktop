import {
  type KeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { formatNumber } from "@/i18n"
import { cx } from "./cx"
import { reducedMotion } from "./motion"

/**
 * A card being carried. The board marks each column `data-column="<id>"` and each card `data-card="<key>"`; `before`
 * is the card it would land above, `null` at the column's end. `copy` is true while Alt, Ctrl or ⌘ is held on a
 * board that asked for `copyable`; on any other board it stays false.
 */
export type BoardDrag<C extends string = string> = {
  key: string
  x: number
  y: number
  dx: number
  dy: number
  w: number
  to: C
  before: string | null
  copy: boolean
}

/** Where a card was put down, by pointer or keyboard. */
export type BoardDrop<C extends string = string> = { key: string; to: C; before: string | null; copy: boolean }
type Held<C extends string> = { key: string; to: C; index: number }

/** What the live region says at each step, in the page's own words; a step left out is not said. */
export type DragWords<C extends string> = {
  picked?: (key: string) => string
  place?: (column: C, at: number, of: number) => string
  dropped?: (key: string, column: C) => string
  /** `reason` is what `canDrop` gave when it refused the drop. */
  putBack?: (key: string, reason?: string) => string
}

const DRAG_PX = 6
const MOVE_MS = 220

const modifier = (e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean }) => e.altKey || e.ctrlKey || e.metaKey

type Places = Map<string, { x: number; y: number }>

/**
 * Cards that changed place slide from where they were, so a drop or a refusal is seen, never a jump. Columns do the
 * same when one comes or goes (the stage map's Unmapped), and a new column fades in. A card in a moving column slides
 * only by its own part of the move, or the two would add up. Places are kept relative to the board, so scrolling the
 * page between two changes is not mistaken for a move. `layout` is any value that changes when the cards do.
 */
export function useSlide(board: RefObject<HTMLElement | null>, layout: unknown) {
  const last = useRef<{ cards: Places; columns: Places } | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the cards are read from the page after each change of layout
  useLayoutEffect(() => {
    const grid = board.current
    if (!grid) return
    const g = grid.getBoundingClientRect()
    const read = (kind: "card" | "column") => {
      const places: Places = new Map()
      for (const el of grid.querySelectorAll<HTMLElement>(`[data-${kind}]`)) {
        const r = el.getBoundingClientRect()
        places.set(el.dataset[kind] ?? "", { x: r.left - g.left + grid.scrollLeft, y: r.top - g.top })
      }
      return places
    }
    const next = { cards: read("card"), columns: read("column") }
    const before = last.current
    last.current = next
    if (!before || reducedMotion() || typeof grid.animate !== "function") return
    const shift = (from: Places, to: Places, key: string) => {
      const a = from.get(key)
      const b = to.get(key)
      return a && b ? { dx: a.x - b.x, dy: a.y - b.y } : null
    }
    const slide = (el: HTMLElement, dx: number, dy: number) => {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: MOVE_MS,
        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
      })
    }
    for (const el of grid.querySelectorAll<HTMLElement>("[data-column]")) {
      const id = el.dataset.column ?? ""
      const d = shift(before.columns, next.columns, id)
      if (d) slide(el, d.dx, d.dy)
      else if (before.columns.size > 0) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE_MS })
    }
    for (const el of grid.querySelectorAll<HTMLElement>("[data-card]")) {
      const d = shift(before.cards, next.cards, el.dataset.card ?? "")
      if (!d) continue
      const column = el.closest<HTMLElement>("[data-column]")?.dataset.column ?? ""
      const carried = shift(before.columns, next.columns, column) ?? { dx: 0, dy: 0 }
      slide(el, d.dx - carried.dx, d.dy - carried.dy)
    }
  }, [layout])
}

/**
 * Pointer and keyboard moves of cards between columns. Pointer events, not HTML5 drag: a press becomes a drag only
 * after a few pixels, so text on a card still selects and a click still opens it. `canDrop` refuses a column; the card
 * then goes back where it was. A drop ends on the card itself, so the browser follows it with a click: `onClick` (or
 * `consumeClick`, for a board that handles clicks itself) leaves that one out.
 */
export function useBoardDrag<C extends string = string>(o: {
  /** The column a card stands in now. */
  columnOf: (key: string) => C | undefined
  onDrop: (drop: BoardDrop<C>) => void
  /** A click that was not the end of a drag. */
  onOpen?: (key: string) => void
  /** Escape put the card back. */
  onCancel?: (key: string) => void
  /** `false`, or the reason as text, refuses the column: the card goes back and `putBack` says why. */
  canDrop?: (key: string, to: C) => boolean | string
  /** `canDrop` refused this drop, for a board that also shows the reason on screen. */
  onRefuse?: (key: string, to: C, reason?: string) => void
  /** With `cardsIn`, Space lifts a card and the arrow keys carry it; without them only the pointer moves cards. */
  columns?: readonly C[]
  cardsIn?: (column: C) => string[]
  /** The live region's words; without them the board says nothing itself. */
  words?: DragWords<C>
  /** Alt, Ctrl or ⌘ held copies the card instead of moving it; off, `copy` is always false. */
  copyable?: boolean
}) {
  const copying = (e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean }) => o.copyable === true && modifier(e)
  const [drag, setDrag] = useState<BoardDrag<C> | null>(null)
  const [held, setHeld] = useState<Held<C> | null>(null)
  const [said, setSaid] = useState("")
  const press = useRef<{ key: string; x: number; y: number; el: HTMLElement } | null>(null)
  // A drop back where the card started ends on the card itself, so the browser follows it with a click.
  const dropped = useRef(false)
  const verdict = (key: string, to: C) => o.canDrop?.(key, to) ?? true

  useEffect(() => {
    if (held) document.querySelector<HTMLElement>(`[data-card="${held.key}"]`)?.focus({ preventScroll: true })
  }, [held])

  const say = (words: string | undefined) => words !== undefined && setSaid(words)
  const cardsIn = (c: C) => o.cardsIn?.(c) ?? []

  const drop = (key: string, to: C, before: string | null, copy: boolean) => {
    const from = o.columnOf(key)
    if (from === undefined) return
    const current = cardsIn(from)
    // Without an order to compare, any drop in the card's own column is no change; a copy there is none either.
    const unchanged =
      from === to &&
      (copy ||
        o.cardsIn === undefined ||
        current.filter((k) => k !== key)[current.indexOf(key)] === (before ?? undefined))
    const answer = unchanged ? true : verdict(key, to)
    if (unchanged || answer !== true) {
      const reason = typeof answer === "string" ? answer : undefined
      say(o.words?.putBack?.(key, reason))
      if (!unchanged) o.onRefuse?.(key, to, reason)
      return
    }
    say(o.words?.dropped?.(key, to))
    o.onDrop({ key, to, before, copy })
  }

  const target = (x: number, y: number, key: string): Pick<BoardDrag<C>, "to" | "before"> | null => {
    const col = document
      .elementsFromPoint(x, y)
      .find((el): el is HTMLElement => el instanceof HTMLElement && Boolean(el.dataset.column))
    if (!col) return null
    const cards = [...col.querySelectorAll<HTMLElement>("[data-card]")].filter((c) => c.dataset.card !== key)
    const next = cards.find((c) => {
      const r = c.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    return { to: col.dataset.column as C, before: next?.dataset.card ?? null }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = press.current
      if (!p) return
      if (!drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_PX) return
      const r = p.el.getBoundingClientRect()
      const t = target(e.clientX, e.clientY, p.key)
      window.getSelection()?.removeAllRanges()
      setDrag((d) => ({
        key: p.key,
        x: e.clientX,
        y: e.clientY,
        dx: d?.dx ?? p.x - r.left,
        dy: d?.dy ?? p.y - r.top,
        w: d?.w ?? r.width,
        to: t?.to ?? d?.to ?? (o.columnOf(p.key) as C),
        before: t ? t.before : (d?.before ?? null),
        copy: copying(e),
      }))
    }
    const onUp = (e: PointerEvent) => {
      if (drag) {
        dropped.current = true
        drop(drag.key, drag.to, drag.before, copying(e))
      }
      press.current = null
      setDrag(null)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!drag) return
      if (e.key === "Escape") {
        // The drag takes this Escape: a dialog holding the board stays open.
        e.preventDefault()
        press.current = null
        dropped.current = true
        setDrag(null)
        say(o.words?.putBack?.(drag.key))
        o.onCancel?.(drag.key)
      } else if (copying(e) !== drag.copy) setDrag({ ...drag, copy: copying(e) })
    }
    const onKeyUp = (e: globalThis.KeyboardEvent) => {
      if (drag && copying(e) !== drag.copy) setDrag({ ...drag, copy: copying(e) })
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKeyUp)
    }
  })

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, key: string) => {
    if (e.button !== 0 || held || (e.target as HTMLElement).closest("button,a,input,[role=combobox]")) return
    dropped.current = false
    press.current = { key, x: e.clientX, y: e.clientY, el: e.currentTarget }
  }

  /** Whether the click that follows was the end of a drag, which should open nothing. */
  const consumeClick = () => {
    const was = dropped.current
    dropped.current = false
    return was
  }

  const onClick = (key: string) => {
    if (!consumeClick()) o.onOpen?.(key)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, key: string) => {
    if (e.target !== e.currentTarget) return
    const from = o.columnOf(key)
    if (from === undefined) return
    if (!held) {
      if (e.key === " " && o.columns && o.cardsIn) {
        e.preventDefault()
        setHeld({ key, to: from, index: cardsIn(from).indexOf(key) })
        say(o.words?.picked?.(key))
      } else if (e.key === "Enter" && o.onOpen) {
        e.preventDefault()
        o.onOpen(key)
      }
      return
    }
    if (held.key !== key) return
    e.preventDefault()
    const columns = o.columns ?? []
    const others = (c: C) => cardsIn(c).filter((k) => k !== key)
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const i = columns.indexOf(held.to) + (e.key === "ArrowRight" ? 1 : -1)
      const to = columns[Math.max(0, Math.min(columns.length - 1, i))] ?? held.to
      const index = Math.min(held.index, others(to).length)
      setHeld({ ...held, to, index })
      say(o.words?.place?.(to, index + 1, others(to).length + 1))
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const index = Math.max(0, Math.min(others(held.to).length, held.index + (e.key === "ArrowDown" ? 1 : -1)))
      setHeld({ ...held, index })
      say(o.words?.place?.(held.to, index + 1, others(held.to).length + 1))
    } else if (e.key === " " || e.key === "Enter") {
      drop(key, held.to, others(held.to)[held.index] ?? null, copying(e))
      setHeld(null)
    } else if (e.key === "Escape") {
      setHeld(null)
      say(o.words?.putBack?.(key))
      o.onCancel?.(key)
    }
  }

  /** A column's cards as shown: a card carried by keyboard sits where it would land. */
  const shown = (column: C) => {
    const keys = cardsIn(column)
    if (!held) return keys
    const rest = keys.filter((k) => k !== held.key)
    return held.to === column ? [...rest.slice(0, held.index), held.key, ...rest.slice(held.index)] : rest
  }

  return { drag, held, said, shown, onPointerDown, onClick, consumeClick, onKeyDown }
}

/**
 * Columns side by side; below their minimum width the board scrolls sideways, never the page. Only sideways: an
 * `overflow-x` scroller is a vertical one too, and a card sliding past the bottom or a fraction of a pixel there gave
 * the board a second vertical scrollbar under the page's own.
 */
export function Board({
  columns,
  boardRef,
  children,
}: {
  columns: number
  boardRef?: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  return (
    <div
      ref={boardRef}
      className="grid gap-[0.75rem] overflow-x-auto overflow-y-hidden pb-[0.4rem] xl:gap-[1rem]"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(12rem, 1fr))` }}
    >
      {children}
    </div>
  )
}

/** One column: its lamp, name and count, an optional line beside them (a sum), its cards, and a quiet footer. */
export function BoardColumn({
  id,
  label,
  lamp,
  name,
  count,
  aside,
  target,
  empty,
  footer,
  children,
}: {
  id: string
  label: string
  lamp: ReactNode
  name: string
  /** A number, or "3 of 12" while a filter hides some. */
  count: number | string
  aside?: ReactNode
  /** A card is carried over it. */
  target?: boolean
  /** Shown in place of cards. */
  empty?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      data-column={id}
      aria-label={label}
      className={cx(
        "flex min-h-[22rem] min-w-0 flex-col rounded-[0.2rem] border bg-app transition-colors duration-(--motion-fast)",
        target ? "border-brand/60" : "border-line-strong",
      )}
    >
      <h2 className="flex min-h-[3rem] flex-wrap items-center gap-x-[0.55rem] border-line border-b px-[0.9rem] py-[0.4rem]">
        {lamp}
        <span className="min-w-0 truncate text-[1rem] font-semibold">{name}</span>
        <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">
          {typeof count === "number" ? formatNumber(count) : count}
        </span>
        {aside && <span className="basis-full text-[0.85rem] font-normal text-ink-soft">{aside}</span>}
      </h2>
      <ul className="flex flex-1 flex-col">
        {children}
        {empty && <li className="px-[0.9rem] py-[1rem] text-[0.9rem] text-ink-dim">{empty}</li>}
      </ul>
      {footer && <p className="border-line border-t px-[0.9rem] py-[0.5rem] text-[0.85rem] text-ink-dim">{footer}</p>}
    </section>
  )
}

export function DropLine() {
  return <div aria-hidden className="mx-[0.6rem] my-[-1px] h-[2px] rounded-full bg-brand" />
}

/** The copy that follows the pointer, lifted with the panel shadow. */
export function DragCopy<C extends string>({ drag, children }: { drag: BoardDrag<C>; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className={cx(
        "pointer-events-none fixed z-50 rounded-[0.35rem] border border-brand/50 bg-app shadow-panel",
        !reducedMotion() && "rotate-[1.2deg]",
      )}
      style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w }}
    >
      {children}
    </div>
  )
}

/** The class of a card that can be carried: a drag shows a dashed place, a keyboard hold lifts it. */
export const cardClass = (ghost: boolean, held: boolean, movable = true) =>
  cx(
    "group relative border-line border-b select-none [-webkit-user-select:none] transition-[background-color,box-shadow] duration-(--motion-fast) last:border-b-0 hover:bg-app-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
    movable ? "cursor-grab touch-none" : "cursor-pointer",
    ghost && "bg-app-3 outline-1 outline-line-strong outline-dashed -outline-offset-4 [&>*]:invisible",
    held && "z-10 bg-app shadow-panel outline-2 outline-brand",
  )

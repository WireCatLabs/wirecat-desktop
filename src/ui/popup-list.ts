import { type CSSProperties, type RefObject, useEffect, useLayoutEffect, useState } from "react"

const GAP = 4
const EDGE = 8
const MAX_HEIGHT = 288

/**
 * Where a fixed list opens beside its anchor: below it, or above when there is more room there, kept inside the
 * window. It follows the anchor on resize and on any scroll. An anchor in a row of filter chips (`data-chip-row`)
 * opens below or above the whole row: when the row wraps, a list under one chip would cover the chips under it.
 */
export function useListPlacement(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  list: RefObject<HTMLElement | null>,
  /** A calendar is taller than a list; it scrolls inside itself only when the window has no room for it. */
  maxHeight = MAX_HEIGHT,
): CSSProperties {
  const [place, setPlace] = useState<CSSProperties>({ visibility: "hidden" })
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const b = anchor.current?.getBoundingClientRect()
      const l = list.current
      if (!b || !l) return
      const row = anchor.current?.closest("[data-chip-row]")?.getBoundingClientRect() ?? b
      const natural = Math.min(l.scrollHeight, maxHeight)
      const below = window.innerHeight - row.bottom - GAP - EDGE
      const above = row.top - GAP - EDGE
      const up = natural > below && above > below
      const width = Math.max(b.width, l.offsetWidth)
      setPlace({
        left: Math.max(EDGE, Math.min(b.left, window.innerWidth - width - EDGE)),
        minWidth: b.width,
        maxHeight: Math.max(Math.min(maxHeight, up ? above : below), 96),
        ...(up ? { bottom: window.innerHeight - row.top + GAP } : { top: row.bottom + GAP }),
      })
    }
    position()
    window.addEventListener("resize", position)
    window.addEventListener("scroll", position, true)
    return () => {
      window.removeEventListener("resize", position)
      window.removeEventListener("scroll", position, true)
      setPlace({ visibility: "hidden" })
    }
  }, [open, anchor, list, maxHeight])
  return place
}

/** Closes an open list when a pointer goes down anywhere outside the elements given. */
export function useCloseOutside(open: boolean, inside: RefObject<HTMLElement | null>[], close: () => void) {
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      const t = e.target as Node
      if (!inside.some((r) => r.current?.contains(t))) close()
    }
    document.addEventListener("pointerdown", outside, true)
    return () => document.removeEventListener("pointerdown", outside, true)
  }, [open, inside, close])
}

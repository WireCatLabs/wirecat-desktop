import { type CSSProperties, type RefObject, useEffect, useLayoutEffect, useState } from "react"

const GAP = 4
const EDGE = 8
const MAX_HEIGHT = 288

/**
 * Where a fixed list opens beside its anchor: below it, or above when there is more room there, kept inside the
 * window. It follows the anchor on resize and on any scroll.
 */
export function useListPlacement(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  list: RefObject<HTMLElement | null>,
): CSSProperties {
  const [place, setPlace] = useState<CSSProperties>({ visibility: "hidden" })
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const b = anchor.current?.getBoundingClientRect()
      const l = list.current
      if (!b || !l) return
      const natural = Math.min(l.scrollHeight, MAX_HEIGHT)
      const below = window.innerHeight - b.bottom - GAP - EDGE
      const above = b.top - GAP - EDGE
      const up = natural > below && above > below
      const width = Math.max(b.width, l.offsetWidth)
      setPlace({
        left: Math.max(EDGE, Math.min(b.left, window.innerWidth - width - EDGE)),
        minWidth: b.width,
        maxHeight: Math.max(Math.min(MAX_HEIGHT, up ? above : below), 96),
        ...(up ? { bottom: window.innerHeight - b.top + GAP } : { top: b.bottom + GAP }),
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
  }, [open, anchor, list])
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

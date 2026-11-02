import { type CSSProperties, type RefObject, useEffect, useLayoutEffect, useState } from "react"

const GAP = 4
const EDGE = 8
const MAX_HEIGHT = 288

/**
 * Where a fixed list opens beside its anchor: below it, or above when there is more room there, kept inside the
 * window. It follows the anchor on resize and on any scroll.
 *
 * A calendar is taller than a list and must not scroll inside itself (`fixed`): when it fits neither below nor above,
 * it opens to the side of its anchor instead, because a box shorter than its content would spill over the anchor's
 * own row.
 */
export function useListPlacement(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  list: RefObject<HTMLElement | null>,
  { maxHeight = MAX_HEIGHT, fixed = false }: { maxHeight?: number; fixed?: boolean } = {},
): CSSProperties {
  const [place, setPlace] = useState<CSSProperties>({ visibility: "hidden" })
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const b = anchor.current?.getBoundingClientRect()
      const l = list.current
      if (!b || !l) return
      const natural = Math.min(l.scrollHeight, maxHeight)
      const below = window.innerHeight - b.bottom - GAP - EDGE
      const above = b.top - GAP - EDGE
      const width = Math.max(b.width, l.offsetWidth)
      if (fixed && natural > below && natural > above) {
        const side = besideAnchor(b, l.offsetWidth, l.scrollHeight)
        if (side) {
          setPlace(side)
          return
        }
      }
      const up = natural > below && above > below
      setPlace({
        left: Math.max(EDGE, Math.min(b.left, window.innerWidth - width - EDGE)),
        minWidth: b.width,
        maxHeight: Math.max(Math.min(maxHeight, up ? above : below), 96),
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
  }, [open, anchor, list, maxHeight, fixed])
  return place
}

function besideAnchor(b: DOMRect, width: number, height: number): CSSProperties | null {
  const right = b.right + GAP
  const left = b.left - GAP - width
  const x = right + width <= window.innerWidth - EDGE ? right : left >= EDGE ? left : null
  if (x === null) return null
  return { left: x, top: Math.max(EDGE, Math.min(b.top, window.innerHeight - height - EDGE)) }
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

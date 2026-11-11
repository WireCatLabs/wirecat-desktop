import {
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { cx } from "./cx"

const GAP = 6
const EDGE = 8
/** Time to cross the gap from the anchor to an interactive tip before it closes. */
const LEAVE_GRACE = 150

export type TipSide = "below" | "beside"
export type TipAlign = "center" | "end"

/**
 * When a tip shows: on hover (after `delay`, so a pointer crossing a board flashes nothing), on focus, or pinned by a
 * click. Escape and a press on the anchor hide it until the pointer or focus comes back. `keyboardOnly` opens on
 * keyboard focus only, for an anchor a click also focuses or a closing dialog hands focus back to.
 */
export function useTip(o: { delay?: number; disabled?: boolean; keyboardOnly?: boolean } = {}) {
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [hidden, setHidden] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const open = !o.disabled && !hidden && (hover || focus || pinned)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setHidden(true)
      setPinned(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return {
    open,
    togglePin: () => {
      setHidden(false)
      setPinned((p) => !p)
    },
    unpin: () => setPinned(false),
    hide: () => {
      clearTimeout(timer.current)
      setHidden(true)
      setPinned(false)
    },
    hover: {
      onMouseEnter: () => {
        setHidden(false)
        clearTimeout(timer.current)
        if (o.delay) timer.current = setTimeout(() => setHover(true), o.delay)
        else setHover(true)
      },
      onMouseLeave: () => {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setHover(false), LEAVE_GRACE)
      },
    },
    focus: {
      onFocus: (e: FocusEvent<HTMLElement>) => {
        if (e.target !== e.currentTarget) return
        // The app's own record of the last way the owner moved (input-mode.ts): WebKit's :focus-visible also matches a
        // focus that follows a click. Escape that closes a dialog counts as keyboard, so focus coming back from a
        // dialog is left out too.
        const pointer = e.currentTarget.ownerDocument.documentElement.dataset.input === "pointer"
        const from = e.relatedTarget instanceof Element ? e.relatedTarget : null
        if (o.keyboardOnly && (pointer || !from || from.closest("dialog"))) return
        setHidden(false)
        setFocus(true)
      },
      onBlur: () => setFocus(false),
    },
  }
}

/** Where the tip stands: under the anchor (above when there is no room), or beside it (left when there is none). */
function useTipPlacement(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  tip: RefObject<HTMLElement | null>,
  side: TipSide,
  align: TipAlign,
): CSSProperties | null {
  const [place, setPlace] = useState<CSSProperties | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const a = anchor.current?.getBoundingClientRect()
      const t = tip.current
      if (!a || !t) return
      const w = t.offsetWidth
      const h = t.offsetHeight
      const vw = window.innerWidth
      const vh = window.innerHeight
      const clamp = (v: number, max: number) => Math.max(EDGE, Math.min(v, max - EDGE))
      if (side === "beside") {
        const right = a.right + GAP
        const left = right + w <= vw - EDGE ? right : a.left - GAP - w
        setPlace({ left: clamp(left, vw - w), top: clamp(a.top, vh - h) })
        return
      }
      const below = a.bottom + GAP
      const top = below + h <= vh - EDGE || a.top - GAP - h < EDGE ? below : a.top - GAP - h
      const left = align === "end" ? a.right - w : a.left + a.width / 2 - w / 2
      setPlace({ left: clamp(left, vw - w), top })
    }
    position()
    window.addEventListener("resize", position)
    window.addEventListener("scroll", position, true)
    return () => {
      window.removeEventListener("resize", position)
      window.removeEventListener("scroll", position, true)
    }
  }, [open, anchor, tip, side, align])
  return place
}

/**
 * The tip's panel, outside every scrolling box so nothing clips it, and inside the open dialog when its anchor is in
 * one: a modal dialog sits above everything outside it. It fades and rises in; reduced motion makes that instant.
 */
export function TipPanel({
  id,
  anchor,
  open,
  side = "below",
  align = "center",
  className,
  interactive = false,
  hover,
  children,
}: {
  id: string
  anchor: RefObject<HTMLElement | null>
  open: boolean
  side?: TipSide
  align?: TipAlign
  className?: string
  /** The pointer may rest on the tip and select its text; `hover` keeps it open meanwhile. */
  interactive?: boolean
  hover?: { onMouseEnter: () => void; onMouseLeave: () => void }
  children: ReactNode
}) {
  const tip = useRef<HTMLSpanElement>(null)
  const [host, setHost] = useState<Element | null>(null)
  useLayoutEffect(() => {
    setHost(anchor.current?.closest("dialog") ?? document.body)
  }, [anchor])
  // Placed once the host is known, so a panel mounted already open (one per table row, mounted on demand) is placed too.
  const place = useTipPlacement(open && host !== null, anchor, tip, side, align)
  if (!host) return null
  const shown = open && place !== null
  return createPortal(
    <span
      ref={tip}
      id={id}
      role="tooltip"
      style={place ?? { left: -9999, top: 0 }}
      {...(interactive ? hover : {})}
      className={cx(
        interactive && shown ? "pointer-events-auto" : "pointer-events-none",
        "fixed z-50 block rounded-[0.5rem] border border-line-strong bg-app-2 p-3 text-[0.9rem] font-normal text-ink-soft shadow-lg transition-[opacity,translate,visibility] duration-(--motion-fast) ease-out-quart",
        side === "beside" ? "w-[min(22rem,80vw)]" : "w-[min(24rem,80vw)]",
        shown ? "visible translate-y-0 opacity-100" : "invisible translate-y-[0.25rem] opacity-0",
        className,
      )}
    >
      {children}
    </span>,
    host,
  )
}

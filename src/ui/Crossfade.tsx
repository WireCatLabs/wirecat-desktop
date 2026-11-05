import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { cx } from "./cx"
import { MOTION, reducedMotion } from "./motion"

export const FADE_MS = MOTION.normal

type Layer = { key: string; node: ReactNode }

const FOCUSABLE =
  "[data-autofocus], button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]"

/**
 * Swaps one view for another (an agent's pane for the next one) by fading the old out over the new, so the area never
 * goes blank. Each `swap` value mounts its own copy, so one view's state (an open disclosure) never leaks into the next.
 * The leaving copy is lifted out of the flow, so a surrounding `AutoHeight` follows only the new view's height.
 */
export function Crossfade(props: {
  swap: string
  children: ReactNode
  className?: string
  /** `end` for a view that sits at the right of its cell (a row's button): the leaving copy keeps to that edge. */
  align?: "start" | "end"
}) {
  const { swap, children, className, align = "start" } = props
  const edge = align === "end" ? "flex justify-end" : undefined
  const [leaving, setLeaving] = useState<Layer[]>([])
  const [current, setCurrent] = useState(swap)
  const committed = useRef<Layer>({ key: swap, node: children })
  const shownRef = useRef<HTMLDivElement>(null)
  // The view that held focus (Install, now Cancel) is replaced by a new copy; focus follows it there.
  const hadFocus = useRef(false)
  if (current !== swap) {
    hadFocus.current = shownRef.current?.contains(document.activeElement) ?? false
    setCurrent(swap)
    const old = committed.current
    setLeaving((l) => (reducedMotion() ? [] : [...l.filter((x) => x.key !== swap && x.key !== old.key), old]))
  }
  useLayoutEffect(() => {
    committed.current = { key: swap, node: children }
  })
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per swap, after the new view is in place
  useLayoutEffect(() => {
    if (!hadFocus.current) return
    hadFocus.current = false
    shownRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
  }, [swap])

  useEffect(() => {
    if (leaving.length === 0) return
    const t = setTimeout(() => setLeaving([]), FADE_MS)
    return () => clearTimeout(t)
  }, [leaving])

  // One keyed list, so the view that starts leaving keeps its mounted instance instead of being rebuilt.
  const layers = [...leaving.map((l) => ({ ...l, out: true })), { key: swap, node: children, out: false }]
  return (
    <div className={cx("relative", className)}>
      {layers.map((l) =>
        l.out ? (
          <div
            key={l.key}
            inert
            aria-hidden
            className={cx("fade-out pointer-events-none absolute inset-x-0 top-0", edge)}
          >
            {l.node}
          </div>
        ) : (
          <div key={l.key} ref={shownRef} className={cx(leaving.length > 0 && "fade-in", edge)}>
            {l.node}
          </div>
        ),
      )}
    </div>
  )
}

import { Info } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { cx } from "./cx"

type Props = {
  /** What the button is called for a screen reader, e.g. "About community tools". */
  label: string
  children: ReactNode
  className?: string
}

/** A small "i" whose text opens on hover, focus or click and closes on Escape, a click elsewhere or leaving. */
export function InfoTip({ label, children, className }: Props) {
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [pinned, setPinned] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const tip = useId()
  const open = hover || focus || pinned

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setHover(false)
      setPinned(false)
    }
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setPinned(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
    }
  }, [open])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only widens the open area; the button carries the semantics
    <span
      ref={root}
      className={cx("relative inline-flex", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={tip}
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className="grid size-[1.4rem] place-items-center rounded-full text-ink-dim hover:text-ink focus-visible:text-ink"
      >
        <Info className="size-4" strokeWidth={1.8} aria-hidden />
      </button>
      <span
        id={tip}
        role="tooltip"
        className={cx(
          "absolute top-full left-1/2 z-20 mt-1 w-[min(24rem,80vw)] -translate-x-1/4 rounded-[0.5rem] border border-line-strong bg-app-2 p-3 text-[0.9rem] font-normal text-ink-soft shadow-lg transition-opacity duration-(--motion-fast) ease-out-quart",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {children}
      </span>
    </span>
  )
}

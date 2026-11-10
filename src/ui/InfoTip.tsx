import { Info } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef } from "react"
import { cx } from "./cx"
import { type TipAlign, TipPanel, useTip } from "./Tooltip"

type Props = {
  /** What the button is called for a screen reader, e.g. "About community tools". */
  label: string
  children: ReactNode
  className?: string
  /** Shown instead of the "i", such as a badge; then it names the button and `label` is not used. */
  trigger?: ReactNode
  /** `end` opens the text leftwards, for a tip at the right edge of its box. */
  align?: TipAlign
}

/** A small "i" whose text opens on hover, focus or click and closes on Escape, a click elsewhere or leaving. */
export function InfoTip({ label, children, className, trigger, align = "center" }: Props) {
  const tip = useTip()
  const root = useRef<HTMLSpanElement>(null)
  const id = useId()
  const { open, unpin } = tip

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (root.current?.contains(target) || document.getElementById(id)?.contains(target)) return
      unpin()
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [open, unpin, id])

  return (
    <span ref={root} className={cx("relative inline-flex", className)} {...tip.hover}>
      <button
        type="button"
        aria-label={trigger ? undefined : label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={tip.togglePin}
        {...tip.focus}
        className={
          trigger
            ? "inline-flex cursor-help rounded-[0.3rem]"
            : "grid size-[1.4rem] place-items-center rounded-full text-ink-dim hover:text-ink focus-visible:text-ink"
        }
      >
        {trigger ?? <Info className="size-4" strokeWidth={1.8} aria-hidden />}
      </button>
      <TipPanel id={id} anchor={root} open={open} align={align} interactive hover={tip.hover}>
        {children}
      </TipPanel>
    </span>
  )
}

import { ChevronDown } from "lucide-react"
import { cx } from "./cx"

/** The sign that something opens: at the right edge of what the owner clicks, or right after a title (DESIGN.md). */
export function ExpandChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      aria-hidden
      className={cx(
        "size-4 shrink-0 text-ink-dim transition-transform duration-(--motion-normal)",
        open && "rotate-180",
        className,
      )}
    />
  )
}

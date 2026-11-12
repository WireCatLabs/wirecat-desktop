import type { ReactNode } from "react"
import { cx } from "./cx"

export function Pill({
  children,
  tone = "neutral",
  size = "md",
}: {
  children: ReactNode
  tone?: "neutral" | "brand" | "warn" | "bad"
  /** `sm` for a pill inside a card: smaller, and it shortens with an ellipsis instead of wrapping. */
  size?: "sm" | "md"
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-pill font-medium",
        size === "md" && "px-[0.45rem] py-[0.1rem] text-[0.85rem]",
        size === "sm" && "min-w-0 max-w-full px-[0.35rem] text-[0.78rem] leading-[1.35rem]",
        tone === "neutral" && "bg-app-3 text-ink-soft",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "warn" && "bg-warn/15 text-warn-ink",
        tone === "bad" && "bg-bad/15 text-bad",
      )}
    >
      {size === "sm" ? (
        <span className="truncate" title={typeof children === "string" ? children : undefined}>
          {children}
        </span>
      ) : (
        children
      )}
    </span>
  )
}

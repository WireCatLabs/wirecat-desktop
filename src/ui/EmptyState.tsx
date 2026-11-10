import type { ReactNode } from "react"
import { cx } from "./cx"

type Props = {
  title?: ReactNode
  children?: ReactNode
  /** What to do next, such as "Clear filters" or "Open Agents". */
  action?: ReactNode
  /** The answer is being read again: the old message stays, dimmed, so the box does not jump. */
  busy?: boolean
}

/** A list, table or page with nothing to show, and why: one box for "nothing yet" and "nothing matches". */
export function EmptyState({ title, children, action, busy = false }: Props) {
  return (
    <div
      aria-busy={busy || undefined}
      className={cx(
        "rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-body text-ink-soft transition-opacity duration-(--motion-normal)",
        busy && "opacity-60",
      )}
    >
      {title && <p className="font-medium text-ink">{title}</p>}
      {children && <div className={cx("max-w-[70ch]", title !== undefined && "mt-1")}>{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

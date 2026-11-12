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
  const titled = title !== undefined && title !== null && title !== ""
  return (
    <div
      aria-busy={busy || undefined}
      className={cx(
        "rounded-rack border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-body text-ink-soft transition-opacity duration-(--motion-normal)",
        busy && "opacity-60",
      )}
    >
      {titled && <div className="font-medium text-ink">{title}</div>}
      {children != null && children !== "" && <div className={cx("max-w-[70ch]", titled && "mt-1")}>{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

import { RefreshCw } from "lucide-react"
import { Button } from "./Button"
import { cx } from "./cx"
import { StableText } from "./Skeleton"

type Props = {
  busy: boolean
  onClick: () => void
  label: string
  busyLabel: string
  /** Off for a reason other than its own run, such as another check in progress. */
  disabled?: boolean
  tour?: string
  className?: string
}

/** A page's or a panel's "Read again" / "Check again": one look, one spinner, a label that does not change width. */
export function RefreshButton({ busy, onClick, label, busyLabel, disabled = false, tour, className }: Props) {
  return (
    <Button
      variant="ghost"
      size="sm"
      data-tour={tour}
      disabled={busy || disabled}
      aria-busy={busy}
      onClick={onClick}
      className={className}
      icon={<RefreshCw className={cx("size-4", busy && "motion-safe:animate-spin")} aria-hidden />}
    >
      <StableText value={busy ? busyLabel : label} variants={[label, busyLabel]} />
    </Button>
  )
}

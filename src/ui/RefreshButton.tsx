import { RefreshCw } from "lucide-react"
import { Button } from "./Button"
import { cx } from "./cx"
import { StableText } from "./Skeleton"

type Props = {
  busy: boolean
  onClick: () => void
  label: string
  busyLabel: string
  variant?: "ghost" | "secondary"
  /** The icon alone, with the label for a screen reader, where a row has no room for the words. */
  iconOnly?: boolean
  /** Off for a reason other than its own run, such as another check in progress. */
  disabled?: boolean
  tour?: string
  className?: string
}

/**
 * A page's or a panel's "Read again" / "Check again": one look, one spinner, a label that does not change width.
 * Busy, it stays enabled and ignores clicks: a disabled button drops keyboard focus to the page (UX-67), and Logs'
 * live mode reads every few seconds.
 */
export function RefreshButton(props: Props) {
  const {
    busy,
    onClick,
    label,
    busyLabel,
    variant = "ghost",
    iconOnly = false,
    disabled = false,
    tour,
    className,
  } = props
  return (
    <Button
      variant={variant}
      size="sm"
      aria-label={iconOnly ? label : undefined}
      data-tour={tour}
      disabled={disabled}
      aria-busy={busy}
      onClick={() => {
        if (!busy) onClick()
      }}
      className={className}
      icon={<RefreshCw className={cx("size-4", busy && "motion-safe:animate-spin")} aria-hidden />}
    >
      {!iconOnly && <StableText value={busy ? busyLabel : label} variants={[label, busyLabel]} />}
    </Button>
  )
}

import { useId } from "react"
import { useMessages } from "@/i18n"
import { Button } from "./Button"
import { cx } from "./cx"
import { uiMessages } from "./messages"

/**
 * The way to the step before, in the footer's right-hand group just before Cancel and Next, so the three a wizard
 * moves with sit together (owner, 2026-11-13). With a `reason` it stays in place but does nothing and says why (hover,
 * focus, and a screen reader's description), because a button that vanishes reads as a bug (rule 9).
 */
export function BackButton(props: {
  onClick(): void
  /** Why going back is not possible now; left out when it is. */
  reason?: string | undefined
  /** What going back stops, said beside the button. */
  stops?: string | undefined
  size?: "sm" | "md"
  className?: string
}) {
  const { onClick, reason, stops, size = "md", className } = props
  const m = useMessages(uiMessages)
  const id = useId()
  const shown = Boolean(stops) && !reason
  return (
    <>
      {shown && <span className="self-center pr-1 text-body text-ink-soft">{stops}</span>}
      <Button
        size={size}
        variant="ghost"
        data-back
        aria-disabled={reason ? true : undefined}
        aria-describedby={reason ? id : undefined}
        title={reason}
        className={cx(reason && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-ink-soft", className)}
        onClick={reason ? undefined : onClick}
      >
        {m.back}
      </Button>
      {reason && (
        <span id={id} hidden>
          {reason}
        </span>
      )}
    </>
  )
}

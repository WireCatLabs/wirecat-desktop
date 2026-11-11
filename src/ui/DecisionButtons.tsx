import { Check, X } from "lucide-react"
import { Button } from "./Button"

export type Decision = "keep" | "drop"

/**
 * Approve and Reject for one item whose choice waits for a later Save: two real buttons, the chosen one pressed
 * (aria-pressed) and tinted, approve in the positive colour and reject in the negative one. Both always show their
 * icon, so a change of choice moves nothing.
 */
export function DecisionButtons({
  label,
  value,
  onChange,
  disabled = false,
  keepLabel,
  dropLabel,
}: {
  /** What is decided, for screen readers: "Decision on: …". */
  label: string
  value: Decision
  onChange: (value: Decision) => void
  disabled?: boolean
  keepLabel: string
  dropLabel: string
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of two toggle buttons, not a form fieldset
    <div role="group" aria-label={label} className="inline-flex shrink-0 items-center gap-1.5">
      <Button
        size="sm"
        aria-pressed={value === "keep"}
        disabled={disabled}
        onClick={() => onChange("keep")}
        icon={<Check className="size-4 text-ink-dim" aria-hidden />}
        className="aria-pressed:border-ok/70 aria-pressed:bg-ok/12 aria-pressed:text-ink aria-pressed:[&_svg]:text-ok"
      >
        {keepLabel}
      </Button>
      <Button
        size="sm"
        aria-pressed={value === "drop"}
        disabled={disabled}
        onClick={() => onChange("drop")}
        icon={<X className="size-4 text-ink-dim" aria-hidden />}
        className="aria-pressed:border-bad/60 aria-pressed:bg-bad/8 aria-pressed:text-bad aria-pressed:[&_svg]:text-bad"
      >
        {dropLabel}
      </Button>
    </div>
  )
}

/** Approve all and Reject all over a list of such choices, in the same button family. */
export function DecideAll(props: {
  label: string
  keepAll: string
  dropAll: string
  onChange: (value: Decision) => void
  disabled?: boolean
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a pair of buttons with a shared name
    <div role="group" aria-label={props.label} className="inline-flex shrink-0 items-center gap-1.5">
      <Button
        size="sm"
        disabled={props.disabled}
        onClick={() => props.onChange("keep")}
        icon={<Check className="size-4" aria-hidden />}
      >
        {props.keepAll}
      </Button>
      <Button
        size="sm"
        disabled={props.disabled}
        onClick={() => props.onChange("drop")}
        icon={<X className="size-4" aria-hidden />}
      >
        {props.dropAll}
      </Button>
    </div>
  )
}

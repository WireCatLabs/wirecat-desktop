import { Check } from "lucide-react"
import { cx } from "./cx"

/** The drawn box alone, for a control that is not a checkbox itself (a filter's option, a toggle chip). */
export function CheckMark({ on, round = false, className }: { on: boolean; round?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid size-[1rem] shrink-0 place-items-center border transition-colors duration-150",
        round ? "rounded-full" : "rounded-[0.25rem]",
        on ? "border-brand bg-brand text-brand-ink" : "border-line-strong bg-app",
        className,
      )}
    >
      {on &&
        (round ? (
          <span className="size-[0.4rem] rounded-full bg-current" />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        ))}
    </span>
  )
}

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean | undefined
  id?: string
  name?: string
  value?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
  className?: string
}

/**
 * A real checkbox, drawn by us: WebKitGTK and Windows each paint their own native box, which ignores the theme. The
 * input stays transparent over the box, so a click on the box alone works too and the label still toggles it.
 */
export function Checkbox(props: Props) {
  return <Native type="checkbox" {...props} />
}

/** One choice of a radio group, drawn as the checkbox is. */
export function Radio(props: Omit<Props, "onChange"> & { onChange: () => void }) {
  return <Native type="radio" {...props} onChange={() => props.onChange()} />
}

function Native({ type, checked, onChange, disabled, className, ...rest }: Props & { type: "checkbox" | "radio" }) {
  const round = type === "radio"
  return (
    <span className={cx("control-box relative inline-grid shrink-0 place-items-center", className)}>
      <input
        type={type}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none opacity-0 disabled:cursor-default"
      />
      <CheckMark
        on={checked}
        round={round}
        className={cx(
          "pointer-events-none size-[1.05rem] peer-hover:border-ink-dim/70 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
          checked && "peer-hover:border-brand",
          disabled && "opacity-45",
        )}
      />
    </span>
  )
}

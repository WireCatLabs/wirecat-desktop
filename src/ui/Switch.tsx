import { cx } from "./cx"

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  id?: string
  disabled?: boolean
  "aria-describedby"?: string
  className?: string
}

/** An on/off setting that takes effect by itself, without a Save button. */
export function Switch({ checked, onChange, disabled, className, ...rest }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      {...rest}
      className={cx(
        "relative inline-flex h-[1.4rem] w-[2.5rem] shrink-0 items-center rounded-full border transition-colors duration-(--motion-fast) ease-out-quart disabled:opacity-45",
        checked ? "border-brand bg-brand" : "border-line-strong bg-app-3",
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          "absolute size-[1rem] rounded-full bg-app shadow-panel transition-transform duration-(--motion-fast) ease-out-quart",
          checked ? "translate-x-[1.15rem]" : "translate-x-[0.15rem]",
        )}
      />
    </button>
  )
}

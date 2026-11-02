import { type ReactNode, useId } from "react"
import { cx } from "./cx"

type Option<T extends string> = { value: T; label: string; icon: ReactNode }

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  labelClass,
}: {
  label: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  /**
   * Shows each label beside its icon. The class is the caller's so a container query can hide the labels where they do
   * not fit; the icon and its tooltip remain.
   */
  labelClass?: string
}) {
  const name = useId()
  return (
    <fieldset className="inline-flex rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} title={o.label} className="relative">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
            className="peer sr-only"
          />
          <span className="sr-only">{o.label}</span>
          <span
            aria-hidden
            className={cx(
              "flex h-7 min-w-7 cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.35rem] text-ink-dim transition-colors duration-150 hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand",
              labelClass !== undefined && "px-[0.45rem]",
            )}
          >
            {o.icon}
            {labelClass !== undefined && <span className={cx("text-[0.9rem]", labelClass)}>{o.label}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

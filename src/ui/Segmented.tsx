import { type ReactNode, useId } from "react"
import { cx } from "./cx"

type Option<T extends string> = { value: T; label: string; icon: ReactNode }

/** `sm` sits in a toolbar, icons first; `md` is a page's view switch (Table · Board), its labels always shown. */
type Size = "sm" | "md"

const LOOK: Record<Size, { box: string; item: string; face: string }> = {
  sm: {
    box: "",
    item: "",
    face: "h-7 min-w-7 justify-center text-ink-dim",
  },
  md: {
    box: "h-8 items-center",
    item: "h-full",
    face: "h-full px-[0.65rem] text-[0.875rem] text-ink-soft",
  },
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  labelClass,
  size = "sm",
  tour,
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
  size?: Size
  /** The tour's anchor. */
  tour?: string
}) {
  const name = useId()
  const look = LOOK[size]
  const labelled = size === "md" || labelClass !== undefined
  return (
    <fieldset data-tour={tour} className={cx("inline-flex rounded-[0.45rem] border-0 bg-app-3 p-[3px]", look.box)}>
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} title={size === "sm" ? o.label : undefined} className={cx("relative", look.item)}>
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
              "flex cursor-pointer items-center gap-[0.4rem] rounded-[0.35rem] transition-colors duration-(--motion-fast) hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand",
              look.face,
              size === "sm" && labelClass !== undefined && "px-[0.45rem]",
            )}
          >
            {o.icon}
            {labelled && <span className={cx(size === "sm" && "text-[0.9rem]", labelClass)}>{o.label}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

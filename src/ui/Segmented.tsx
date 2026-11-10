import { type ReactNode, useId } from "react"
import { cx } from "./cx"

/** `count` is said after the label, in mono, as a tab's number of rows ("Waiting for you 10"). */
type Option<T extends string> = { value: T; label: string; icon?: ReactNode; count?: string | number | undefined }

/**
 * `sm` sits in a toolbar, icons first; `md` is a page's switch (Table · Board, a status tab), labels shown; `lg` is `md`
 * in a row with a 2.8rem search field or select, as Logs' time range. `md` and `lg` wrap onto more lines when narrow.
 */
type Size = "sm" | "md" | "lg"

const LOOK: Record<Size, { box: string; item: string; face: string }> = {
  sm: {
    box: "",
    item: "",
    face: "h-7 min-w-7 justify-center text-ink-dim",
  },
  md: {
    box: "min-w-0 max-w-full flex-wrap items-center",
    item: "h-[calc(2rem-6px)]",
    face: "h-full px-[0.65rem] text-[0.875rem] text-ink-soft",
  },
  lg: {
    box: "min-w-0 max-w-full flex-wrap items-center",
    item: "h-[calc(2.8rem-6px)]",
    face: "h-full px-[0.8rem] text-[0.95rem] text-ink-soft",
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
  disabled = false,
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
  /** A stand-in while the real choices load: shown, not usable. */
  disabled?: boolean
}) {
  const name = useId()
  const look = LOOK[size]
  const labelled = size !== "sm" || labelClass !== undefined
  return (
    <fieldset
      data-tour={tour}
      disabled={disabled}
      className={cx(
        "inline-flex rounded-[0.45rem] border-0 bg-app-3 p-[3px]",
        look.box,
        disabled && "pointer-events-none",
      )}
    >
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
          <span className="sr-only">{o.count === undefined ? o.label : `${o.label} ${o.count}`}</span>
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
            {o.count !== undefined && (
              <span className="font-mono text-[0.85rem] text-ink-dim tabular-nums">{o.count}</span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

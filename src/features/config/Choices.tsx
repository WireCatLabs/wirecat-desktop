import type { ReactNode } from "react"
import { cx } from "@/ui/cx"

export function Choices({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2 border-0 p-0">
      <legend className="float-left mr-2 min-w-[4.2rem] text-[0.9rem] font-medium text-ink-dim">{label}</legend>
      {children}
    </fieldset>
  )
}

export function Choice(props: {
  group: string
  checked: boolean
  /** Only while the choices are still being read. */
  disabled?: boolean
  /** Why it cannot be chosen now: it stays focusable and dimmed, and choosing it hands this to `onUnavailable`. */
  unavailable?: string | undefined
  onUnavailable?: (why: string) => void
  onSelect: () => void
  children: ReactNode
}) {
  const { group, checked, disabled, unavailable, onUnavailable, onSelect, children } = props
  return (
    <label title={unavailable} className={cx("relative", (disabled || unavailable) && "opacity-45")}>
      <input
        type="radio"
        name={`config-${group}`}
        checked={checked}
        disabled={disabled}
        onChange={() => (unavailable ? onUnavailable?.(unavailable) : onSelect())}
        className="peer sr-only"
      />
      <span
        className={cx(
          "inline-flex h-8 cursor-pointer items-center gap-2 rounded-[0.35rem] border px-3 text-[0.95rem] transition-colors duration-150",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
          checked
            ? "border-brand bg-brand-soft font-medium text-ink"
            : "border-line-strong bg-app text-ink-soft hover:border-ink-dim/60 hover:text-ink",
        )}
      >
        {children}
      </span>
    </label>
  )
}

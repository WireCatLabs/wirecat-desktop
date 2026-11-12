import type { ReactNode } from "react"
import { cx } from "@/ui/cx"

/** One choice of a picker dialog: a radio drawn as a row, the chosen one in the brand colour. */
export function Choice(props: {
  group: string
  checked: boolean
  onChange: () => void
  first?: boolean
  children: ReactNode
}) {
  return (
    <label className="relative">
      <input
        type="radio"
        name={props.group}
        checked={props.checked}
        onChange={props.onChange}
        data-autofocus={props.first || undefined}
        className="peer sr-only"
      />
      <span
        className={cx(
          "flex cursor-pointer items-center justify-between gap-3 rounded-control border px-3 py-2 text-[0.95rem] transition-colors duration-(--motion-fast)",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
          props.checked
            ? "border-brand bg-brand-soft font-medium text-ink"
            : "border-line-strong bg-app text-ink-soft hover:border-ink-dim/60 hover:text-ink",
        )}
      >
        {props.children}
      </span>
    </label>
  )
}

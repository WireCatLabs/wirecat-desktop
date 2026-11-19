import { Search } from "lucide-react"
import { cx } from "./cx"
import { fieldFocus } from "./field"

/**
 * A search over plain words (a guide's title, a mail rule's note): FilterBar's 2.8rem field without its chips and
 * without its mono `field:value` look. Escape clears it.
 */
export function SearchField(props: {
  value: string
  onChange: (value: string) => void
  /** The field's accessible name; the placeholder shows what it searches. */
  label: string
  placeholder: string
  className?: string
  /** The dialog it opens in starts on it. */
  focusFirst?: boolean
}) {
  const { value, onChange, label, placeholder, className, focusFirst = false } = props
  return (
    <label className={cx("relative block", className)}>
      <span className="sr-only">{label}</span>
      <Search
        className="pointer-events-none absolute top-1/2 left-[0.8rem] size-4 -translate-y-1/2 text-ink-dim"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // The native field clears itself on Escape without telling React, and Escape would close a dialog too.
          if (e.key === "Escape" && value) {
            e.preventDefault()
            e.stopPropagation()
            onChange("")
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        data-autofocus={focusFirst || undefined}
        className={`selectable h-[2.8rem] w-full rounded-control border border-line-strong bg-app pr-[0.8rem] pl-[2.3rem] text-[0.95rem] text-ink placeholder:text-ink-dim ${fieldFocus}`}
      />
    </label>
  )
}

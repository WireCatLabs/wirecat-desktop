import { Search } from "lucide-react"
import type { ReactNode } from "react"
import { useMessages } from "@/i18n"
import { Button } from "./Button"
import { CheckMark } from "./Checkbox"
import { cx } from "./cx"
import { uiMessages } from "./messages"

type Props = {
  query: string
  /** Each keystroke. */
  onQuery: (query: string) => void
  /** Clear all, and Escape in the field; a page that waits for typing to pause wants these at once. */
  onClear?: () => void
  /** The field's accessible name; the placeholder shows the words it reads. */
  label: string
  placeholder: string
  invalid?: boolean
  describedBy?: string | undefined
  /** The chips: `FilterMenu`s and `ToggleChip`s, in the order they read. */
  children: ReactNode
}

/**
 * One search field over a row of filter chips, as Tasks and Memory show them. The chips write `field:value` words
 * into the field and read them back, so typing `project:HRB` and picking HRB in the chip are the same thing.
 */
export function FilterBar(props: Props) {
  const { query, onQuery, label, placeholder, invalid = false, describedBy, children } = props
  const m = useMessages(uiMessages)
  const clear = props.onClear ?? (() => onQuery(""))
  return (
    <div className="flex flex-col gap-[0.7rem]">
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-[0.8rem] size-4 -translate-y-1/2 text-ink-dim"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            // The native field clears itself on Escape without telling React; the page's own Clear does it instead.
            if (e.key === "Escape" && query) {
              e.preventDefault()
              clear()
            }
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cx(
            "selectable inner-field h-[2.8rem] w-full rounded-[0.35rem] border bg-app pr-[0.8rem] pl-[2.3rem] font-mono text-[0.95rem] text-ink outline-none no-ligatures placeholder:font-sans placeholder:text-ink-dim hover:border-ink-dim/60 focus-visible:border-brand",
            invalid ? "border-bad hover:border-bad" : "border-line-strong",
          )}
        />
      </label>
      <div className="flex flex-wrap items-center gap-[0.5rem]">
        {children}
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          className={cx(!query && "invisible")}
          tabIndex={query ? undefined : -1}
          aria-hidden={query ? undefined : true}
        >
          {m.clearAll}
        </Button>
      </div>
    </div>
  )
}

/** A filter that is on or off, as "Can start now": the same chip as a `FilterMenu`, with a box instead of a list. */
export function ToggleChip({
  on,
  onChange,
  children,
}: {
  on: boolean
  onChange: (on: boolean) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cx(
        "flex h-8 cursor-pointer items-center gap-[0.45rem] rounded-[0.35rem] border px-[0.6rem] text-[0.875rem] transition-colors duration-150",
        on
          ? "border-brand/50 bg-brand-soft text-ink hover:bg-brand/15 active:bg-brand/20"
          : "border-line-strong bg-app text-ink-soft hover:bg-app-2 hover:text-ink active:bg-app-3",
      )}
    >
      <CheckMark on={on} className="size-[0.95rem]" />
      {children}
    </button>
  )
}

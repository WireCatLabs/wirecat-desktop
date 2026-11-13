import { ChevronDown, ChevronUp, Search } from "lucide-react"
import { type KeyboardEvent, type Ref, useId } from "react"
import { cx } from "./cx"

export type FindBarLabels = {
  find: string
  placeholder: string
  none: string
  count: (n: number, of: number) => string
  previous: string
  next: string
}

/**
 * A find band over text: the matches counted, Enter and Shift+Enter (or the arrows) to the next and previous one,
 * Escape to clear. The caller finds and scrolls; this only asks for a step.
 */
export function FindBar({
  value,
  onChange,
  onStep,
  found,
  current,
  labels,
  inputRef,
  className,
}: {
  value: string
  onChange: (value: string) => void
  onStep: (by: -1 | 1) => void
  found: number
  current: number
  labels: FindBarLabels
  inputRef?: Ref<HTMLInputElement>
  className?: string
}) {
  const id = useId()
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      onStep(e.shiftKey ? -1 : 1)
    }
    if (e.key === "Escape" && value) {
      e.preventDefault()
      onChange("")
    }
  }
  const arrow =
    "grid size-8 place-items-center rounded-control text-ink-soft hover:bg-app-3 hover:text-ink disabled:opacity-40"
  return (
    <search
      className={cx(
        "flex items-center gap-2 border-line border-b bg-app-2 px-3 py-1.5 focus-within:border-brand",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-ink-dim" aria-hidden />
      <label htmlFor={id} className="sr-only">
        {labels.find}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        placeholder={labels.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        autoComplete="off"
        spellCheck={false}
        className="h-8 min-w-0 flex-1 bg-transparent font-mono text-[0.9rem] text-ink outline-none placeholder:font-sans placeholder:text-ink-dim"
      />
      {value && (
        <span aria-live="polite" className="shrink-0 font-mono text-[0.85rem] text-ink-dim tabular-nums">
          {found === 0 ? labels.none : labels.count(current + 1, found)}
        </span>
      )}
      <button
        type="button"
        aria-label={labels.previous}
        disabled={found === 0}
        onClick={() => onStep(-1)}
        className={arrow}
      >
        <ChevronUp className="size-4" aria-hidden />
      </button>
      <button type="button" aria-label={labels.next} disabled={found === 0} onClick={() => onStep(1)} className={arrow}>
        <ChevronDown className="size-4" aria-hidden />
      </button>
    </search>
  )
}

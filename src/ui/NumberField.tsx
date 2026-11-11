import { Minus, Plus } from "lucide-react"
import { type KeyboardEvent, useEffect, useState } from "react"
import { useLang, useMessages } from "@/i18n"
import { cx } from "./cx"
import { uiMessages } from "./messages"

type Props = {
  id?: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** Drawn before the number inside the field, such as "$". */
  prefix?: string
  className?: string
  "aria-label"?: string
  "aria-describedby"?: string | undefined
}

const decimalsOf = (step: number) => (String(step).split(".")[1] ?? "").length

/** "1,5" and "1.5" both read as 1.5: the owner types the decimal mark of his own language. */
export const parseTyped = (text: string): number | null => {
  const n = Number(text.trim().replace(",", "."))
  return text.trim() === "" || Number.isNaN(n) ? null : n
}

export const clampStep = (n: number, min: number, max: number, step: number) =>
  Number(Math.min(max, Math.max(min, n)).toFixed(decimalsOf(step)))

/**
 * A number with − and + beside it, in place of the browser's spinner. Typing works too: the value is read when the
 * field is left or Enter is pressed, and held between min and max. Arrow keys step, Page keys step by ten.
 */
export function NumberField({ id, value, onChange, min, max, step = 1, prefix, className, ...aria }: Props) {
  const m = useMessages(uiMessages)
  const lang = useLang()
  const shown = (n: number) => n.toLocaleString(lang, { maximumFractionDigits: decimalsOf(step), useGrouping: false })
  const [text, setText] = useState(shown(value))
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new value from outside rewrites what is typed
  useEffect(() => setText(shown(value)), [value, lang])

  const commit = (n: number) => {
    const next = clampStep(n, min, max, step)
    setText(shown(next))
    if (next !== value) onChange(next)
  }
  const read = () => commit(parseTyped(text) ?? value)
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const by = { ArrowUp: step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 }[e.key]
    if (by !== undefined) {
      e.preventDefault()
      commit((parseTyped(text) ?? value) + by)
    } else if (e.key === "Enter") read()
  }
  const button =
    "grid w-7 shrink-0 cursor-pointer place-items-center text-ink-dim transition-colors duration-(--motion-fast) hover:bg-app-3 hover:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"

  return (
    <span
      className={cx(
        "inline-flex h-8 items-stretch overflow-hidden rounded-[0.3rem] border border-line-strong bg-app text-[0.9rem]",
        "focus-within:border-brand",
        className,
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={m.decrease}
        title={m.decrease}
        disabled={value <= min}
        onClick={() => commit(value - step)}
        className={cx(button, "border-line border-r")}
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className="flex min-w-0 flex-1 items-center gap-1 px-2">
        {prefix && (
          <span className="text-ink-dim" aria-hidden>
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          role="spinbutton"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          {...aria}
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={read}
          onKeyDown={onKey}
          className="selectable inner-field w-full min-w-[2.5rem] bg-transparent text-left text-ink tabular-nums outline-none"
        />
      </span>
      <button
        type="button"
        tabIndex={-1}
        aria-label={m.increase}
        title={m.increase}
        disabled={value >= max}
        onClick={() => commit(value + step)}
        className={cx(button, "border-line border-l")}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </span>
  )
}

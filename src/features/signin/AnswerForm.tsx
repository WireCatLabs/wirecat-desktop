import { Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react"
import { type FormEvent, useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { signinMessages } from "./messages"
import type { Need } from "./store"

const FIELD =
  "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 pr-12 font-mono text-[1rem] text-ink"

const INPUT: Record<string, { mode?: "tel" | "numeric"; complete: string }> = {
  phone: { mode: "tel", complete: "tel" },
  code: { mode: "numeric", complete: "one-time-code" },
  api_id: { mode: "numeric", complete: "off" },
  password: { complete: "current-password" },
}

const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`

/** What may be sent for a typed answer: the value cleaned up, or why it cannot be right. */
export type Check = (typed: string) => { value: string; error: null } | { value: string; error: string }

type Props = {
  need: Need
  /** The answer is on its way, or the tool has not asked yet: the field waits, with `status` under it. */
  sent: boolean
  onAnswer: (value: string) => Promise<void>
  /** What this dialog was told before, for a new try after a refusal; empty for most questions. */
  initial?: string
  /** What happens to the answer, said beside the field. */
  note?: string | undefined
  /** In place of the line under the field: where the code went, for example. */
  hint?: string | undefined
  /** Said under the field while it waits, in place of "Sent". */
  status?: string | undefined
  /** The tool refused the last answer and asks again. */
  problem?: string | undefined
  check?: Check | undefined
  /** What the field keeps of each keystroke or paste: a phone number drops everything but digits and a leading +. */
  filter?: ((typed: string) => string) | undefined
  /** Said under the field while the typed value is good: the number as it will be sent, for example. */
  preview?: ((typed: string) => string | null) | undefined
}

/**
 * One answer to the tool's question. The value lives in this field only: it is cleared once sent, and a new question
 * starts with `initial`, empty unless it asks again for app keys typed in this dialog. The button sits beside the
 * field, so the line under it can change length without moving the button under the pointer (rule 9).
 */
export function AnswerForm({
  need,
  sent,
  onAnswer,
  initial = "",
  note,
  hint,
  status,
  problem,
  check,
  filter,
  preview,
}: Props) {
  const id = useId()
  const m = useMessages(signinMessages)
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const [shown, setShown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = sentence(need.prompt.replace(/\s*\(not shown\)\s*$/, ""))
  const kind = INPUT[need.field] ?? { complete: "off" }

  // biome-ignore lint/correctness/useExhaustiveDependencies: each new question starts from what was typed before, if anything, and takes focus
  useEffect(() => {
    setValue(initial)
    setShown(false)
    setError(problem ?? null)
    input.current?.focus()
  }, [need])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (sent) return
    const checked = check ? check(value) : { value, error: value.trim() ? null : m.answerEmpty }
    if (checked.error !== null) {
      setError(checked.error)
      input.current?.focus()
      return
    }
    setValue("")
    setError(null)
    try {
      await onAnswer(checked.value)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const line = error ? (
    <span role="alert" className="text-bad">
      {error}
    </span>
  ) : sent ? (
    <span className="inline-flex items-center gap-2">
      <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
      {status ?? m.sent}
    </span>
  ) : (
    (value && preview?.(value)) || (hint ?? (need.hint ? m.hint(need.hint) : m.private))
  )

  return (
    <form onSubmit={submit} className="flex w-full max-w-[32rem] flex-col gap-2 text-left">
      <label htmlFor={id} className="text-[1rem] font-medium text-ink">
        {label}
      </label>
      <div className="flex items-start gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={input}
            id={id}
            type={need.secret && !shown ? "password" : "text"}
            inputMode={kind.mode}
            autoComplete={kind.complete}
            spellCheck={false}
            value={value}
            disabled={sent}
            onChange={(e) => {
              setValue(filter ? filter(e.target.value) : e.target.value)
              setError(null)
            }}
            aria-describedby={`${id}-hint`}
            aria-invalid={error !== null}
            className={cx(FIELD, "aria-[invalid=true]:border-bad")}
          />
          {need.secret && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShown((s) => !s)}
              aria-pressed={shown}
              aria-label={m.show(label)}
              title={shown ? m.hide : m.showShort}
              className="absolute top-1 right-1"
              icon={shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            />
          )}
        </div>
        <Button type="submit" variant="primary" disabled={sent} className="h-10">
          {m.continue}
        </Button>
      </div>
      {/* Two lines kept, so a longer error or a shorter "Sent" never moves what is below. */}
      <p id={`${id}-hint`} className="min-h-[2.75em] text-[0.95rem] leading-snug text-ink-soft">
        {line}
      </p>
      {note && (
        <p className="flex items-start gap-2.5 rounded-[0.3rem] border border-line bg-app-2 px-3 py-2.5 text-[0.95rem] leading-snug text-ink">
          <ShieldCheck className="mt-[0.1rem] size-[1.1rem] shrink-0 text-ok" aria-hidden />
          <span>{note}</span>
        </p>
      )}
    </form>
  )
}

import { Eye, EyeOff } from "lucide-react"
import { type FormEvent, useEffect, useId, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { signinMessages } from "./messages"
import type { Need } from "./store"

const FIELD =
  "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 pr-10 font-mono text-[1rem] text-ink"

const INPUT: Record<string, { mode?: "tel" | "numeric"; complete: string }> = {
  phone: { mode: "tel", complete: "tel" },
  code: { mode: "numeric", complete: "one-time-code" },
  api_id: { mode: "numeric", complete: "off" },
  password: { complete: "current-password" },
}

const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`

type Props = {
  need: Need
  sent: boolean
  onAnswer: (value: string) => Promise<void>
}

/**
 * One answer to the tool's question. The value lives in this field only: it is cleared once sent, and a new question
 * starts with an empty field.
 */
export function AnswerForm({ need, sent, onAnswer }: Props) {
  const id = useId()
  const m = useMessages(signinMessages)
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const [shown, setShown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = sentence(need.prompt.replace(/\s*\(not shown\)\s*$/, ""))
  const kind = INPUT[need.field] ?? { complete: "off" }

  // biome-ignore lint/correctness/useExhaustiveDependencies: each new question starts empty and takes focus
  useEffect(() => {
    setValue("")
    setShown(false)
    setError(null)
    input.current?.focus()
  }, [need])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (sent) return
    if (!value.trim()) {
      setError(m.answerEmpty)
      input.current?.focus()
      return
    }
    const typed = value
    setValue("")
    setError(null)
    try {
      await onAnswer(typed)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-[24rem] flex-col gap-2 text-left">
      <label htmlFor={id} className="text-[0.95rem] font-medium text-ink">
        {label}
      </label>
      <div className="relative">
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
            setValue(e.target.value)
            setError(null)
          }}
          aria-describedby={`${id}-hint`}
          aria-invalid={error !== null}
          className={cx(FIELD, "aria-[invalid=true]:border-bad")}
        />
        {need.secret && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-label={m.show(label)}
            title={shown ? m.hide : m.showShort}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-[0.35rem] text-ink-dim hover:text-ink"
          >
            {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      <p id={`${id}-hint`} className="min-h-[1.3rem] text-[0.9rem] text-ink-soft">
        {error ? (
          <span role="alert" className="text-bad">
            {error}
          </span>
        ) : sent ? (
          m.sent
        ) : need.hint ? (
          m.hint(need.hint)
        ) : (
          m.private
        )}
      </p>
      <Button type="submit" variant="primary" disabled={sent} className="self-start">
        {m.continue}
      </Button>
    </form>
  )
}

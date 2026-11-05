import { LoaderCircle } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { isCorrection, oneLine } from "@/domain/memory"
import { useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { holdInPlace } from "@/ui/motion"
import { memoryMessages } from "./messages"
import { useMemory } from "./store"

/** The field grows with the text, so the correction reads like the text it replaces. */
const grow = (el: HTMLTextAreaElement) => {
  el.style.height = "auto"
  el.style.height = `${el.scrollHeight}px`
}

/** The text turns into a field where it stands; Enter saves, Escape puts the text back. */
export function InlineCorrect({ entry, onDone }: { entry: MemoryEntry; onDone: () => void }) {
  const m = useMessages(memoryMessages)
  const hint = useId()
  const [text, setText] = useState(entry.text ?? "")
  const busy = useMemory((s) => s.busy[entry.ref] === "correct")
  const failed = useMemory((s) => s.failed[entry.ref])
  const { correct } = useMemory.getState()
  const box = useRef<HTMLTextAreaElement>(null)
  const changed = isCorrection(text, entry.text)

  useEffect(() => {
    const el = box.current
    if (!el) return
    grow(el)
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const save = () => {
    if (!changed || busy) return
    const row = box.current?.closest<HTMLElement>("[data-row]")
    // The owner's version unfolds at the top of its day, above this row: keep this row where it is.
    correct(entry.ref, oneLine(text)).then((done) => done && row && holdInPlace(row))
  }

  return (
    <form
      className="flex flex-col gap-[0.45rem]"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <textarea
        ref={box}
        rows={1}
        maxLength={2000}
        value={text}
        aria-label={m.fixLabel}
        aria-describedby={hint}
        aria-invalid={!!failed || undefined}
        onChange={(e) => {
          setText(e.target.value)
          grow(e.target)
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            onDone()
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            save()
          }
        }}
        className="selectable inner-field -mx-[0.4rem] resize-none overflow-hidden rounded-[0.35rem] border border-line-strong bg-app px-[0.35rem] py-[0.2rem] text-[1rem] leading-snug font-medium text-ink focus:border-brand focus:ring-1 focus:ring-brand aria-[invalid=true]:border-bad"
      />
      <p id={hint} className="text-[0.9rem] text-ink-dim">
        {m.fixHint}
      </p>
      {failed && (
        <ErrorNotice inline>
          {m.writeFailed} {failed}
        </ErrorNotice>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          type="submit"
          disabled={!changed || busy}
          icon={busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
        >
          {m.save}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDone}>
          {m.cancel}
        </Button>
      </div>
    </form>
  )
}

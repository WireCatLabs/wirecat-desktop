import { useEffect, useId, useRef, useState } from "react"
import { isCorrection, oneLine, subjectOf } from "@/domain/memory"
import { useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { useFieldError } from "@/ui/FieldError"
import { holdInPlace } from "@/ui/motion"
import { Select } from "@/ui/Select"
import { kindOf } from "./labels"
import { memoryMessages } from "./messages"
import { explainedMessages } from "./messages-explained"
import { RowFailed } from "./RowFailed"
import { useMemory } from "./store"

/** The field grows with the text, so the correction reads like the text it replaces. */
const grow = (el: HTMLTextAreaElement) => {
  el.style.height = "auto"
  el.style.height = `${el.scrollHeight}px`
}

const MEMORY_KINDS = ["preference", "summary", "digest"]
const FACT_KINDS = ["fact", "statement", "question", "decision", "promise"]
const NOBODY = "__nobody"

/** The people, organizations and projects the page already names: who a record can be moved to. */
function useSubjects(current: string | null) {
  const entries = useMemory((s) => s.entries)
  const found = new Map<string, string>()
  for (const e of entries) {
    const s = subjectOf(e)
    if (s && (s.kind === "person" || s.kind === "organization" || s.kind === "project") && s.name)
      found.set(s.key, s.name)
  }
  if (current && !found.has(current)) found.set(current, current)
  return [...found].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
}

/** The text turns into a field where it stands; Enter saves, Escape puts the text back. Kind and subject sit below. */
export function InlineCorrect({ entry, onDone }: { entry: MemoryEntry; onDone: () => void }) {
  const m = useMessages(memoryMessages)
  const x = useMessages(explainedMessages)
  const hint = useId()
  const fieldId = useId()
  const need = useFieldError(fieldId, { preventScroll: true })
  const kindLabel = useId()
  const aboutLabel = useId()
  const [text, setTextNow] = useState(() => useMemory.getState().draft ?? entry.text ?? "")
  const [kind, setKindNow] = useState(entry.kind)
  const ownSubject = entry.project ? null : entry.subject
  const [about, setAboutNow] = useState(ownSubject ?? "")
  const subjects = useSubjects(ownSubject)
  const busy = useMemory((s) => s.busy[entry.ref] === "correct")
  const failed = useMemory((s) => s.failed[entry.ref])
  const { correct } = useMemory.getState()
  const box = useRef<HTMLTextAreaElement>(null)
  const editing =
    <T,>(apply: (v: T) => void) =>
    (v: T) => {
      need.clear()
      apply(v)
    }
  const setText = editing(setTextNow)
  const setKind = editing(setKindNow)
  const setAbout = editing(setAboutNow)
  const kinds = entry.type === "fact" ? FACT_KINDS : MEMORY_KINDS
  // The owner is a subject memo writes for itself; moving such a record to someone else is not offered here.
  const movable = !entry.subjectIsOwner && !entry.project
  const changed = isCorrection(text, entry.text) || kind !== entry.kind || (movable && about !== (ownSubject ?? ""))

  useEffect(() => {
    const el = box.current
    if (!el) return
    grow(el)
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const save = () => {
    if (busy) return
    if (!changed) return need.fail((lang) => memoryMessages[lang].nothingChanged)
    const row = box.current?.closest<HTMLElement>("[data-row]")
    // The owner's version unfolds at the top of its day, above this row: keep this row where it is.
    const change = {
      ...(kind !== entry.kind ? { kind } : {}),
      ...(movable && about !== (ownSubject ?? "") ? { subject: about } : {}),
    }
    correct(entry.ref, oneLine(text), change).then((done) => done && row && holdInPlace(row))
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
        id={fieldId}
        rows={1}
        maxLength={2000}
        value={text}
        aria-label={m.fixLabel}
        aria-describedby={cx(need.field["aria-describedby"], hint)}
        aria-invalid={!!failed || need.error !== null || undefined}
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
        className="selectable inner-field -mx-[0.4rem] resize-none overflow-hidden rounded-control border border-line-strong bg-app px-[0.35rem] py-[0.2rem] text-[1rem] leading-snug font-medium text-ink aria-[invalid=true]:border-bad"
      />
      {need.hint}
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-[11rem] flex-col gap-[0.3rem]">
          <span id={kindLabel} className="text-[0.9rem] text-ink-dim">
            {x.kind}
          </span>
          <Select<string>
            value={kind}
            onChange={setKind}
            options={(kinds.includes(entry.kind) ? kinds : [entry.kind, ...kinds]).map((k) => ({
              value: k,
              label: kindOf(k, m),
            }))}
            aria-labelledby={kindLabel}
          />
        </div>
        {movable && (
          <div className="flex min-w-[14rem] flex-col gap-[0.3rem]">
            <span id={aboutLabel} className="text-[0.9rem] text-ink-dim">
              {x.about}
            </span>
            <Select<string>
              value={about || NOBODY}
              onChange={(v) => setAbout(v === NOBODY ? "" : v)}
              options={[{ value: NOBODY, label: x.nobody }, ...subjects]}
              aria-labelledby={aboutLabel}
            />
          </div>
        )}
      </div>
      <p id={hint} className="text-[0.9rem] text-ink-dim">
        {m.fixHint}
      </p>
      {failed && <RowFailed failed={failed} />}
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy} busy={busy}>
          {m.save}
        </Button>
        <Button size="sm" disabled={busy} onClick={onDone}>
          {m.cancel}
        </Button>
      </div>
    </form>
  )
}

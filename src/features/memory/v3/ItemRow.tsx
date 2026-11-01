import { FolderKanban, LoaderCircle, Pencil, User, UserRound } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { can, type Subject, stateOf, subjectOf, toneOf } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { authorOf, kindOf, timeOf } from "../labels"
import { memoryMessages } from "../messages"
import { useMemory } from "../store"
import { v3Messages } from "./messages"

export function SubjectIcon({ subject }: { subject: Subject | null }) {
  const cls = "size-[1rem] shrink-0"
  if (subject?.kind === "project") return <FolderKanban className={cls} aria-hidden />
  if (subject?.kind === "you") return <UserRound className={cls} aria-hidden />
  return <User className={cls} aria-hidden />
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim()

/** One proposal in the inbox or on a subject page: its subject, its full text or findings, one action. */
export function ItemRow({
  entry,
  showSubject = true,
  active = false,
  onActivate,
}: {
  entry: MemoryEntry
  showSubject?: boolean
  active?: boolean
  onActivate?: () => void
}) {
  const m = useMessages(memoryMessages)
  const t = useMessages(v3Messages)
  const lang = useLang()
  const busy = useMemory((s) => s.busy[entry.ref])
  const failed = useMemory((s) => s.failed[entry.ref])
  const correcting = useMemory((s) => s.correcting === entry.ref)
  const skipped = useMemory((s) => s.skipped[entry.ref]) ?? []
  const { confirm, discard, startCorrect, skip } = useMemory.getState()
  const allowed = can(entry)
  const subject = subjectOf(entry)
  const name = subject?.kind === "you" ? t.you : (subject?.name ?? subject?.key ?? null)
  const state = stateOf(entry.status)

  return (
    <div
      data-item={entry.ref}
      tabIndex={-1}
      onFocusCapture={onActivate}
      className={cx("border-line px-[1.3rem] py-[0.9rem] not-first:border-t", active && "bg-app-2/70")}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-[0.9rem]">
        <span className="pt-[0.15rem]">
          <Lamp tone={toneOf(entry.status)} label={m.states[state]} />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-[0.5rem] text-[0.9rem] text-ink-soft">
            {showSubject && name && (
              <span className="inline-flex items-center gap-[0.35rem] font-medium text-ink">
                <SubjectIcon subject={subject} />
                {name}
              </span>
            )}
            {showSubject && name && <span aria-hidden>·</span>}
            <span>{entry.findings ? t.findingsLabel : kindOf(entry.kind, m)}</span>
            <span aria-hidden>·</span>
            <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{timeOf(entry.createdAt, lang)}</span>
          </p>
          <AutoHeight swap={correcting}>
            {correcting ? (
              <Correct entry={entry} />
            ) : entry.findings ? (
              <Findings entry={entry} skipped={skipped} onSkip={(id, off) => skip(entry.ref, id, off)} />
            ) : (
              <p className="selectable mt-[0.3rem] max-w-[75ch] text-[1rem] leading-relaxed">
                {entry.text ?? t.noContent}
                {allowed.correct && (
                  <button
                    type="button"
                    aria-label={t.correct}
                    title={t.correct}
                    onClick={() => startCorrect(entry.ref)}
                    className="ml-[0.4rem] inline-grid size-7 cursor-pointer place-items-center rounded-[0.3rem] align-middle text-ink-dim hover:bg-app-3 hover:text-ink"
                  >
                    <Pencil className="size-[0.95rem]" aria-hidden />
                  </button>
                )}
              </p>
            )}
          </AutoHeight>
          {entry.reason && <p className="mt-[0.3rem] text-[0.9rem] text-ink-soft">{entry.reason}</p>}
          {failed && (
            <ErrorNotice inline className="mt-[0.4rem]">
              {m.writeFailed} {failed}
            </ErrorNotice>
          )}
          <p className="sr-only">
            {m.writtenBy} {authorOf(entry, m)}
          </p>
        </div>
        <span className="flex flex-col items-end gap-[0.4rem]">
          {allowed.confirm ? (
            <Button
              className="min-w-[7.6rem]"
              disabled={!!busy}
              onClick={() => confirm(entry.ref)}
              icon={busy === "confirm" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
            >
              {entry.type === "action" ? t.approve : t.confirm}
            </Button>
          ) : (
            <span className="pt-[0.4rem] text-[0.9rem] text-ink-soft">{m.states[state]}</span>
          )}
          {allowed.discard && (
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => discard(entry.ref)}>
              {t.discard}
            </Button>
          )}
        </span>
      </div>
    </div>
  )
}

function Findings({
  entry,
  skipped,
  onSkip,
}: {
  entry: MemoryEntry
  skipped: string[]
  onSkip: (id: string, off: boolean) => void
}) {
  const t = useMessages(v3Messages)
  const findings = entry.findings ?? []
  const open = entry.status === "proposed"
  const ticked = findings.filter((f) => !skipped.includes(f.id)).length
  return (
    <div className="mt-[0.5rem] flex flex-col gap-[0.5rem]">
      <ul className="flex flex-col gap-[0.45rem]">
        {findings.map((f) => (
          <li key={f.id} className="flex gap-[0.6rem]">
            {open ? (
              <input
                type="checkbox"
                aria-label={f.text}
                checked={!skipped.includes(f.id)}
                onChange={(e) => onSkip(f.id, !e.target.checked)}
                className="mt-[0.3rem] size-[1rem] shrink-0 cursor-pointer accent-brand"
              />
            ) : (
              <span className="mt-[0.35rem]">
                <Lamp tone={f.outcome === "accepted" ? "ok" : "idle"} size="sm" />
              </span>
            )}
            <span className="min-w-0">
              <span className="selectable text-[0.95rem]">
                <span className="mr-[0.4rem] text-[0.9rem] font-medium text-ink-dim">
                  {f.kind === "task" ? t.task : t.fact}
                </span>
                {f.text}
              </span>
              {f.reason && <span className="block text-[0.9rem] text-ink-soft">{f.reason}</span>}
            </span>
          </li>
        ))}
      </ul>
      {open && (
        <p className="text-[0.9rem] text-ink-dim">
          {t.creates(ticked, findings.length, entry.projectName ?? entry.project ?? "")}
        </p>
      )}
    </div>
  )
}

function Correct({ entry }: { entry: MemoryEntry }) {
  const t = useMessages(v3Messages)
  const id = useId()
  const [text, setText] = useState(entry.text ?? "")
  const busy = useMemory((s) => s.busy[entry.ref] === "correct")
  const { correct, startCorrect } = useMemory.getState()
  const box = useRef<HTMLTextAreaElement>(null)
  const changed = oneLine(text) !== "" && oneLine(text) !== oneLine(entry.text ?? "")

  useEffect(() => {
    box.current?.focus({ preventScroll: true })
  }, [])

  return (
    <form
      className="step-in mt-[0.4rem] flex flex-col gap-[0.4rem]"
      onSubmit={(e) => {
        e.preventDefault()
        if (changed) correct(entry.ref, oneLine(text))
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t.fixLabel}
      </label>
      <textarea
        ref={box}
        id={id}
        rows={3}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Escape") {
            e.preventDefault()
            startCorrect(null)
          }
        }}
        style={{ outline: "none" }}
        className="selectable rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] py-[0.5rem] text-[0.95rem] text-ink focus:border-brand"
      />
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={!changed || busy}>
          {t.save}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => startCorrect(null)}>
          {t.cancel}
        </Button>
      </div>
    </form>
  )
}

import {
  Brain,
  FileText,
  ListChecks,
  LoaderCircle,
  Mail,
  MessageSquareQuote,
  MessagesSquare,
  Pencil,
  Trash2,
  Video,
} from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { byOwner, can, stateOf, toneOf } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import type { MemoryEntry, MemorySource } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { holdInPlace } from "@/ui/motion"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { TextButton } from "@/ui/TextButton"
import { aboutOf, authorOf, kindOf, savedAt, timeOf } from "./labels"
import { memoryMessages } from "./messages"
import { useMemory } from "./store"

type M = typeof memoryMessages.en

const ICONS = { memory: Brain, fact: MessageSquareQuote, action: ListChecks }

export function Row({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const open = useMemory((s) => s.open === entry.ref)
  const busy = useMemory((s) => s.busy[entry.ref])
  const failed = useMemory((s) => s.failed[entry.ref])
  const toggle = useMemory((s) => s.toggle)
  const confirm = useMemory((s) => s.confirm)
  const panel = useId()
  const row = useRef<HTMLDivElement>(null)
  const state = stateOf(entry.status)
  const Icon = ICONS[entry.type]
  const about = aboutOf(entry, m)
  const owner = byOwner(entry)

  return (
    <div ref={row} className="border-line border-t">
      <div className="grid min-h-[4.5rem] grid-cols-[auto_auto_minmax(0,1fr)_auto_7.6rem] items-center gap-[0.9rem] px-[1.3rem] py-[0.8rem] xl:gap-[1.2rem]">
        <Lamp tone={toneOf(entry.status)} label={m.states[state]} />
        <Icon className="size-[1.6rem] text-ink-soft" strokeWidth={1.6} aria-label={m.record[entry.type]} />
        <TextButton
          as="div"
          onClick={() => {
            if (row.current) holdInPlace(row.current)
            toggle(entry.ref)
          }}
          aria-expanded={open}
          aria-controls={panel}
          className="group min-w-0 cursor-pointer text-left"
        >
          <span className="line-clamp-2 text-[1rem] font-medium leading-snug group-hover:text-brand">
            {entry.text ?? kindOf(entry.kind, m)}
          </span>
          <span className="mt-[0.2rem] flex flex-wrap items-center gap-x-[0.5rem] text-[0.9rem] text-ink-soft">
            <span>{kindOf(entry.kind, m)}</span>
            {about && (
              <>
                <span aria-hidden>·</span>
                <span>{m.aboutWho(about)}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>
              {m.byPrefix} <span className={cx(!owner && "font-mono text-[0.85rem]")}>{authorOf(entry, m)}</span>
            </span>
            {entry.scope === "personal" && <Pill>{m.personal}</Pill>}
          </span>
        </TextButton>
        <span className="font-mono text-[0.95rem] tabular-nums text-ink-soft">{timeOf(entry.createdAt, lang)}</span>
        <span className="flex justify-end">
          {can(entry).confirm ? (
            <Button
              className="min-w-[7.6rem]"
              disabled={!!busy}
              onClick={() => confirm(entry.ref)}
              icon={busy === "confirm" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
            >
              {entry.type === "action" ? m.approve : m.confirm}
            </Button>
          ) : (
            <span className={cx("text-[0.9rem]", toneOf(entry.status) === "ok" ? "text-ink" : "text-ink-dim")}>
              {m.states[state]}
            </span>
          )}
        </span>
      </div>
      {failed && !open && (
        <ErrorNotice inline className="-mt-[0.4rem] pr-[1.3rem] pb-[0.8rem] pl-[6.1rem] xl:pl-[6.7rem]">
          {m.writeFailed} {failed}
        </ErrorNotice>
      )}
      <Collapse open={open} id={panel}>
        <Details entry={entry} />
      </Collapse>
    </div>
  )
}

const sourceIcon = (s: MemorySource) => {
  const cls = "size-[1.1rem]"
  if (s.kind === "meeting") return <Video className={cls} aria-hidden />
  if (s.kind === "mail") return <Mail className={cls} aria-hidden />
  if (s.kind === "message") return <MessagesSquare className={cls} aria-hidden />
  return <FileText className={cls} aria-hidden />
}

function Sources({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const sources = useMemory((s) => s.sources[entry.ref])
  if (!sources || sources.state === "loading")
    return (
      <div className="flex flex-col gap-[0.6rem]">
        <Skeleton className="h-[1rem] w-[14rem]" />
        <Skeleton className="h-[4.2rem] w-full rounded-[0.45rem]" />
      </div>
    )
  if (sources.state === "failed")
    return (
      <ErrorNotice inline>
        {m.sourcesFailed} {sources.error}
      </ErrorNotice>
    )
  return (
    <div className="reveal flex min-w-0 flex-col gap-[0.6rem]">
      <h3 className="text-[0.9rem] font-medium text-ink-dim">{m.restsOn(sources.sources.length)}</h3>
      {sources.sources.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">{m.noSources}</p>
      ) : (
        <ul className="flex flex-col rounded-[0.45rem] border border-line bg-app">
          {sources.sources.map((s) => (
            <li
              key={s.ref ?? `${s.kind}|${s.title ?? ""}|${s.at ?? ""}`}
              className="flex gap-[0.8rem] border-line px-[0.9rem] py-[0.7rem] not-first:border-t"
            >
              <span className="mt-[0.15rem] text-ink-soft">{sourceIcon(s)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="selectable text-[0.9rem] font-medium">
                    {s.sender ?? s.title ?? s.ref ?? s.kind}
                    {s.sender && s.title && <span className="font-normal text-ink-soft"> · {s.title}</span>}
                  </span>
                  {s.at && (
                    <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{savedAt(s.at, lang)}</span>
                  )}
                </span>
                {s.missing ? (
                  <span className="mt-[0.1rem] block text-[0.9rem] text-ink-dim">{m.deletedSince}</span>
                ) : (
                  s.excerpt && (
                    <span className="selectable mt-[0.1rem] block text-[0.95rem] text-ink-soft">“{s.excerpt}”</span>
                  )
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActionFacts({ entry, m }: { entry: MemoryEntry; m: M }) {
  return (
    <div className="flex min-w-0 flex-col gap-[0.6rem]">
      {entry.reason && (
        <>
          <h3 className="text-[0.9rem] font-medium text-ink-dim">{m.why}</h3>
          <p className="selectable text-[0.95rem] text-ink-soft">{entry.reason}</p>
        </>
      )}
      {entry.text && (
        <p className="selectable rounded-[0.45rem] border border-line bg-app px-[0.9rem] py-[0.7rem] text-[0.95rem]">
          “{entry.text}”
        </p>
      )}
    </div>
  )
}

function stateLine(entry: MemoryEntry, m: M) {
  if (entry.status === "proposed") return entry.type === "action" ? m.stateReviewAction : m.stateReview
  if (entry.type === "action" && entry.status === "approved") return m.stateApproved
  return m.states[stateOf(entry.status)]
}

function Details({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const correcting = useMemory((s) => s.correcting === entry.ref)
  const busy = useMemory((s) => s.busy[entry.ref])
  const failed = useMemory((s) => s.failed[entry.ref])
  const { discard, startCorrect, askForget } = useMemory.getState()
  const allowed = can(entry)
  const owner = byOwner(entry)

  return (
    <div className="grid gap-[1.6rem] border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {entry.type === "action" ? <ActionFacts entry={entry} m={m} /> : <Sources entry={entry} />}

      <div className="flex min-w-0 flex-col gap-[1.1rem]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-[0.45rem] text-[0.95rem]">
          <dt className="text-ink-dim">{m.writtenBy}</dt>
          <dd>
            {owner ? (
              m.you
            ) : (
              <>
                <span className="font-mono text-[0.9rem]">{authorOf(entry, m)}</span>{" "}
                <span className="text-ink-soft">({m.agentNote})</span>
              </>
            )}
          </dd>
          <dt className="text-ink-dim">{m.saved}</dt>
          <dd className="font-mono text-[0.9rem] tabular-nums">{savedAt(entry.createdAt, lang)}</dd>
          <dt className="text-ink-dim">{m.kind}</dt>
          <dd>
            {kindOf(entry.kind, m)}
            {entry.scope && `, ${m.scopes[entry.scope] ?? entry.scope}`}
          </dd>
          {entry.account && (
            <>
              <dt className="text-ink-dim">{m.wouldAct}</dt>
              <dd className="selectable font-mono text-[0.9rem]">{entry.account}</dd>
            </>
          )}
          {entry.supersedes && (
            <>
              <dt className="text-ink-dim">{m.corrects}</dt>
              <dd className="selectable font-mono text-[0.9rem]">{entry.supersedes}</dd>
            </>
          )}
          <dt className="text-ink-dim">{m.state}</dt>
          <dd className="flex items-start gap-2">
            <Lamp tone={toneOf(entry.status)} size="sm" />
            <span className="-mt-[0.2rem]">{stateLine(entry, m)}</span>
          </dd>
        </dl>

        {correcting ? (
          <CorrectForm entry={entry} />
        ) : (
          (allowed.correct || allowed.discard || allowed.forget) && (
            <div className="flex flex-wrap gap-2">
              {allowed.correct && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => startCorrect(entry.ref)}
                  icon={<Pencil className="size-4" aria-hidden />}
                >
                  {m.correct}
                </Button>
              )}
              {allowed.discard && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => discard(entry.ref)}
                  icon={busy === "discard" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
                >
                  {m.discard}
                </Button>
              )}
              {allowed.forget && (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!!busy}
                  onClick={() => askForget(entry.ref)}
                  icon={
                    busy === "forget" ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )
                  }
                >
                  {m.forget}
                </Button>
              )}
            </div>
          )
        )}
        {failed && !correcting && (
          <ErrorNotice inline>
            {m.writeFailed} {failed}
          </ErrorNotice>
        )}
      </div>
    </div>
  )
}

/** Line breaks become spaces: memo keeps a memory as one or two sentences, and Rust refuses control characters. */
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim()

function CorrectForm({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const id = useId()
  const hint = useId()
  const [text, setText] = useState(entry.text ?? "")
  const busy = useMemory((s) => s.busy[entry.ref] === "correct")
  const failed = useMemory((s) => s.failed[entry.ref])
  const { correct, startCorrect } = useMemory.getState()
  const box = useRef<HTMLTextAreaElement>(null)
  const changed = oneLine(text) !== "" && oneLine(text) !== oneLine(entry.text ?? "")

  useEffect(() => {
    const el = box.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  return (
    <form
      className="step-in flex flex-col gap-[0.5rem]"
      onSubmit={(e) => {
        e.preventDefault()
        if (changed) correct(entry.ref, oneLine(text))
      }}
    >
      <label htmlFor={id} className="text-[0.9rem] font-medium text-ink-dim">
        {m.fixLabel}
      </label>
      <textarea
        ref={box}
        id={id}
        rows={3}
        maxLength={2000}
        value={text}
        aria-describedby={hint}
        aria-invalid={!!failed || undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            startCorrect(null)
          }
        }}
        className="selectable rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] py-[0.5rem] text-[0.95rem] text-ink outline-none focus:border-brand aria-[invalid=true]:border-bad"
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
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => startCorrect(null)}>
          {m.cancel}
        </Button>
      </div>
    </form>
  )
}

import {
  Brain,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderKanban,
  ListChecks,
  LoaderCircle,
  Mail,
  MessageSquareQuote,
  MessagesSquare,
  Pencil,
  User,
  UserRound,
  Video,
} from "lucide-react"
import {
  type MouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { byOwner, can, dayKey, type Subject, stateOf, subjectOf, toneOf } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { MemoryEntry, MemorySource } from "@/platform/memory-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace, holdInPlace } from "@/ui/motion"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { SplitButton } from "@/ui/SplitButton"
import { TextButton } from "@/ui/TextButton"
import { aboutOf, authorOf, dayLabel, kindOf, savedAt, timeOf } from "./labels"
import { memoryMessages } from "./messages"
import { useMemory } from "./store"

type M = typeof memoryMessages.en

const ICONS = { memory: Brain, fact: MessageSquareQuote, action: ListChecks }
const SUBJECT_ICONS = { project: FolderKanban, person: User, you: UserRound, other: User }

/** What the row's text says: the record's own text, or for a findings batch how many facts and tasks it holds. */
export function textOf(e: MemoryEntry, m: M) {
  if (e.findings) {
    if (e.status !== "proposed") {
      const created = e.findings.filter((f) => f.outcome === "accepted").length
      return m.findingsReviewed(created, e.findings.length - created)
    }
    const facts = e.findings.filter((f) => f.kind === "fact").length
    return m.findingsTitle(facts, e.findings.length - facts)
  }
  return e.text ?? kindOf(e.kind, m)
}

export function SubjectLabel({ subject, className }: { subject: Subject; className?: string }) {
  const m = useMessages(memoryMessages)
  const Icon = SUBJECT_ICONS[subject.kind]
  return (
    <span className={cx("inline-flex min-w-0 items-center gap-[0.35rem] font-medium text-ink", className)}>
      <Icon className="size-[0.95rem] shrink-0 text-ink-soft" strokeWidth={1.8} aria-hidden />
      {subject.kind === "you" ? (
        m.you
      ) : subject.name ? (
        <span className="truncate">{subject.name}</span>
      ) : (
        <span className="truncate font-mono text-[0.85rem]">{subject.key}</span>
      )}
    </span>
  )
}

/**
 * One record under its subject's heading. Collapsed: its kind, when, one line of text and its actions. Opened: the
 * text whole, the place to correct it, its sources or findings, and everything Memo says about it.
 */
export function Row({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const open = useMemory((s) => s.open === entry.ref)
  const editing = useMemory((s) => s.correcting === entry.ref)
  const busy = useMemory((s) => s.busy[entry.ref])
  const failed = useMemory((s) => s.failed[entry.ref])
  const skipped = useMemory((s) => s.skipped[entry.ref])
  const { toggle, confirm, discard, startCorrect, askForget } = useMemory.getState()
  const panel = useId()
  const row = useRef<HTMLDivElement>(null)
  const state = stateOf(entry.status)
  const Icon = ICONS[entry.type]
  const allowed = can(entry)
  const editable = open && allowed.correct
  const nothingTicked = !!entry.findings && (skipped?.length ?? 0) >= entry.findings.length

  const flip = () => {
    if (row.current) holdInPlace(row.current)
    toggle(entry.ref)
  }
  // Opened, a click on the text corrects it; a drag over it only selects (TextButton).
  const onHead = (e: MouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>) => {
    if (editable && e.type === "click" && (e.target as Element).closest("[data-text]")) startCorrect(entry.ref)
    else flip()
  }
  const stopEditing = () => {
    startCorrect(null)
    requestAnimationFrame(() =>
      focusInPlace(row.current?.querySelector<HTMLElement>(`[aria-controls="${panel}"]`) ?? null),
    )
  }

  const label = (
    <span className="flex min-w-0 flex-wrap items-center gap-x-[0.5rem] gap-y-[0.1rem] text-[0.9rem] text-ink-soft">
      <span>{kindOf(entry.kind, m)}</span>
      <span aria-hidden>·</span>
      <span className="font-mono text-[0.85rem] tabular-nums">
        {dayLabel(entry.createdAt, m, lang)} {timeOf(entry.createdAt, lang)}
      </span>
      {entry.scope === "personal" && <Pill>{m.personal}</Pill>}
    </span>
  )

  const openAnd = (then: () => void) => {
    if (!open) flip()
    then()
  }
  const correctItem = allowed.correct && { label: m.correct, onSelect: () => openAnd(() => startCorrect(entry.ref)) }
  const rejectItem = allowed.discard && { label: m.discard, onSelect: () => discard(entry.ref) }
  const eraseItem = allowed.forget && { label: m.forget, danger: true, onSelect: () => askForget(entry.ref) }
  const someItem = !!entry.findings && allowed.confirm && { label: m.approveSome, onSelect: () => openAnd(() => {}) }
  const spin = <LoaderCircle className="size-4 animate-spin" aria-hidden />

  return (
    <div ref={row} data-row className="border-line border-t">
      <div className="grid min-h-[4.5rem] grid-cols-[auto_auto_minmax(0,1fr)_auto] items-start gap-[0.9rem] px-[1.3rem] py-[0.95rem] xl:gap-[1.2rem]">
        <span className="mt-[0.55rem]">
          <Lamp tone={toneOf(entry.status)} label={m.states[state]} />
        </span>
        <Icon
          className="mt-[0.45rem] size-[1.6rem] text-ink-soft"
          strokeWidth={1.6}
          aria-label={m.record[entry.type]}
        />
        <AutoHeight swap={`${open}${editing}`} className="min-w-0">
          {editing ? (
            <div className="flex flex-col gap-[0.35rem]">
              {label}
              <InlineCorrect entry={entry} onDone={stopEditing} />
            </div>
          ) : (
            <div className="flex min-w-0 items-start gap-[0.4rem]">
              <TextButton
                as="div"
                onClick={onHead}
                aria-expanded={open}
                aria-controls={panel}
                className="group min-w-0 flex-1 cursor-pointer rounded-[0.3rem] text-left"
              >
                <span className="flex items-center gap-[0.4rem]">
                  {label}
                  <ChevronDown
                    className={cx(
                      "size-4 shrink-0 text-ink-dim opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100",
                      open && "rotate-180 opacity-100",
                    )}
                    aria-hidden
                  />
                </span>
                <span
                  data-text
                  title={editable ? m.clickToCorrect : undefined}
                  className={cx(
                    "selectable mt-[0.25rem] text-[1rem] leading-snug font-medium",
                    open ? "block whitespace-pre-line" : "line-clamp-1 group-hover:text-brand",
                    editable &&
                      "-mx-[0.3rem] cursor-text rounded-[0.3rem] px-[0.3rem] transition-colors duration-150 hover:bg-app-3",
                  )}
                >
                  {textOf(entry, m)}
                </span>
              </TextButton>
              {editable && (
                <button
                  type="button"
                  aria-label={m.correct}
                  title={m.correct}
                  disabled={!!busy}
                  onClick={() => startCorrect(entry.ref)}
                  className="reveal mt-[1.55rem] grid size-8 shrink-0 cursor-pointer place-items-center rounded-[0.35rem] text-ink-dim transition-colors duration-150 hover:bg-app-3 hover:text-ink disabled:opacity-45"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              )}
            </div>
          )}
        </AutoHeight>
        <span className="flex min-w-[11.5rem] items-center justify-end gap-[0.4rem]">
          {allowed.confirm ? (
            <>
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() => discard(entry.ref)}
                icon={busy === "discard" ? spin : undefined}
              >
                {m.discard}
              </Button>
              <SplitButton
                disabled={!!busy}
                main={{
                  label: m.approve,
                  onClick: () => confirm(entry.ref),
                  disabled: open && nothingTicked,
                  ...(busy === "confirm" ? { icon: spin } : {}),
                }}
                items={[someItem, correctItem, eraseItem].filter((i) => !!i)}
                menuLabel={m.moreActions}
              />
            </>
          ) : (
            <>
              <span className={cx("text-[0.9rem]", toneOf(entry.status) === "ok" ? "text-ink-soft" : "text-ink-dim")}>
                {m.states[state]}
              </span>
              <SplitButton
                disabled={!!busy}
                {...(state === "inuse" && correctItem
                  ? { main: { label: m.correct, onClick: correctItem.onSelect } }
                  : {})}
                items={[state === "inuse" ? null : correctItem, rejectItem, eraseItem].filter((i) => !!i)}
                menuLabel={m.moreActions}
              />
            </>
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

/** Line breaks become spaces: memo keeps a memory as one or two sentences, and Rust refuses control characters. */
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim()

/** The field grows with the text, so the correction reads like the text it replaces. */
const grow = (el: HTMLTextAreaElement) => {
  el.style.height = "auto"
  el.style.height = `${el.scrollHeight}px`
}

/** The text turns into a field where it stands; Enter saves, Escape puts the text back. */
function InlineCorrect({ entry, onDone }: { entry: MemoryEntry; onDone: () => void }) {
  const m = useMessages(memoryMessages)
  const hint = useId()
  const [text, setText] = useState(entry.text ?? "")
  const busy = useMemory((s) => s.busy[entry.ref] === "correct")
  const failed = useMemory((s) => s.failed[entry.ref])
  const { correct } = useMemory.getState()
  const box = useRef<HTMLTextAreaElement>(null)
  const changed = oneLine(text) !== "" && oneLine(text) !== oneLine(entry.text ?? "")

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

const sourceIcon = (kind: string) => {
  const cls = "size-[1.1rem]"
  if (kind === "meeting") return <Video className={cls} aria-hidden />
  if (kind === "mail") return <Mail className={cls} aria-hidden />
  if (kind === "message" || kind === "msg") return <MessagesSquare className={cls} aria-hidden />
  return <FileText className={cls} aria-hidden />
}

/** One source; clicked, it opens what it says in place: the message among its neighbours, or the note. */
function SourceItem({ source: s }: { source: MemorySource }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const id = useId()
  const head = (
    <>
      <span className="mt-[0.15rem] text-ink-soft">{sourceIcon(s.kind)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="selectable text-[0.9rem] font-medium">
            {s.sender ?? s.title ?? s.ref ?? s.kind}
            {s.sender && s.title && <span className="font-normal text-ink-soft"> · {s.title}</span>}
          </span>
          {s.at && <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{savedAt(s.at, lang)}</span>}
        </span>
        {s.missing ? (
          <span className="mt-[0.1rem] block text-[0.9rem] text-ink-dim">{m.deletedSince}</span>
        ) : (
          s.excerpt && <span className="selectable mt-[0.1rem] block text-[0.95rem] text-ink-soft">“{s.excerpt}”</span>
        )}
      </span>
    </>
  )
  if (!s.ref || s.missing)
    return <li className="flex gap-[0.8rem] border-line px-[0.9rem] py-[0.7rem] not-first:border-t">{head}</li>
  const ref = s.ref
  return (
    <li className="border-line not-first:border-t">
      <TextButton
        as="div"
        aria-expanded={open}
        aria-controls={id}
        aria-label={m.showContext(s.sender ?? s.title ?? ref)}
        onClick={() => {
          if (!open) useMemory.getState().loadContext(ref)
          setOpen(!open)
        }}
        className="group flex cursor-pointer gap-[0.8rem] px-[0.9rem] py-[0.7rem] transition-colors duration-150 hover:bg-app-2"
      >
        {head}
        <ChevronDown
          className={cx(
            "mt-[0.2rem] size-4 shrink-0 text-ink-dim transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </TextButton>
      <Collapse open={open} id={id}>
        <SourceContextView reference={ref} />
      </Collapse>
    </li>
  )
}

/** What memo reads back for a cited ref. Each kind memo cannot read says so instead of failing. */
export function SourceContextView({ reference }: { reference: string }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const ctx = useMemory((s) => s.contexts[reference])
  const [opening, setOpening] = useState<string | null>(null)
  const box = "border-line border-t bg-app-2/70 px-[0.9rem] py-[0.75rem] text-[0.95rem]"
  if (!ctx || ctx.state === "loading")
    return (
      <div className={box}>
        <Skeleton className="h-[3rem] w-full rounded-[0.35rem]" label={m.readingContext} />
      </div>
    )
  if (ctx.state === "failed")
    return (
      <div className={box}>
        <ErrorNotice inline>
          {m.contextFailed} {ctx.error}
        </ErrorNotice>
      </div>
    )
  const c = ctx.context
  if (c.kind === "unsupported") return <p className={cx(box, "reveal text-ink-dim")}>{m.noContext(c.prefix)}</p>
  if (c.kind === "note")
    return (
      <div className={cx(box, "reveal flex flex-col gap-[0.5rem]")}>
        {c.title && <p className="font-medium">{c.title}</p>}
        <p className="selectable max-h-[16rem] overflow-y-auto whitespace-pre-line text-ink-soft">{c.text}</p>
        {c.file && (
          <span className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={opening === "busy"}
              onClick={() => {
                setOpening("busy")
                platform
                  .memoryOpenSource(reference)
                  .then(() => setOpening(null))
                  .catch((e: unknown) => setOpening(e instanceof Error ? e.message : String(e)))
              }}
              icon={<ExternalLink className="size-4" aria-hidden />}
            >
              {m.openFile}
            </Button>
            {opening && opening !== "busy" && (
              <ErrorNotice inline>
                {m.contextFailed} {opening}
              </ErrorNotice>
            )}
          </span>
        )}
      </div>
    )
  return (
    <ol className={cx(box, "reveal flex flex-col gap-[0.45rem]")}>
      {c.items.map((msg, i) => (
        <li
          key={msg.ref ?? i}
          className={cx(
            "rounded-[0.35rem] px-[0.6rem] py-[0.35rem]",
            msg.anchor ? "bg-brand-soft/60 text-ink" : "text-ink-soft",
          )}
        >
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[0.9rem]">
            <span className="font-medium text-ink">{msg.sender ?? "—"}</span>
            {msg.at && (
              <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{savedAt(msg.at, lang)}</span>
            )}
          </span>
          <span className="selectable block whitespace-pre-line">{msg.text}</span>
        </li>
      ))}
    </ol>
  )
}

function Sources({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
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
          {sources.sources.map((s: MemorySource) => (
            <SourceItem key={s.ref ?? `${s.kind}|${s.title ?? ""}|${s.at ?? ""}`} source={s} />
          ))}
        </ul>
      )}
    </div>
  )
}

function CitedRef({ reference, shown, onToggle }: { reference: string; shown: boolean; onToggle: () => void }) {
  const m = useMessages(memoryMessages)
  return (
    <button
      type="button"
      aria-expanded={shown}
      aria-label={m.showContext(reference)}
      onClick={onToggle}
      className={cx(
        "inline-flex cursor-pointer items-center gap-[0.3rem] rounded-[0.25rem] font-mono transition-colors duration-150 hover:text-brand",
        shown && "text-brand",
      )}
    >
      {sourceIcon(reference.split(":")[0] ?? "")}
      {reference}
    </button>
  )
}

/** A findings batch: each fact or task the agent proposes for the project, ticked to be created on Approve. */
export function Findings({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const skipped = useMemory((s) => s.skipped[entry.ref]) ?? []
  const busy = useMemory((s) => !!s.busy[entry.ref])
  const { skip } = useMemory.getState()
  const findings = entry.findings ?? []
  const open = entry.status === "proposed"
  // A batch may be about a person or another subject rather than a project.
  const project = entry.projectName ?? entry.subjectName ?? entry.project ?? m.project
  const ticked = findings.filter((f) => !skipped.includes(f.id)).length
  const [shownRef, setShownRef] = useState<string | null>(null)

  return (
    <div className="flex min-w-0 flex-col gap-[0.6rem]">
      <h3 className="text-[0.9rem] font-medium text-ink-dim">
        {open ? m.findingsHead(project) : m.findingsFor(project)}
      </h3>
      <ul className="flex flex-col rounded-[0.45rem] border border-line bg-app">
        {findings.map((f) => {
          const on = !skipped.includes(f.id)
          return (
            <li key={f.id} className="flex gap-[0.75rem] border-line px-[0.9rem] py-[0.75rem] not-first:border-t">
              {open ? (
                <input
                  type="checkbox"
                  checked={on}
                  disabled={busy}
                  aria-label={m.include(f.text)}
                  onChange={(e) => skip(entry.ref, f.id, !e.target.checked)}
                  className="mt-[0.25rem] size-[1.05rem] shrink-0 accent-brand"
                />
              ) : (
                <span className="mt-[0.3rem]">
                  <Lamp
                    tone={f.outcome === "accepted" ? "ok" : "idle"}
                    size="sm"
                    label={m.outcomes[f.outcome ?? ""] ?? f.outcome ?? ""}
                  />
                </span>
              )}
              <span className={cx("min-w-0 flex-1 transition-opacity duration-150", open && !on && "opacity-55")}>
                <span className="flex items-baseline gap-x-[0.5rem]">
                  <Pill tone={f.kind === "task" ? "brand" : "neutral"}>{m.findingKinds[f.kind] ?? f.kind}</Pill>
                  <span className="selectable min-w-0 text-[0.95rem] text-ink">{f.text}</span>
                </span>
                {f.reason && (
                  <span className="selectable mt-[0.15rem] block text-[0.9rem] text-ink-soft">{f.reason}</span>
                )}
                {f.evidence.length > 0 && (
                  <span className="mt-[0.3rem] flex flex-wrap items-center gap-x-[0.6rem] text-[0.85rem] text-ink-dim">
                    {!open && f.outcome && (
                      <span className="font-medium text-ink-soft">{m.outcomes[f.outcome] ?? f.outcome} ·</span>
                    )}
                    <span>{m.cites}</span>
                    {f.evidence.map((ref) => (
                      <CitedRef
                        key={ref}
                        reference={ref}
                        shown={shownRef === `${f.id} ${ref}`}
                        onToggle={() => {
                          const key = `${f.id} ${ref}`
                          if (shownRef !== key) useMemory.getState().loadContext(ref)
                          setShownRef(shownRef === key ? null : key)
                        }}
                      />
                    ))}
                  </span>
                )}
                {f.evidence.map((ref) => (
                  <Collapse key={ref} open={shownRef === `${f.id} ${ref}`}>
                    <div className="mt-[0.5rem] overflow-hidden rounded-[0.35rem] border border-line">
                      <SourceContextView reference={ref} />
                    </div>
                  </Collapse>
                ))}
              </span>
            </li>
          )
        })}
      </ul>
      {open && <p className="text-[0.9rem] text-ink-soft">{m.findingsNote(ticked, findings.length, project)}</p>}
    </div>
  )
}

function ActionFacts({ entry, m }: { entry: MemoryEntry; m: M }) {
  if (!entry.reason && !entry.text) return <p className="text-[0.95rem] text-ink-soft">{m.noContent}</p>
  return (
    <div className="flex min-w-0 flex-col gap-[0.6rem]">
      {entry.text && (
        <>
          <h3 className="text-[0.9rem] font-medium text-ink-dim">{m.wouldDo}</h3>
          <p className="selectable rounded-[0.45rem] border border-line bg-app px-[0.9rem] py-[0.7rem] text-[0.95rem]">
            {entry.text}
          </p>
        </>
      )}
      {entry.reason && (
        <>
          <h3 className="text-[0.9rem] font-medium text-ink-dim">{m.why}</h3>
          <p className="selectable text-[0.95rem] text-ink-soft">{entry.reason}</p>
        </>
      )}
    </div>
  )
}

function stateLine(entry: MemoryEntry, m: M) {
  if (entry.status === "proposed") {
    if (entry.findings) return m.stateReviewFindings
    return entry.type === "action" ? m.stateReviewAction : m.stateReview
  }
  if (entry.findings && entry.status === "approved") return m.stateReviewed
  if (entry.type === "action" && entry.status === "approved") return m.stateApproved
  return m.states[stateOf(entry.status)]
}

/** A value in the details that, clicked, narrows the page to records that share it. */
function FilterLink({ label, onClick, mono }: { label: string; onClick: () => void; mono?: boolean }) {
  const m = useMessages(memoryMessages)
  return (
    <button
      type="button"
      onClick={onClick}
      title={m.filterBy(label)}
      aria-label={m.filterBy(label)}
      className={cx(
        "cursor-pointer rounded-[0.2rem] text-left text-ink underline decoration-ink-dim/50 decoration-dotted underline-offset-[0.2em] transition-colors duration-150 hover:text-brand hover:decoration-brand",
        mono && "font-mono text-[0.9rem]",
      )}
    >
      {label}
    </button>
  )
}

function Details({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const failed = useMemory((s) => s.failed[entry.ref])
  const editing = useMemory((s) => s.correcting === entry.ref)
  const { setAbout, setProject, setKind, setBy, setRange } = useMemory.getState()
  const owner = byOwner(entry)
  const subject = subjectOf(entry)
  const projectName = entry.projectName ?? (subject?.kind === "project" ? subject.name : null)
  const person = subject && subject.kind !== "project" ? aboutOf(entry, m) : null
  const row = (dt: string, dd: ReactNode) => (
    <>
      <dt className="text-ink-dim">{dt}</dt>
      <dd className="min-w-0">{dd}</dd>
    </>
  )

  return (
    <div className="grid gap-[1.6rem] border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {entry.findings ? (
        <div className="flex min-w-0 flex-col gap-[1.2rem]">
          <Findings entry={entry} />
          <Sources entry={entry} />
        </div>
      ) : entry.type === "action" ? (
        <ActionFacts entry={entry} m={m} />
      ) : (
        <Sources entry={entry} />
      )}

      <div className="flex min-w-0 flex-col gap-[1.1rem]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-[0.45rem] text-[0.95rem]">
          {projectName && row(m.project, <FilterLink label={projectName} onClick={() => setProject(projectName)} />)}
          {person && row(m.about, <FilterLink label={person} onClick={() => setAbout(person)} />)}
          {row(m.kind, <FilterLink label={kindOf(entry.kind, m)} onClick={() => setKind(kindOf(entry.kind, m))} />)}
          {entry.scope && row(m.scope, m.scopes[entry.scope] ?? entry.scope)}
          {row(
            m.writtenBy,
            <>
              <FilterLink label={authorOf(entry, m)} mono={!owner} onClick={() => setBy(authorOf(entry, m))} />
              {!owner && <span className="text-ink-soft"> ({m.agentNote})</span>}
            </>,
          )}
          {entry.model && row(m.model, <span className="selectable font-mono text-[0.9rem]">{entry.model}</span>)}
          {entry.confidence !== null &&
            row(
              m.confidence,
              <span className="font-mono text-[0.9rem] tabular-nums">{entry.confidence.toFixed(2)}</span>,
            )}
          {row(
            m.saved,
            <FilterLink
              label={savedAt(entry.createdAt, lang)}
              mono
              onClick={() => setRange(dayKey(entry.createdAt))}
            />,
          )}
          {entry.updatedAt &&
            entry.updatedAt !== entry.createdAt &&
            row(
              m.updated,
              <span className="font-mono text-[0.9rem] tabular-nums">{savedAt(entry.updatedAt, lang)}</span>,
            )}
          {entry.type !== "action" &&
            row(m.sourcesCount, <span className="font-mono text-[0.9rem] tabular-nums">{entry.links}</span>)}
          {entry.target &&
            !entry.findings &&
            row(m.actsOn, <span className="selectable font-mono text-[0.9rem] break-all">{entry.target}</span>)}
          {entry.account &&
            row(m.wouldAct, <span className="selectable font-mono text-[0.9rem]">{entry.account}</span>)}
          {entry.supersedes &&
            row(m.corrects, <span className="selectable font-mono text-[0.9rem]">{entry.supersedes}</span>)}
          {row(
            m.state,
            <span className="flex items-start gap-2">
              <Lamp tone={toneOf(entry.status)} size="sm" />
              <span className="-mt-[0.2rem]">{stateLine(entry, m)}</span>
            </span>,
          )}
        </dl>
        {failed && !editing && (
          <ErrorNotice inline>
            {m.writeFailed} {failed}
          </ErrorNotice>
        )}
      </div>
    </div>
  )
}

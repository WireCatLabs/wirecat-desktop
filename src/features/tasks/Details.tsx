import { Bot, CalendarDays, Check, GitBranch, LoaderCircle, Lock, Save, User } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { bareTitleKind, closed, fromMessages, labelOf, STATES, type State } from "@/domain/tasks"
import { type Lang, useLang, useMessages } from "@/i18n"
import type { Creator, Person, Project, Task, TaskEdit, TaskEvent } from "@/platform/task-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { useFieldError } from "@/ui/FieldError"
import { fieldFocus } from "@/ui/field"
import { InfoTip } from "@/ui/InfoTip"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { Comments } from "./Comments"
import { AgentCell, AssigneeCell, DueCell, KindCell, PriorityCell, ProjectCell, StatusCell } from "./cells"
import { FoundSource } from "./FoundSource"
import { dueDay, stamp, type TaskWords, taskMessages } from "./messages"
import { StaleLine } from "./Note"
import { personName, StateLamp, TaskError, TaskLink, taskTitle } from "./parts"
import { moveSlot, useTasks } from "./store"

const isState = (v: unknown): v is State => typeof v === "string" && (STATES as readonly string[]).includes(v)

type Known = { people: readonly Person[]; projects: readonly Project[] }

function value(field: string, v: unknown, m: TaskWords, known: Known, lang: Lang): string | null {
  const { people, projects } = known
  if (v === null || v === undefined || v === "") return null
  if (field === "project" && typeof v === "string") return projects.find((p) => p.ref === v)?.name ?? v
  if (field === "type" && typeof v === "string") return m.kinds[v] ?? v
  if (field === "status" && isState(v)) return m.states[v]
  if (field === "priority" && typeof v === "number") return m.labels[labelOf(v) ?? "none"]
  if (field === "due_at" && (typeof v === "number" || typeof v === "string")) return dueDay(new Date(v), lang)
  if (field === "assignee" && typeof v === "string") return personName(v, people, m)
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 59)}…` : v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return null
}

/** memo's rule that finds tasks in messages signs them "rule"; the owner knows it as Memo. */
const named = (name: string | null | undefined) => (name === "rule" ? "Memo" : name)

function eventText(e: TaskEvent, m: TaskWords, known: Known, lang: Lang): string[] {
  const who = e.by?.owner ? m.you : (named(e.by?.name) ?? m.someone)
  if (e.kind === "created" || e.changes.length === 0)
    return [e.kind === "created" ? m.created(who) : `${who}: ${e.kind}`]
  return e.changes.map((c) => {
    const field = m.fields[c.field] ?? c.field
    // Notes can be long and are shown above; the history says only that they changed.
    const from = c.field === "description" ? null : value(c.field, c.from, m, known, lang)
    const to = c.field === "description" ? null : value(c.field, c.to, m, known, lang)
    if (c.field === "description") return c.to === null ? m.clearedField(who, field) : m.setField(who, field, "…")
    if (to === null) return m.clearedField(who, field)
    return from === null ? m.setField(who, field, to) : m.changedField(who, field, from, to)
  })
}

const KEY = /^[A-Z0-9]{2,4}-\d+$/

const ownTitle = (task: Task) => (bareTitleKind(task) === null ? task.title : "")

const writesDone = (key: string) =>
  new Promise<void>((done) => {
    if (!useTasks.getState().busy[key]) return done()
    const stop = useTasks.subscribe((s) => {
      if (s.busy[key]) return
      stop()
      done()
    })
  })

const isAgent = (by: TaskEvent["by"]) => Boolean(by && !by.owner && !by.ref?.startsWith("person:"))

/** "You", a person's name, or the agent's. */
const creatorName = (c: Creator, m: TaskWords) => (c.owner ? m.you : (named(c.name) ?? m.someone))

function Who({ by }: { by: TaskEvent["by"] }) {
  const m = useMessages(taskMessages)
  if (!by) return null
  const Icon = isAgent(by) ? Bot : User
  return <Icon role="img" aria-label={isAgent(by) ? m.byAgent : m.byPerson} className="size-[0.85rem] shrink-0" />
}

function Field({ label, children, tip }: { label: string; children: ReactNode; tip?: string | undefined }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-x-3 py-[0.15rem]">
      <dt className="flex items-center gap-[0.15rem] text-[0.875rem] text-ink-dim">
        {label}
        {tip && (
          <InfoTip label={label} align="end" className="-my-[0.2rem]">
            {tip}
          </InfoTip>
        )}
      </dt>
      <dd className="min-w-0 text-[0.9rem] text-ink">{children}</dd>
    </div>
  )
}

/**
 * A task in the dialog: title and notes to edit and save; status, priority, assignee, agent and due date that save
 * on change, as the table's cells do; then what it waits for, what waits for it, and who changed what.
 */
export function Details({
  task,
  onDirty,
  onSaving,
}: {
  task: Task
  onDirty?: (dirty: boolean) => void
  onSaving?: (saving: boolean) => void
}) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const id = useId()
  const people = useTasks((s) => s.people)
  const projects = useTasks((s) => s.projects)
  const all = useTasks((s) => s.tasks)
  const history = useTasks((s) => s.history[task.key])
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const failed = useTasks((s) => s.failed[task.key])
  const stale = useTasks((s) => s.stale?.key === task.key)
  // The stand-in "<kind> — <locator>" is no title to edit: the box starts empty and shows the readable name.
  const own = ownTitle(task)
  const [title, setTitle] = useState(own)
  const [notes, setNotes] = useState(task.description ?? "")
  const [writing, setWriting] = useState(!task.description)
  const box = useRef<HTMLTextAreaElement>(null)
  const noTitle = useFieldError(`${id}-title`)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const memoNotes = task.description ?? ""
  const [read, setRead] = useState({ title: own, notes: memoNotes })
  const synced = read.title === own && read.notes === memoNotes
  // A field follows memo only while it still shows memo's last words: what the owner typed is never replaced, whether
  // the answer is their own save or a stale refusal that brings someone else's text. Set during render, so no frame
  // shows an untouched form as changed. Trimmed, as memo stores them: a saved "abc  " is still memo's "abc".
  if (!synced) {
    setRead({ title: own, notes: memoNotes })
    if (title.trim() === read.title.trim()) setTitle(own)
    if (notes.trim() === read.notes.trim()) setNotes(memoNotes)
    if (!memoNotes) setWriting(true)
  }

  useEffect(() => {
    if (!useTasks.getState().history[task.key]) void useTasks.getState().loadHistory(task.key)
  }, [task.key])

  const edit: TaskEdit = {}
  if (title.trim() && title.trim() !== task.title.trim()) edit.title = title.trim()
  // An emptied box clears the notes.
  // memo trims what it stores, so spaces at the ends are no change.
  if (notes.trim() !== (task.description ?? "").trim()) edit.description = notes.trim() && notes
  const changed = Object.keys(edit).length > 0
  // A found task with no title of its own starts empty, and may stay so.
  const blank = title.trim() === "" && own !== ""
  if (synced && saved && (changed || blank || failed || stale)) setSaved(false)
  useEffect(() => onDirty?.(changed || commenting), [changed, commenting, onDirty])
  useEffect(() => () => onDirty?.(false), [onDirty])
  const reset = () => {
    noTitle.clear()
    setTitle(own)
    setNotes(task.description ?? "")
    setWriting(!task.description)
  }
  const write = () => {
    setWriting(true)
    requestAnimationFrame(() => box.current?.focus())
  }
  const save = async () => {
    if (blank) return noTitle.fail(m.titleEmpty)
    if (!changed || saving) return
    const sent = { title, notes }
    setSaving(true)
    onSaving?.(true)
    // A field saved on blur may be writing still; this save needs the revision that write answers.
    const before = useTasks.getState()
    const waited = Boolean(before.busy[task.key])
    await writesDone(task.key)
    const after = useTasks.getState()
    // That write's refusal is news to the owner: saving over it would hide it and overwrite what they have not seen.
    const refused =
      waited && (after.stale?.key === task.key || after.failed[task.key] || after.failed[moveSlot(task.key)])
    // A move may have renamed this task; another task opened meanwhile must not receive this one's text.
    const key = after.opened === before.opened ? (after.open ?? task.key) : task.key
    const ok = !refused && (await useTasks.getState().update(key, edit))
    setSaving(false)
    onSaving?.(false)
    setSaved(ok)
    const now = useTasks.getState()
    const stored = now.tasks.find((t) => t.key === key) ?? now.outside[key]
    if (!ok || !stored) return
    // memo may store something else than was typed ("none" clears the notes): the form shows what it kept.
    setTitle((t) => (t === sent.title ? ownTitle(stored) : t))
    setNotes((n) => (n === sent.notes ? (stored.description ?? "") : n))
    if (!stored.description) setWriting(true)
  }
  const idle = !changed && !blank
  const hidden = idle && !saving && !saved

  const moved = useTasks((s) => s.moved[task.key])
  const detach = useTasks((s) => s.detach[task.key])
  const made = history?.state === "ready" ? history.events.find((e) => e.kind === "created") : undefined
  const maker = task.createdBy ? creatorName(task.createdBy, m) : null
  // memo keeps one notes field, so the thread has one entry: whoever last wrote it, or else whoever made the task.
  const wrote =
    history?.state === "ready"
      ? ([...history.events].reverse().find((e) => e.changes.some((c) => c.field === "description")) ?? made)
      : undefined
  const writer = wrote?.by ? (wrote.by.owner ? m.you : (named(wrote.by.name) ?? m.someone)) : null
  const holdsUp = all.filter((t) => !closed(t.state) && t.blockedBy.some((b) => b.key === task.key))

  return (
    <div className="grid gap-x-[1.8rem] gap-y-[1.4rem] pb-[0.6rem] sm:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-[1.2rem]">
        <form
          className="flex min-w-0 flex-col gap-[0.8rem]"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="flex flex-col gap-[0.35rem]">
            <label htmlFor={`${id}-title`} className="text-[0.9rem] font-medium text-ink-dim">
              {m.titleField}
            </label>
            <input
              id={`${id}-title`}
              value={title}
              placeholder={taskTitle(task, m)}
              maxLength={500}
              {...noTitle.field}
              onChange={(e) => {
                setTitle(e.target.value)
                noTitle.clear()
              }}
              className={`selectable h-[2.4rem] rounded-control border border-line-strong bg-app px-[0.625rem] text-[0.95rem] text-ink aria-[invalid=true]:border-bad ${fieldFocus}`}
            />
            {noTitle.hint}
          </div>
          <div className="flex flex-col gap-[0.35rem]">
            <span id={`${id}-notes`} className="text-[0.9rem] font-medium text-ink-dim">
              {m.notes}
            </span>
            {writing ? (
              <textarea
                ref={box}
                aria-labelledby={`${id}-notes`}
                rows={5}
                value={notes}
                maxLength={20_000}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    e.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder={m.notesHint}
                className={`selectable reveal rounded-control border border-line-strong bg-app px-[0.625rem] py-[0.5rem] text-[0.95rem] text-ink placeholder:text-ink-dim ${fieldFocus}`}
              />
            ) : (
              <article
                aria-labelledby={`${id}-notes`}
                className="reveal rounded-inset border border-line bg-app-2 px-[0.8rem] pt-[0.5rem] pb-[0.7rem]"
              >
                <header className="flex items-center gap-[0.45rem] text-[0.85rem] text-ink-dim">
                  {wrote && <Who by={wrote.by} />}
                  {writer && <span className="font-medium text-ink-soft">{writer}</span>}
                  {wrote && <time dateTime={wrote.at}>{stamp(wrote.at, lang)}</time>}
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={write}>
                    {m.editNotes}
                  </Button>
                </header>
                <p className="selectable mt-[0.2rem] text-[0.95rem] [overflow-wrap:anywhere] whitespace-pre-wrap text-ink">
                  {task.description}
                </p>
              </article>
            )}
          </div>
          {/* The buttons appear with the first change; their line is kept, so nothing below moves. After a save the
              button stays, as the result, until the next edit. */}
          <div
            inert={hidden || undefined}
            aria-hidden={hidden || undefined}
            className={cx(
              "flex gap-2 transition-opacity duration-(--motion-fast)",
              hidden && "pointer-events-none opacity-0",
            )}
          >
            {/* Enabled while it works: a disabled button drops keyboard focus to the page (UX-67). */}
            <Button
              variant={saved ? "secondary" : "primary"}
              size="sm"
              type="submit"
              aria-busy={saving}
              icon={
                saving ? (
                  <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
                ) : saved ? (
                  <Check className="size-4 text-ok" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )
              }
            >
              <StableText
                className="justify-items-start"
                value={saving ? m.saving : saved ? m.saved : m.save}
                variants={[m.save, m.saving, m.saved]}
              />
            </Button>
            <Button
              size="sm"
              onClick={reset}
              inert={idle || saving || undefined}
              className={cx("transition-opacity duration-(--motion-fast)", (idle || saving) && "opacity-0")}
            >
              {m.cancel}
            </Button>
            <span role="status" className="sr-only">
              {saving ? m.saving : saved ? m.saved : ""}
            </span>
          </div>
          {failed && <TaskError lead={m.notSaved} raw={failed} />}
          <StaleLine taskKey={task.key} />
          {stale && changed && <p className="text-[0.875rem] text-ink-soft">{m.draftKept}</p>}
        </form>
        {fromMessages(task) && <FoundSource task={task} dirty={changed || commenting} />}
        <Comments taskKey={task.key} onDirty={setCommenting} />
        <section aria-labelledby={`${id}-waits`} className="flex flex-col gap-[0.4rem]">
          <h3 id={`${id}-waits`} className="flex items-center gap-[0.4rem] text-[0.9rem] font-medium text-ink-dim">
            <GitBranch className="size-[0.95rem]" aria-hidden /> {m.waitsHeading}
          </h3>
          {task.blockedBy.length === 0 ? (
            <p className="text-[0.95rem] text-ink-soft">{m.nothingBlocks}</p>
          ) : (
            task.blockedBy.map((b) => {
              const other = all.find((t) => t.key === b.key)
              return (
                <p key={b.key} className="flex min-w-0 items-center gap-[0.5rem] text-[0.95rem]">
                  <StateLamp state={isState(b.state) ? b.state : "open"} />
                  <TaskLink taskKey={b.key} />
                  {other && <span className="truncate text-ink-soft">{taskTitle(other, m)}</span>}
                </p>
              )
            })
          )}
        </section>
        {holdsUp.length > 0 && (
          <section aria-labelledby={`${id}-holds`} className="flex flex-col gap-[0.4rem]">
            <h3 id={`${id}-holds`} className="flex items-center gap-[0.4rem] text-[0.9rem] font-medium text-ink-dim">
              <Lock className="size-[0.95rem]" aria-hidden /> {m.holdsUp}
            </h3>
            {holdsUp.map((t) => (
              <p key={t.key} className="flex min-w-0 items-center gap-[0.5rem] text-[0.95rem]">
                <StateLamp state={t.state} />
                <TaskLink taskKey={t.key} />
                <span className="truncate text-ink-soft">{taskTitle(t, m)}</span>
              </p>
            ))}
            <p className="text-[0.8rem] text-ink-dim">{m.holdsUpHint}</p>
          </section>
        )}
        <section aria-labelledby={`${id}-history`} className="flex flex-col gap-[0.4rem]">
          <h3 id={`${id}-history`} className="flex items-center gap-[0.4rem] text-[0.9rem] font-medium text-ink-dim">
            <CalendarDays className="size-[0.95rem]" aria-hidden /> {m.history}
          </h3>
          {!history || history.state === "loading" ? (
            <div className="flex flex-col gap-[0.4rem]">
              <Skeleton className="h-[1.1rem] w-[85%]" label={m.history} />
              <Skeleton className="h-[1.1rem] w-[70%]" />
            </div>
          ) : history.state === "failed" ? (
            <TaskError
              reading
              lead={m.historyFailed}
              raw={history.message}
              action={
                <Button size="sm" onClick={() => void useTasks.getState().loadHistory(task.key)}>
                  {m.tryAgain}
                </Button>
              }
            />
          ) : history.events.length === 0 ? (
            <p className="text-[0.9rem] text-ink-soft">{m.historyEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-[0.25rem] text-[0.9rem]">
              {[...history.events].reverse().flatMap((e, i) =>
                eventText(e, m, { people, projects }, lang).map((line, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: events have no id, and the list is replaced whole
                  <li key={`${e.at}-${i}-${j}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
                    <span className="font-mono whitespace-nowrap tabular-nums text-ink-dim">{stamp(e.at, lang)}</span>
                    <span className="selectable flex min-w-0 items-baseline gap-[0.4rem] text-ink-soft">
                      <span className="self-center text-ink-dim">
                        <Who by={e.by} />
                      </span>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{line}</span>
                    </span>
                  </li>
                )),
              )}
            </ul>
          )}
        </section>
      </div>
      <aside
        aria-labelledby={`${id}-props`}
        className="flex min-w-0 flex-col gap-[0.9rem] sm:border-line sm:border-l sm:pl-[1.4rem]"
      >
        <h3 id={`${id}-props`} className="sr-only">
          {m.properties}
        </h3>
        <dl className="flex flex-col">
          <Field label={m.status}>
            <StatusCell task={task} />
          </Field>
          <Field label={m.priority}>
            <PriorityCell task={task} />
          </Field>
          <Field label={m.kind}>
            <KindCell task={task} />
          </Field>
          <Field label={m.assignee}>
            <AssigneeCell task={task} />
          </Field>
          <Field label={m.agentField} tip={m.agentTip}>
            <AgentCell task={task} />
          </Field>
          <Field label={m.due}>
            <DueCell task={task} />
          </Field>
          <Field label={m.project} tip={m.projectHint}>
            <ProjectCell task={task} />
            <Collapse open={Boolean(moved)}>
              <div role="status" className="mt-[0.3rem] flex flex-col gap-[0.25rem] text-[0.85rem] leading-snug">
                <span className="text-ink-soft">{m.movedWith(moved?.length ?? 0)}</span>
                {moved?.map((x) => (
                  <span key={x.to} className="flex min-w-0 items-center gap-[0.4rem]">
                    <span className="font-mono text-ink-dim line-through">{x.from}</span>
                    <TaskLink taskKey={x.to} />
                    <span className="truncate text-ink-soft">
                      {(() => {
                        const t = all.find((y) => y.key === x.to)
                        return t ? taskTitle(t, m) : null
                      })()}
                    </span>
                  </span>
                ))}
              </div>
            </Collapse>
            <Collapse open={Boolean(detach)}>
              {detach && (
                <div
                  role="alert"
                  className="mt-[0.3rem] flex flex-col items-start gap-[0.35rem] text-[0.85rem] leading-snug"
                >
                  <span className="flex flex-wrap items-center gap-x-[0.35rem]">
                    {m.partOf} <TaskLink taskKey={detach.parent} />
                  </span>
                  <Button
                    size="sm"
                    aria-busy={busy}
                    onClick={() => {
                      if (!busy) void useTasks.getState().update(task.key, { project: detach.project, detach: true })
                    }}
                  >
                    {m.moveAlone(detach.parent, detach.project)}
                  </Button>
                </div>
              )}
            </Collapse>
          </Field>
        </dl>
        <dl className="flex flex-col border-line border-t pt-[0.7rem] text-ink-soft">
          <Field label={m.key}>
            <span className="selectable font-mono text-[0.85rem]">{task.key}</span>
          </Field>
          {task.parent && (
            <Field label={m.parent}>
              {KEY.test(task.parent) ? (
                <TaskLink taskKey={task.parent} />
              ) : (
                <span className="font-mono text-[0.85rem]">{task.parent}</span>
              )}
            </Field>
          )}
          <Field label={m.createdAt}>
            {maker ? m.createdBy(stamp(task.createdAt, lang), maker) : stamp(task.createdAt, lang)}
          </Field>
          {task.updatedAt && <Field label={m.updatedAt}>{stamp(task.updatedAt, lang)}</Field>}
          {task.closedAt && <Field label={m.closedAt}>{stamp(task.closedAt, lang)}</Field>}
          <Field label={m.revision}>
            <span title={m.revisionHint} className="font-mono text-[0.85rem] tabular-nums">
              {task.revision}
            </span>
          </Field>
        </dl>
      </aside>
    </div>
  )
}

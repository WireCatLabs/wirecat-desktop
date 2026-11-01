import { Bot, CalendarDays, GitBranch, Lock, User } from "lucide-react"
import { type ReactNode, useEffect, useId, useState } from "react"
import { closed, labelOf, STATES, type State } from "@/domain/tasks"
import { type Lang, useLang, useMessages } from "@/i18n"
import type { Person, Task, TaskEdit, TaskEvent } from "@/platform/task-schemas"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { AssigneeCell, DueCell, PriorityCell, StatusCell } from "./cells"
import { dueDay, stamp, type TaskWords, taskMessages } from "./messages"
import { StaleLine } from "./Note"
import { personName, StateLamp, TaskLink } from "./parts"
import { useTasks } from "./store"

const isState = (v: unknown): v is State => typeof v === "string" && (STATES as readonly string[]).includes(v)

function value(field: string, v: unknown, m: TaskWords, people: readonly Person[], lang: Lang): string | null {
  if (v === null || v === undefined || v === "") return null
  if (field === "status" && isState(v)) return m.states[v]
  if (field === "priority" && typeof v === "number") return m.labels[labelOf(v) ?? "none"]
  if (field === "due_at" && (typeof v === "number" || typeof v === "string")) return dueDay(new Date(v), lang)
  if (field === "assignee" && typeof v === "string") return personName(v, people, m)
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 59)}…` : v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return null
}

export function eventText(e: TaskEvent, m: TaskWords, people: readonly Person[], lang: Lang): string[] {
  const who = e.by?.owner ? m.you : (e.by?.name ?? m.someone)
  if (e.kind === "created" || e.changes.length === 0)
    return [e.kind === "created" ? m.created(who) : `${who}: ${e.kind}`]
  return e.changes.map((c) => {
    const field = m.fields[c.field] ?? c.field
    // Notes can be long and are shown above; the history says only that they changed.
    const from = c.field === "description" ? null : value(c.field, c.from, m, people, lang)
    const to = c.field === "description" ? null : value(c.field, c.to, m, people, lang)
    if (c.field === "description") return m.setField(who, field, "…")
    if (to === null) return m.clearedField(who, field)
    return from === null ? m.setField(who, field, to) : m.changedField(who, field, from, to)
  })
}

const KEY = /^[A-Z0-9]{2,4}-\d+$/

const isAgent = (by: TaskEvent["by"]) => Boolean(by && !by.owner && !by.ref?.startsWith("person:"))

function Who({ by }: { by: TaskEvent["by"] }) {
  const m = useMessages(taskMessages)
  if (!by) return null
  const Icon = isAgent(by) ? Bot : User
  return <Icon role="img" aria-label={isAgent(by) ? m.byAgent : m.byPerson} className="size-[0.85rem] shrink-0" />
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-x-3 py-[0.15rem]">
      <dt className="text-[0.875rem] text-ink-dim">{label}</dt>
      <dd className="min-w-0 text-[0.9rem] text-ink">
        {children}
        {hint && <span className="block text-[0.8rem] leading-snug text-ink-dim">{hint}</span>}
      </dd>
    </div>
  )
}

/**
 * A task in the dialog: title, notes and agent to edit and save; status, priority, assignee and due date that save
 * on change, as the table's cells do; then what it waits for, what waits for it, and who changed what.
 */
export function Details({ task, onDirty }: { task: Task; onDirty?: (dirty: boolean) => void }) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const id = useId()
  const people = useTasks((s) => s.people)
  const projects = useTasks((s) => s.projects)
  const all = useTasks((s) => s.tasks)
  const history = useTasks((s) => s.history[task.key])
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const failed = useTasks((s) => s.failed[task.key])
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.description ?? "")
  const [agent, setAgent] = useState(task.agent ?? "")
  // A write from elsewhere (a stale refusal shows the current task) resets the fields to what the task now says.
  useEffect(() => {
    setTitle(task.title)
    setNotes(task.description ?? "")
    setAgent(task.agent ?? "")
  }, [task.title, task.description, task.agent])

  useEffect(() => {
    if (!useTasks.getState().history[task.key]) void useTasks.getState().loadHistory(task.key)
  }, [task.key])

  const edit: TaskEdit = {}
  if (title.trim() && title.trim() !== task.title) edit.title = title.trim()
  // memo cannot empty the notes, so an emptied box is not a change it could save.
  if (notes.trim() && notes !== (task.description ?? "")) edit.description = notes
  if (agent.trim() !== (task.agent ?? "")) edit.agent = agent.trim() || "none"
  const changed = Object.keys(edit).length > 0
  useEffect(() => onDirty?.(changed), [changed, onDirty])
  const reset = () => {
    setTitle(task.title)
    setNotes(task.description ?? "")
    setAgent(task.agent ?? "")
  }

  const project = task.project.replace(/^project:/, "")
  const projectName = projects.find((p) => p.key === project)?.name
  const made = history?.state === "ready" ? history.events.find((e) => e.kind === "created") : undefined
  const maker = made?.by ? (made.by.owner ? m.you : (made.by.name ?? m.someone)) : null
  const holdsUp = all.filter((t) => !closed(t.state) && t.blockedBy.some((b) => b.key === task.key))

  return (
    <div className="grid gap-x-[1.8rem] gap-y-[1.4rem] pb-[0.6rem] sm:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-[1.2rem]">
        <form
          className="flex min-w-0 flex-col gap-[0.8rem]"
          onSubmit={(e) => {
            e.preventDefault()
            if (changed) void useTasks.getState().update(task.key, edit)
          }}
        >
          <label className="flex flex-col gap-[0.35rem]">
            <span className="text-[0.9rem] font-medium text-ink-dim">{m.titleField}</span>
            <input
              value={title}
              maxLength={500}
              onChange={(e) => setTitle(e.target.value)}
              className="selectable h-[2.4rem] rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] text-[0.95rem] text-ink outline-none focus-visible:border-brand"
            />
          </label>
          <label className="flex flex-col gap-[0.35rem]">
            <span className="text-[0.9rem] font-medium text-ink-dim">{m.notes}</span>
            <textarea
              rows={5}
              value={notes}
              maxLength={20_000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={m.notesHint}
              className="selectable rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] py-[0.5rem] text-[0.95rem] text-ink outline-none placeholder:text-ink-dim focus-visible:border-brand"
            />
          </label>
          <label className="flex flex-col gap-[0.35rem]">
            <span className="text-[0.9rem] font-medium text-ink-dim">{m.agent}</span>
            <input
              value={agent}
              maxLength={64}
              spellCheck={false}
              onChange={(e) => setAgent(e.target.value.replace(/[^\w.-]/g, ""))}
              placeholder={m.agentHint}
              className="selectable h-[2.4rem] max-w-[20rem] rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] font-mono text-[0.9rem] text-ink outline-none placeholder:font-sans placeholder:text-ink-dim focus-visible:border-brand"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" type="submit" disabled={!changed || busy}>
              {busy ? m.saving : m.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset} disabled={!changed || busy}>
              {m.cancel}
            </Button>
          </div>
          {failed && <ErrorNotice inline>{m.notSaved(failed)}</ErrorNotice>}
          <StaleLine taskKey={task.key} />
        </form>
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
                  {other && <span className="truncate text-ink-soft">{other.title}</span>}
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
                <span className="truncate text-ink-soft">{t.title}</span>
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
            <p className="text-[0.9rem] text-bad">{m.historyFailed}</p>
          ) : history.events.length === 0 ? (
            <p className="text-[0.9rem] text-ink-soft">{m.historyEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-[0.25rem] text-[0.9rem]">
              {[...history.events].reverse().flatMap((e, i) =>
                eventText(e, m, people, lang).map((line, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: events have no id, and the list is replaced whole
                  <li key={`${e.at}-${i}-${j}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
                    <span className="font-mono whitespace-nowrap tabular-nums text-ink-dim">{stamp(e.at, lang)}</span>
                    <span className="selectable flex min-w-0 items-baseline gap-[0.4rem] text-ink-soft">
                      <span className="self-center text-ink-dim">
                        <Who by={e.by} />
                      </span>
                      <span className="min-w-0">{line}</span>
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
          <Field label={m.assignee}>
            <AssigneeCell task={task} />
          </Field>
          <Field label={m.due}>
            <DueCell task={task} />
          </Field>
          <Field label={m.project} hint={m.projectFixed}>
            <span className="block truncate py-[0.3rem]">
              <span className="font-mono text-[0.85rem]">{project}</span>
              {projectName && <span className="text-ink-soft"> · {projectName}</span>}
            </span>
          </Field>
        </dl>
        <dl className="flex flex-col border-line border-t pt-[0.7rem] text-ink-soft">
          <Field label={m.key}>
            <span className="selectable font-mono text-[0.85rem]">{task.key}</span>
          </Field>
          {task.kind && <Field label={m.kind}>{m.kinds[task.kind] ?? task.kind}</Field>}
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

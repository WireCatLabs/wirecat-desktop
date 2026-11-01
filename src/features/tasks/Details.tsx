import { CalendarDays, GitBranch } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { labelOf, STATES, type State } from "@/domain/tasks"
import { type Lang, useLang, useMessages } from "@/i18n"
import type { Person, Task, TaskEdit, TaskEvent } from "@/platform/task-schemas"
import { Button } from "@/ui/Button"
import { Skeleton } from "@/ui/Skeleton"
import { dueDay, stamp, type TaskWords, taskMessages } from "./messages"
import { personName, StateLamp } from "./parts"
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

/** A task opened in place: its title, notes and agent to edit, what it waits for, and who changed what. */
export function Details({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const id = useId()
  const people = useTasks((s) => s.people)
  const all = useTasks((s) => s.tasks)
  const history = useTasks((s) => s.history[task.key])
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
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
  if (notes !== (task.description ?? "")) edit.description = notes
  if (agent.trim() !== (task.agent ?? "")) edit.agent = agent.trim() || "none"
  const changed = Object.keys(edit).length > 0
  const reset = () => {
    setTitle(task.title)
    setNotes(task.description ?? "")
    setAgent(task.agent ?? "")
  }

  return (
    <div className="grid gap-[1.6rem] border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
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
            rows={4}
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
          <Button size="sm" type="submit" disabled={!changed || busy}>
            {busy ? m.saving : m.save}
          </Button>
          <Button size="sm" variant="ghost" onClick={reset} disabled={!changed || busy}>
            {m.cancel}
          </Button>
        </div>
      </form>
      <div className="flex min-w-0 flex-col gap-[1.1rem]">
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
                  <span className="font-mono text-[0.9rem]">{b.key}</span>
                  {other && <span className="truncate text-ink-soft">{other.title}</span>}
                </p>
              )
            })
          )}
        </section>
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
                  <li key={`${e.at}-${i}-${j}`} className="grid grid-cols-[7.4rem_minmax(0,1fr)] gap-x-3">
                    <span className="font-mono tabular-nums text-ink-dim">{stamp(e.at, lang)}</span>
                    <span className="selectable text-ink-soft">{line}</span>
                  </li>
                )),
              )}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

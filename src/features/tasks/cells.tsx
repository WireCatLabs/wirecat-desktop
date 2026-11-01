import { useRef, useState } from "react"
import { addDays, isoDay, LABELS, localDay, STATES, type State } from "@/domain/tasks"
import { useLang, useMessages } from "@/i18n"
import type { Task } from "@/platform/task-schemas"
import { cx } from "@/ui/cx"
import { Select } from "@/ui/Select"
import { dueDay, taskMessages } from "./messages"
import { DueText, personName, priorityLabel, StateLamp } from "./parts"
import { useTasks } from "./store"

// A cell reads as text and takes a wash on hover; it is a Select underneath, so keys and screen readers work as there.
const BARE = "w-full border-transparent! bg-transparent! hover:bg-app-3! -ml-[0.45rem] pl-[0.45rem]!"

function Bars({ filled, tone }: { filled: number; tone: string }) {
  return (
    <span aria-hidden className={cx("inline-flex h-[0.8rem] items-end gap-[2px]", tone)}>
      {[0, 1, 2].map((b) => (
        <span
          key={b}
          className={cx("w-[3px] rounded-[1px] bg-current", b >= filled && "opacity-25")}
          style={{ height: `${(b + 1) * 33}%` }}
        />
      ))}
    </span>
  )
}

const BAR: Record<string, [number, string]> = {
  critical: [3, "text-bad"],
  high: [2, "text-warn"],
  medium: [1, "text-ink-dim"],
  low: [0, "text-ink-dim"],
  none: [0, "text-ink-dim/50"],
}

export function StatusCell({ task, label }: { task: Task; label?: string }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  return (
    <Select
      size="sm"
      aria-label={label ?? m.cell(m.status, task.key)}
      value={task.state}
      disabled={busy}
      onChange={(state: State) => void useTasks.getState().update(task.key, { state })}
      options={STATES.map((s) => ({ value: s, label: m.states[s], icon: <StateLamp state={s} /> }))}
      className={BARE}
    />
  )
}

export function PriorityCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const current = priorityLabel(task) ?? "none"
  return (
    <Select
      size="sm"
      aria-label={m.cell(m.priority, task.key)}
      value={current}
      disabled={busy}
      onChange={(priority) => void useTasks.getState().update(task.key, { priority })}
      options={[...LABELS, "none" as const].map((l) => {
        const [filled, tone] = BAR[l] ?? [0, ""]
        return { value: l, label: m.labels[l], icon: <Bars filled={filled} tone={tone} /> }
      })}
      className={BARE}
    />
  )
}

export function AssigneeCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const people = useTasks((s) => s.people)
  const current = task.assignees[0] ?? "none"
  // A person memo did not list (a role given after the page read) still shows, by reference.
  const refs = [...new Set([...people.map((p) => p.ref), ...task.assignees])]
  return (
    <Select
      size="sm"
      aria-label={m.cell(m.assignee, task.key)}
      value={current}
      disabled={busy}
      onChange={(v) => void useTasks.getState().assign(task.key, v === "none" ? null : v)}
      options={[
        { value: "none", label: m.nobody },
        ...refs.map((ref) => ({ value: ref, label: personName(ref, people, m) })),
      ]}
      className={BARE}
    />
  )
}

type DueValue = "current" | "today" | "tomorrow" | "week" | "pick" | "none"

/** Today, tomorrow, in a week, no date, or another day typed into a date field that takes the cell's place. */
export function DueCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const [picking, setPicking] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const save = (due: string) => void useTasks.getState().update(task.key, { due })
  const today = new Date()
  const dates = { today, tomorrow: addDays(today, 1), week: addDays(today, 7) }
  const days: Record<"today" | "tomorrow" | "week", string> = {
    today: isoDay(dates.today),
    tomorrow: isoDay(dates.tomorrow),
    week: isoDay(dates.week),
  }
  if (picking) {
    return (
      <input
        ref={field}
        type="date"
        // biome-ignore lint/a11y/noAutofocus: the field replaces the cell the owner just chose "another day" in
        autoFocus
        aria-label={m.cell(m.due, task.key)}
        defaultValue={task.dueAt ? localDay(task.dueAt) : days.today}
        onKeyDown={(e) => {
          if (e.key === "Escape") setPicking(false)
          if (e.key === "Enter" && e.currentTarget.value) {
            save(e.currentTarget.value)
            setPicking(false)
          }
        }}
        onBlur={(e) => {
          if (e.currentTarget.value && (!task.dueAt || e.currentTarget.value !== localDay(task.dueAt))) {
            save(e.currentTarget.value)
          }
          setPicking(false)
        }}
        className="selectable h-8 w-full rounded-[0.35rem] border border-line-strong bg-app px-[0.4rem] font-mono text-[0.85rem] text-ink"
      />
    )
  }
  return (
    <div className="relative">
      <Select<DueValue>
        size="sm"
        aria-label={m.cell(m.due, task.key)}
        value="current"
        disabled={busy}
        onChange={(v) => {
          if (v === "pick") setPicking(true)
          else if (v === "none") save("none")
          else if (v !== "current") save(days[v])
        }}
        options={[
          { value: "current", label: task.dueAt ? dueDay(task.dueAt, lang) : "—", disabled: true },
          { value: "today", label: `${m.today} · ${dueDay(dates.today, lang)}` },
          { value: "tomorrow", label: `${m.tomorrow} · ${dueDay(dates.tomorrow, lang)}` },
          { value: "week", label: `${m.inWeek} · ${dueDay(dates.week, lang)}` },
          { value: "pick", label: m.pickDate },
          { value: "none", label: m.noDate },
        ]}
        className={cx(BARE, "[&>span:first-child]:invisible")}
      />
      {/* The trigger's own label is hidden; the coloured date sits over it, as the rest of the page draws dates. */}
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
        <DueText task={task} />
      </span>
    </div>
  )
}

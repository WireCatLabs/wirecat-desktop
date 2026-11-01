import { useEffect, useRef, useState } from "react"
import { addDays, isoDay, LABELS, localDay, STATES, type State } from "@/domain/tasks"
import { useLang, useMessages } from "@/i18n"
import type { Task, TaskKind } from "@/platform/task-schemas"
import { Combobox } from "@/ui/Combobox"
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

const ELSE = "else"

export function AssigneeCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const people = useTasks((s) => s.people)
  const [finding, setFinding] = useState(false)
  const cell = useRef<HTMLDivElement>(null)
  const back = useRef(false)
  useEffect(() => {
    if (!finding && back.current) {
      back.current = false
      cell.current?.querySelector<HTMLElement>("button,[role=combobox]")?.focus()
    }
  }, [finding])
  const stop = () => {
    back.current = true
    setFinding(false)
  }
  const current = task.assignees[0] ?? "none"
  // A person memo did not list (a role given after the page read) still shows, by reference.
  const refs = [...new Set([...people.map((p) => p.ref), ...task.assignees])]
  return (
    <div ref={cell}>
      {finding ? (
        <PersonFinder task={task} onDone={stop} />
      ) : (
        <Select
          size="sm"
          aria-label={m.cell(m.assignee, task.key)}
          value={current}
          disabled={busy}
          onChange={(v) => {
            if (v === ELSE) setFinding(true)
            else void useTasks.getState().assign(task.key, v === "none" ? null : v)
          }}
          options={[
            { value: "none", label: m.nobody },
            ...refs.map((ref) => ({ value: ref, label: personName(ref, people, m) })),
            { value: ELSE, label: m.someoneElse },
          ]}
          className={BARE}
        />
      )}
    </div>
  )
}

/** Everyone memo knows, found by name as one types; a name nobody has yet is added as a new person, then assigned. */
function PersonFinder({ task, onDone }: { task: Task; onDone: () => void }) {
  const m = useMessages(taskMessages)
  const people = useTasks((s) => s.people)
  const failed = useTasks((s) => s.failed.person)
  const [typed, setTyped] = useState("")
  const [adding, setAdding] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => wrap.current?.querySelector("input")?.focus(), [])
  const named = new Map<string, string>()
  for (const p of people) {
    const name = personName(p.ref, people, m)
    if (!named.has(name)) named.set(name, p.ref)
  }
  const name = typed.trim()
  const add = name && !named.has(name) ? m.addNamed(name) : null
  const options = [...named.keys(), ...(add ? [add] : [])]
  const choose = async (picked: string) => {
    const ref = named.get(picked)
    if (ref) {
      onDone()
      void useTasks.getState().assign(task.key, ref)
      return
    }
    if (picked !== add || adding) return setTyped(picked)
    setAdding(true)
    const person = await useTasks.getState().addPerson(name)
    setAdding(false)
    if (!person) return
    onDone()
    void useTasks.getState().assign(task.key, person.ref)
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys belong to the field inside; this only ends the search
    <div
      ref={wrap}
      className="flex flex-col gap-[0.3rem]"
      onBlur={(e) => {
        if (!adding && !e.currentTarget.contains(e.relatedTarget)) onDone()
      }}
      onKeyDown={(e) => {
        if (e.defaultPrevented) return
        if (e.key === "Escape") {
          // In the task dialog this Escape would close the whole dialog, not only the search.
          e.preventDefault()
          onDone()
        } else if (e.key === "Enter" && name) {
          e.preventDefault()
          void choose(named.has(name) ? name : (add ?? name))
        }
      }}
    >
      <Combobox
        value={typed}
        onChange={(v) => void choose(v)}
        options={options}
        placeholder={m.findPerson}
        aria-label={m.findPerson}
        className="h-8"
      />
      {failed && <span className="text-[0.8rem] leading-snug text-bad">{m.personFailed(failed)}</span>}
    </div>
  )
}

export function KindCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const kinds: TaskKind[] = ["feature", "bug", "chore"]
  const current = kinds.find((k) => k === task.kind)
  return (
    <Select<TaskKind | "other">
      size="sm"
      aria-label={m.cell(m.kind, task.key)}
      value={current ?? "other"}
      disabled={busy}
      onChange={(kind) => kind !== "other" && void useTasks.getState().update(task.key, { kind })}
      options={[
        ...kinds.map((k) => ({ value: k, label: m.kinds[k] ?? k })),
        // A kind memo keeps for older tasks, which the three choices replace.
        ...(current
          ? []
          : [{ value: "other" as const, label: m.kinds[task.kind ?? ""] ?? task.kind ?? "—", disabled: true }]),
      ]}
      className={BARE}
    />
  )
}

export function ProjectCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const projects = useTasks((s) => s.projects)
  const keys = [...new Set([task.project, ...projects.map((p) => p.key)])]
  const nameOf = (key: string) =>
    (key === task.project ? task.projectName : null) ?? projects.find((p) => p.key === key)?.name ?? null
  return (
    <Select
      size="sm"
      aria-label={m.cell(m.project, task.key)}
      value={task.project}
      disabled={busy}
      onChange={(project) => project !== task.project && void useTasks.getState().update(task.key, { project })}
      options={keys.map((k) => ({ value: k, label: nameOf(k) ? `${k} · ${nameOf(k)}` : k }))}
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
  const cell = useRef<HTMLDivElement>(null)
  const back = useRef(false)
  const typed = useRef(0)
  useEffect(() => {
    const input = field.current
    if (picking && input) {
      input.focus()
      // Choosing "Another day" opens the calendar at once. The choice was a click or a key a moment ago, which the
      // browser still counts as the owner's gesture; where it has no picker the focused field takes typing instead.
      try {
        input.showPicker?.()
      } catch {
        // NotAllowedError or no picker for dates: the focused field is the fallback.
      }
    } else if (!picking && back.current) {
      back.current = false
      cell.current?.querySelector<HTMLElement>("button,[role=combobox]")?.focus()
    }
  }, [picking])
  const stop = () => {
    back.current = true
    setPicking(false)
  }
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
        aria-label={m.cell(m.due, task.key)}
        defaultValue={task.dueAt ? localDay(task.dueAt) : days.today}
        onChange={(e) => {
          // A day clicked in the calendar is the answer; typed digits wait for Enter, since "2" is already a year.
          if (Date.now() - typed.current > 300 && e.currentTarget.value) {
            save(e.currentTarget.value)
            stop()
          }
        }}
        onKeyDown={(e) => {
          typed.current = Date.now()
          if (e.key === "Escape") {
            // In the task dialog this Escape would close the whole dialog, not only the date field.
            e.preventDefault()
            stop()
          }
          if (e.key === "Enter" && e.currentTarget.value) {
            save(e.currentTarget.value)
            stop()
          }
        }}
        onBlur={(e) => {
          if (
            !back.current &&
            e.currentTarget.value &&
            (!task.dueAt || e.currentTarget.value !== localDay(task.dueAt))
          ) {
            save(e.currentTarget.value)
          }
          setPicking(false)
        }}
        className="selectable h-8 w-full rounded-[0.35rem] border border-line-strong bg-app px-[0.4rem] font-mono text-[0.85rem] text-ink"
      />
    )
  }
  return (
    <div ref={cell} className="relative">
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

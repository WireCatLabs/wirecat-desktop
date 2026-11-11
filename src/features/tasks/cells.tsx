import { ChevronDown } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { addDays, closed, fromMessages, isoDay, LABELS, localDay, STATES, type State } from "@/domain/tasks"
import { useLang, useMessages } from "@/i18n"
import type { Task, TaskKind } from "@/platform/task-schemas"
import { Calendar, CalendarFooter, DatePopover } from "@/ui/Calendar"
import { cx } from "@/ui/cx"
import { fieldFocus } from "@/ui/field"
import { InfoTip } from "@/ui/InfoTip"
import { Select } from "@/ui/Select"
import { dueDay, taskMessages } from "./messages"
import { PersonFinder } from "./PersonFinder"
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

/**
 * A found task's field that memo keeps for project tasks only. It looks like the field and opens on a click, so the
 * owner learns why it does not change and what to do, rather than meeting a bare dash.
 */
function Locked({ task, field, why, children }: { task: Task; field: string; why?: string; children: ReactNode }) {
  const m = useMessages(taskMessages)
  return (
    <InfoTip
      label={m.cell(field, task.key)}
      align="end"
      className="w-full [&>button]:w-full"
      trigger={
        <span className="-ml-[0.45rem] flex h-8 w-full min-w-0 items-center gap-1.5 rounded-[0.35rem] pr-1.5 pl-[0.45rem] text-[0.875rem] text-ink-soft hover:bg-app-3">
          <span className="min-w-0 flex-1 truncate text-left">{children}</span>
          <span className="sr-only">{m.cell(field, task.key)}</span>
          <ChevronDown className="size-4 shrink-0 text-ink-dim" aria-hidden />
        </span>
      }
    >
      {why ?? m.projectOnlyField(field)}
    </InfoTip>
  )
}

export function StatusCell({ task, label }: { task: Task; label?: string }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const found = fromMessages(task)
  // memo only closes a found task, and a closed one stays closed.
  if (found && closed(task.state))
    return (
      <Locked task={task} field={m.status} why={m.foundClosed}>
        <span className="flex items-center gap-[0.45rem]">
          <StateLamp state={task.state} /> {m.states[task.state]}
        </span>
      </Locked>
    )
  const option = (s: State, disabled = false) => ({
    value: s,
    label: m.states[s],
    icon: <StateLamp state={s} />,
    disabled,
  })
  // The steps memo keeps for project tasks stay in sight, under a heading that says why they cannot be picked.
  const options = found
    ? [
        ...[task.state, "done" as const, "dismissed" as const].map((s) => option(s)),
        { label: m.projectOnlyStates, options: (["todo", "in_progress"] as const).map((s) => option(s, true)) },
      ]
    : STATES.map((s) => option(s))
  return (
    <Select
      size="sm"
      aria-label={label ?? m.cell(m.status, task.key)}
      value={task.state}
      busy={busy}
      onChange={(state: State) => void useTasks.getState().update(task.key, { state })}
      options={options}
      className={BARE}
    />
  )
}

export function PriorityCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const current = priorityLabel(task) ?? "none"
  if (fromMessages(task))
    return (
      <Locked task={task} field={m.priority}>
        {current === "none" ? "—" : m.labels[current]}
      </Locked>
    )
  // The closed cell shows the bars alone, and nothing for no priority; the words stay in the list and the tooltip.
  return (
    <span className="flex w-full" title={current === "none" ? undefined : m.priorityIs(m.labels[current])}>
      <Select
        size="sm"
        aria-label={m.cell(m.priority, task.key)}
        value={current}
        busy={busy}
        onChange={(priority) => void useTasks.getState().update(task.key, { priority })}
        options={[...LABELS, "none" as const].map((l) => {
          const [filled, tone] = BAR[l] ?? [0, ""]
          return {
            value: l,
            label: m.labels[l],
            ...(l === "none" ? {} : { icon: <Bars filled={filled} tone={tone} /> }),
          }
        })}
        className={cx(BARE, "[&>span.flex-1]:sr-only [&>svg]:ml-auto")}
      />
    </span>
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
  // memo lists every contact, which can be thousands; a row offers the owner and whoever has tasks on the page, and
  // "Someone else…" asks memo for the rest by name. A person memo did not list still shows, by reference.
  const assigned = useTasks((s) => s.assigned)
  const owner = people.find((p) => p.owner)?.ref
  const refs = [...new Set([...(owner ? [owner] : []), ...assigned, ...task.assignees])]
  return (
    <div ref={cell}>
      {finding ? (
        <PersonFinder onPick={(ref) => void useTasks.getState().assign(task.key, ref)} onDone={stop} />
      ) : (
        <Select
          size="sm"
          aria-label={m.cell(m.assignee, task.key)}
          value={current}
          busy={busy}
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

export function KindCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const kinds: TaskKind[] = ["feature", "bug", "chore"]
  const current = kinds.find((k) => k === task.kind)
  if (fromMessages(task))
    return (
      <Locked task={task} field={m.kind}>
        {m.kinds[task.kind ?? ""] ?? task.kind ?? "—"}
      </Locked>
    )
  return (
    <Select<TaskKind | "other">
      size="sm"
      aria-label={m.cell(m.kind, task.key)}
      value={current ?? "other"}
      busy={busy}
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
  // memo keeps a found task in an inbox named after its account, which is no project of the owner's.
  if (fromMessages(task))
    return (
      <Locked task={task} field={m.project}>
        {m.noProject}
      </Locked>
    )
  return (
    <Select
      size="sm"
      aria-label={m.cell(m.project, task.key)}
      value={task.project}
      busy={busy}
      onChange={(project) => project !== task.project && void useTasks.getState().update(task.key, { project })}
      options={keys.map((k) => ({ value: k, label: nameOf(k) ? `${k} · ${nameOf(k)}` : k }))}
      className={BARE}
    />
  )
}

/** The agent's name saves when the field is left or Enter is pressed; Escape puts back what memo has. */
export function AgentCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const [agent, setAgent] = useState(task.agent ?? "")
  useEffect(() => setAgent(task.agent ?? ""), [task.agent])
  if (fromMessages(task))
    return (
      <Locked task={task} field={m.agentField}>
        —
      </Locked>
    )
  const save = () => {
    const name = agent.trim()
    if (name !== (task.agent ?? "")) void useTasks.getState().update(task.key, { agent: name || "none" })
  }
  return (
    <input
      value={agent}
      aria-label={m.cell(m.agentField, task.key)}
      maxLength={64}
      spellCheck={false}
      readOnly={busy}
      onChange={(e) => setAgent(e.target.value.replace(/[^\w.-]/g, ""))}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          save()
        } else if (e.key === "Escape" && agent !== (task.agent ?? "")) {
          // The native <dialog> would close on this Escape too.
          e.preventDefault()
          e.stopPropagation()
          setAgent(task.agent ?? "")
        }
      }}
      placeholder={m.agentNone}
      className={`selectable -ml-[0.45rem] h-[1.9rem] w-full rounded-[0.35rem] border border-transparent bg-transparent px-[0.45rem] font-mono text-[0.9rem] text-ink placeholder:font-sans placeholder:text-ink-dim hover:bg-app-3 focus-visible:bg-app ${fieldFocus}`}
    />
  )
}

type DueValue = "current" | "today" | "tomorrow" | "week" | "pick" | "none"

/** Today, tomorrow, in a week, no date, or another day from a calendar that opens under the cell at once. */
export function DueCell({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const [picking, setPicking] = useState(false)
  const cell = useRef<HTMLDivElement>(null)
  const save = (due: string) => void useTasks.getState().update(task.key, { due })
  const stop = (refocus: boolean) => {
    setPicking(false)
    if (refocus) cell.current?.querySelector<HTMLElement>("button,[role=combobox]")?.focus()
  }
  const today = new Date()
  const dates = { today, tomorrow: addDays(today, 1), week: addDays(today, 7) }
  const days: Record<"today" | "tomorrow" | "week", string> = {
    today: isoDay(dates.today),
    tomorrow: isoDay(dates.tomorrow),
    week: isoDay(dates.week),
  }
  const current = task.dueAt ? localDay(task.dueAt) : null
  return (
    <div ref={cell} className="relative">
      <Select<DueValue>
        size="sm"
        aria-label={m.cell(m.due, task.key)}
        value="current"
        busy={busy}
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
      <span className="pointer-events-none absolute inset-y-0 left-0 flex max-w-full items-center overflow-hidden pr-[1.6rem]">
        <DueText task={task} />
      </span>
      <DatePopover open={picking} anchor={cell} onClose={stop} label={m.cell(m.due, task.key)}>
        <Calendar
          selected={current ? { from: current } : null}
          autoFocus
          label={m.cell(m.due, task.key)}
          onPick={(day) => {
            if (day !== current) save(day)
            stop(true)
          }}
        />
        <CalendarFooter
          onToday={() => {
            if (days.today !== current) save(days.today)
            stop(true)
          }}
        />
      </DatePopover>
    </div>
  )
}

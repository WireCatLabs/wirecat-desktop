import { useRef, useState } from "react"
import { type DueChoice, dueOf, isoDay, LABELS, STATES, setField, valuesOf } from "@/domain/tasks"
import { useLang, useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Calendar, CalendarFooter, DatePopover, type DaySpan } from "@/ui/Calendar"
import { FilterBar, ToggleChip } from "@/ui/FilterBar"
import { FilterMenu, type FilterOption } from "@/ui/FilterMenu"
import { StableText } from "@/ui/Skeleton"
import { dueDay, taskMessages } from "./messages"
import { personName, StateLamp } from "./parts"
import { useTasks } from "./store"

const countOf = (facet: { value: string; count: number }[] | undefined, value: string) =>
  facet ? (facet.find((f) => f.value === value)?.count ?? 0) : undefined

export function Filters() {
  const m = useMessages(taskMessages)
  const query = useTasks((s) => s.query)
  const view = useTasks((s) => s.view)
  const counts = useTasks((s) => s.counts)
  const people = useTasks((s) => s.people)
  const projects = useTasks((s) => s.projects)
  const tasks = useTasks((s) => s.tasks)
  const badQuery = useTasks((s) => s.badQuery)
  const { type, setQuery, setDue } = useTasks.getState()

  const field = (name: "project" | "assignee" | "priority" | "state" | "agent", options: FilterOption[]) => ({
    selected: valuesOf(query, name),
    options,
    onChange: (values: string[]) => setQuery(setField(query, name, values)),
  })

  const projectOptions = projects.map((p) => ({
    value: p.key,
    label: p.name || p.key,
    hint: p.key,
    count: countOf(counts?.project, p.key),
  }))
  const assigneeOptions = [
    { value: "none", label: m.nobody, count: countOf(counts?.assignee, "none") },
    ...people.map((p) => ({
      value: p.ref,
      label: personName(p.ref, people, m),
      count: countOf(counts?.assignee, p.ref),
    })),
  ]
  const priorityOptions = [...LABELS, "none" as const].map((l) => ({
    value: l,
    label: m.labels[l],
    count: countOf(counts?.priority, l),
  }))
  const stateOptions = STATES.map((s) => ({
    value: s,
    label: m.states[s],
    icon: <StateLamp state={s} />,
    count: countOf(counts?.state, s),
  }))
  // memo counts the agents tasks name; until the counts arrive, the choices are the agents the tasks on screen name.
  const counted = counts?.agent.filter((f) => f.value !== "none").map((f) => f.value)
  const agents = counted ?? [...new Set(tasks.flatMap((t) => (t.agent ? [t.agent] : [])))]
  const agentOptions = [
    { value: "*", label: m.anyAgent },
    ...[...agents].sort().map((a) => ({ value: a, label: a, count: countOf(counts?.agent, a) })),
  ]
  const dueCount = (bucket: string) => countOf(counts?.due, bucket)
  const due = dueOf(query)
  const [custom, setCustom] = useState(false)
  const dueAnchor = useRef<HTMLSpanElement>(null)
  const dueLabel = useDueLabel(due)
  const ready = valuesOf(query, "ready").includes("true")

  return (
    <FilterBar
      query={query}
      onQuery={type}
      onClear={() => setQuery("")}
      label={m.search}
      placeholder={m.searchHint}
      invalid={badQuery !== null}
      describedBy={badQuery ? "tasks-bad-query" : undefined}
    >
      <FilterMenu label={m.project} {...field("project", projectOptions)} />
      <FilterMenu label={m.assignee} {...field("assignee", assigneeOptions)} />
      <FilterMenu label={m.priority} {...field("priority", priorityOptions)} />
      <span ref={dueAnchor} className="inline-flex">
        <FilterMenu
          label={m.due}
          single
          options={[
            { value: "overdue", label: m.overdue, count: dueCount("overdue") },
            { value: "today", label: m.today, count: dueCount("today") },
            { value: "tomorrow", label: m.tomorrow },
            { value: "week", label: m.week },
            { value: "none", label: m.noDate, count: dueCount("none") },
            { value: "custom", label: typeof due === "object" && due ? dueLabel : m.customDay, opens: true },
          ]}
          selected={due ? [typeof due === "object" ? "custom" : due] : []}
          onChange={([v]) => {
            if (v === "custom") setCustom(true)
            else setDue((v as Exclude<DueChoice, object> | undefined) ?? null)
          }}
        />
      </span>
      <DueRange
        open={custom}
        anchor={dueAnchor}
        current={typeof due === "object" ? due : null}
        onClose={() => setCustom(false)}
        onChange={(range) => setDue(range)}
      />
      {view === "table" && <FilterMenu label={m.status} {...field("state", stateOptions)} />}
      <FilterMenu label={m.agent} {...field("agent", agentOptions)} />
      <ToggleChip on={ready} onChange={(on) => setQuery(setField(query, "ready", on ? ["true"] : []))}>
        {m.ready}
      </ToggleChip>
    </FilterBar>
  )
}

function useDueLabel(due: DueChoice | null): string {
  const lang = useLang()
  if (!due || typeof due !== "object") return ""
  const day = (iso: string) => dueDay(new Date(`${iso}T00:00:00`), lang)
  return due.to && due.to !== due.from ? `${day(due.from)} – ${day(due.to)}` : day(due.from)
}

/**
 * Custom due dates on one calendar: the first click picks a day, a second click makes it a range. It opens with the
 * calendar focused, as the due cell's "Another day" does; memo answers whatever it writes into the search.
 */
function DueRange(props: {
  open: boolean
  anchor: React.RefObject<HTMLElement | null>
  current: DaySpan | null
  onClose: () => void
  onChange: (range: DaySpan) => void
}) {
  const { open, anchor, current, onClose, onChange } = props
  const m = useMessages(taskMessages)
  // The span is kept here, not read back from the search: memo's words for a single day can be "tomorrow", which
  // reads back as that choice and not as a day. After one click the next one closes the range; a third starts anew.
  const [span, setSpan] = useState<DaySpan | null>(current)
  const [halfway, setHalfway] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSpan(current)
  }
  const close = (refocus: boolean) => {
    onClose()
    setHalfway(false)
    if (refocus) anchor.current?.querySelector<HTMLElement>("button")?.focus()
  }
  const pick = (day: string, fresh = false) => {
    const next: DaySpan =
      !fresh && halfway && span && day !== span.from
        ? day < span.from
          ? { from: day, to: span.from }
          : { from: span.from, to: day }
        : { from: day }
    setSpan(next)
    setHalfway(!next.to)
    onChange(next)
  }
  return (
    <DatePopover open={open} anchor={anchor} onClose={close} label={m.customDay}>
      <Calendar selected={span} onPick={pick} autoFocus label={m.customDay} />
      <p className="w-[17.5rem] px-[0.2rem] text-[0.85rem] text-ink-dim">
        <StableText value={halfway ? m.rangeEnd : m.rangeStart} variants={[m.rangeStart, m.rangeEnd]} />
      </p>
      <CalendarFooter onToday={() => pick(isoDay(new Date()), true)}>
        <Button size="sm" variant="ghost" onClick={() => close(true)}>
          {m.done}
        </Button>
      </CalendarFooter>
    </DatePopover>
  )
}

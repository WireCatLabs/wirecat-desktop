import { Check, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { type DueChoice, dueOf, isoDay, LABELS, STATES, setField, valuesOf } from "@/domain/tasks"
import { useLang, useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { useCloseOutside, useListPlacement } from "@/ui/popup-list"
import { FilterMenu, type FilterOption } from "./FilterMenu"
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
    <div className="flex flex-col gap-[0.7rem]">
      <label className="relative block">
        <span className="sr-only">{m.search}</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-[0.8rem] size-4 -translate-y-1/2 text-ink-dim"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => type(e.target.value)}
          placeholder={m.searchHint}
          spellCheck={false}
          aria-invalid={badQuery ? true : undefined}
          aria-describedby={badQuery ? "tasks-bad-query" : undefined}
          className={cx(
            "selectable h-[2.8rem] w-full rounded-[0.35rem] border bg-app pr-[0.8rem] pl-[2.3rem] font-mono text-[0.95rem] text-ink outline-none placeholder:font-sans placeholder:text-ink-dim focus-visible:border-brand",
            badQuery ? "border-bad" : "border-line-strong",
          )}
        />
      </label>
      <div className="flex flex-wrap items-center gap-[0.5rem]">
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
              { value: "custom", label: typeof due === "object" && due ? dueLabel : m.customDay },
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
        <button
          type="button"
          aria-pressed={ready}
          onClick={() => setQuery(setField(query, "ready", ready ? [] : ["true"]))}
          className={cx(
            "flex h-8 cursor-pointer items-center gap-[0.45rem] rounded-[0.35rem] border px-[0.6rem] text-[0.875rem] transition-colors duration-150",
            ready ? "border-brand/50 bg-brand-soft text-ink" : "border-line-strong bg-app text-ink-soft hover:bg-app-2",
          )}
        >
          <span
            aria-hidden
            className={cx(
              "grid size-[0.95rem] place-items-center rounded-[0.25rem] border",
              ready ? "border-brand bg-brand text-brand-ink" : "border-line-strong",
            )}
          >
            {ready && <Check className="size-3" strokeWidth={3} />}
          </span>
          {m.ready}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setQuery("")}
          className={cx(!query && "invisible")}
          tabIndex={query ? undefined : -1}
        >
          {m.clear}
        </Button>
      </div>
    </div>
  )
}

function useDueLabel(due: DueChoice | null): string {
  const lang = useLang()
  if (!due || typeof due !== "object") return ""
  const day = (iso: string) => dueDay(new Date(`${iso}T00:00:00`), lang)
  return due.to && due.to !== due.from ? `${day(due.from)} – ${day(due.to)}` : day(due.from)
}

/**
 * Custom due dates: one day, or a range when "to" is filled too. The first field opens its calendar at once, as the
 * due cell's "Another day" does; memo answers whatever the fields write into the search.
 */
function DueRange(props: {
  open: boolean
  anchor: React.RefObject<HTMLElement | null>
  current: { from: string; to?: string } | null
  onClose: () => void
  onChange: (range: { from: string; to?: string }) => void
}) {
  const { open, anchor, current, onClose, onChange } = props
  const m = useMessages(taskMessages)
  const box = useRef<HTMLFieldSetElement>(null)
  const first = useRef<HTMLInputElement>(null)
  const [from, setFrom] = useState(current?.from ?? isoDay(new Date()))
  const [to, setTo] = useState(current?.to ?? "")
  const place = useListPlacement(open, anchor, box)
  const inside = useMemo(() => [box], [])
  useCloseOutside(open, inside, onClose)

  useEffect(() => {
    if (!open) return
    const input = first.current
    input?.focus({ preventScroll: true })
    try {
      input?.showPicker?.()
    } catch {
      // No calendar here, or the gesture has passed: the focused field takes a typed date.
    }
  }, [open])

  // A typed year passes through 0002 on its way to 2026; only a whole, plausible date goes to memo.
  const whole = (d: string) => /^(19|2\d)\d{2}-/.test(d)
  const apply = (a: string, b: string) => {
    if (whole(a)) onChange(whole(b) ? { from: a, to: b } : { from: a })
  }
  const close = () => {
    onClose()
    anchor.current?.querySelector<HTMLElement>("button")?.focus()
  }
  const field =
    "selectable h-8 rounded-[0.35rem] border border-line-strong bg-app px-[0.4rem] font-mono text-[0.85rem] text-ink outline-none focus-visible:border-brand"

  return (
    <fieldset
      ref={box}
      hidden={!open}
      style={place}
      aria-label={m.customDay}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          close()
        }
        if (e.key === "Enter") close()
      }}
      className="fixed z-50 m-0 flex min-w-0 flex-wrap items-end gap-[0.6rem] rounded-[0.45rem] border border-line bg-app p-[0.7rem] text-ink shadow-panel motion-safe:animate-[select-in_120ms_var(--ease-out-quart)]"
    >
      <label className="flex flex-col gap-[0.25rem] text-[0.85rem] text-ink-dim">
        {m.dueFrom}
        <input
          ref={first}
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            apply(e.target.value, to)
          }}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-[0.25rem] text-[0.85rem] text-ink-dim">
        {m.dueTo}
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => {
            setTo(e.target.value)
            apply(from, e.target.value)
          }}
          className={field}
        />
      </label>
      <Button size="sm" variant="ghost" onClick={close}>
        {m.done}
      </Button>
    </fieldset>
  )
}

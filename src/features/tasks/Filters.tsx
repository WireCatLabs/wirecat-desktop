import { Check, Search } from "lucide-react"
import { dueOf, LABELS, STATES, setField, valuesOf } from "@/domain/tasks"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { FilterMenu, type FilterOption } from "./FilterMenu"
import { taskMessages } from "./messages"
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
  // memo counts no agents yet, so the choices are the agents the tasks on screen name.
  const agents = [...new Set(tasks.flatMap((t) => [t.agent, t.claimedBy]).filter((a): a is string => Boolean(a)))]
  const agentOptions = [{ value: "*", label: m.anyAgent }, ...agents.sort().map((a) => ({ value: a, label: a }))]
  const due = dueOf(query)
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
            "selectable h-[2.8rem] w-full rounded-[0.35rem] border bg-app pr-[0.8rem] pl-[2.3rem] font-mono text-[0.95rem] text-ink outline-none placeholder:font-sans placeholder:text-ink-dim focus-visible:border-brand focus-visible:outline-none",
            badQuery ? "border-bad" : "border-line-strong",
          )}
        />
      </label>
      <div className="flex flex-wrap items-center gap-[0.5rem]">
        <FilterMenu label={m.project} {...field("project", projectOptions)} />
        <FilterMenu label={m.assignee} {...field("assignee", assigneeOptions)} />
        <FilterMenu label={m.priority} {...field("priority", priorityOptions)} />
        <FilterMenu
          label={m.due}
          single
          options={[
            { value: "overdue", label: m.overdue },
            { value: "week", label: m.week },
            { value: "none", label: m.noDate },
          ]}
          selected={due ? [due] : []}
          onChange={([v]) => setDue((v as "overdue" | "week" | "none" | undefined) ?? null)}
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

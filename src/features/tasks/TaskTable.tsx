import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { closed, STATES } from "@/domain/tasks"
import { type Lang, useLang, useMessages } from "@/i18n"
import type { Task } from "@/platform/task-schemas"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { AssigneeCell, DueCell, PriorityCell, StatusCell } from "./cells"
import { taskMessages } from "./messages"
import { StaleLine } from "./Note"
import { Markers } from "./parts"
import { useTasks } from "./store"

type SortBy = "priority" | "key" | "due" | "status"
type Sort = { by: SortBy; dir: 1 | -1 }

// Below the table's minimum width it scrolls sideways inside its frame; status, key and title stay in view.
const GRID =
  "grid grid-cols-[minmax(30rem,1fr)_7.6rem_var(--priority)_7.6rem] items-center gap-x-[0.9rem] pr-[1.3rem] xl:gap-x-[1.2rem]"
const LEAD =
  "sticky left-0 z-[1] grid grid-cols-[var(--status)_5.2rem_minmax(0,1fr)] items-center gap-x-[0.9rem] self-stretch bg-app pl-[1.3rem] group-data-[scrolled]/rack:shadow-[1px_0_0_var(--color-line)] xl:gap-x-[1.2rem]"

// Wide enough for each language's longest status and priority, so none is cut ("К выполнению", "Без приоритета").
// One width per language, not per value: a cell that changes never moves the columns (rule 9).
const WIDTHS: Record<Lang, { "--status": string; "--priority": string }> = {
  en: { "--status": "8.2rem", "--priority": "8.2rem" },
  ru: { "--status": "9.9rem", "--priority": "10.5rem" },
  es: { "--status": "9rem", "--priority": "9rem" },
}

const keyOf = (t: Task, by: SortBy): number | string => {
  if (by === "priority") return -(t.priority ?? -1)
  if (by === "due") return t.dueAt ?? "9999"
  if (by === "status") return STATES.indexOf(t.state)
  const [p = "", n = "0"] = t.key.split("-")
  return `${p}-${n.padStart(9, "0")}`
}

/** The order is fixed when the owner sorts, not when a value changes: an edited row stays where it is (rule 9). */
function sortKeys(tasks: readonly Task[], sort: Sort): string[] {
  return [...tasks]
    .sort((a, b) => {
      const x = keyOf(a, sort.by)
      const y = keyOf(b, sort.by)
      return x < y ? -sort.dir : x > y ? sort.dir : 0
    })
    .map((t) => t.key)
}

export function TaskTable({ top }: { top?: React.ReactNode }) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const tasks = useTasks((s) => s.tasks)
  const order = useTasks((s) => s.order)
  const failed = useTasks((s) => s.failed)
  const stale = useTasks((s) => s.stale?.key)
  const [sort, setSort] = useState<Sort | null>(null)
  const [sorted, setSorted] = useState<string[]>([])
  const [scrolled, setScrolled] = useState(false)
  const byKey = new Map(tasks.map((t) => [t.key, t]))
  const keys = sort ? [...sorted.filter((k) => byKey.has(k)), ...order.filter((k) => !sorted.includes(k))] : order
  const rows = keys.map((k) => byKey.get(k)).filter((t): t is Task => Boolean(t))

  const head = (by: SortBy, label: string) => {
    const on = sort?.by === by
    return (
      <button
        type="button"
        onClick={() => {
          const next: Sort = { by, dir: on && sort?.dir === 1 ? -1 : 1 }
          setSort(next)
          setSorted(sortKeys(tasks, next))
        }}
        aria-label={m.sortBy(label)}
        aria-pressed={on}
        className="inline-flex cursor-pointer items-center gap-1 hover:text-ink"
      >
        {label}
        <ChevronDown
          aria-hidden
          className={cx("size-[0.85rem] transition-transform", !on && "invisible", sort?.dir === -1 && "rotate-180")}
        />
      </button>
    )
  }

  return (
    <div
      data-scrolled={scrolled || undefined}
      onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
      className="group/rack overflow-x-auto rounded-[0.2rem] border border-line-strong bg-app"
    >
      <div className="min-w-[calc(50.6rem+var(--priority))]" style={WIDTHS[lang] as React.CSSProperties}>
        <div className={cx(GRID, "h-[2.6rem] border-line border-b text-[0.9rem] font-medium text-ink-dim")}>
          <span className={LEAD}>
            <span>{head("status", m.status)}</span>
            <span>{head("key", m.task)}</span>
            <span className="sr-only">{m.titleField}</span>
          </span>
          <span>{m.assignee}</span>
          <span>{head("priority", m.priority)}</span>
          <span>{head("due", m.due)}</span>
        </div>
        {top}
        <ul aria-label={m.title}>
          {rows.map((t) => (
            <li key={t.key} data-row={t.key} className="border-line not-first:border-t">
              <div className={cx(GRID, "group min-h-[3.6rem]")}>
                <span className={cx(LEAD, "py-[0.45rem]")}>
                  <span className="min-w-0">
                    <StatusCell task={t} />
                  </span>
                  <span className="font-mono text-[0.9rem] tabular-nums text-ink-soft">{t.key}</span>
                  <span className="min-w-0">
                    <button
                      type="button"
                      data-opens={t.key}
                      aria-haspopup="dialog"
                      aria-label={`${t.key} ${t.title}`}
                      onClick={() => void useTasks.getState().openTask(t.key)}
                      className="block w-full min-w-0 cursor-pointer rounded-[0.2rem] text-left focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <span
                        className={cx(
                          "block truncate text-[1rem] font-medium group-hover:text-brand",
                          closed(t.state) && "font-normal text-ink-soft",
                          t.state === "done" && "line-through decoration-ink-dim/60",
                        )}
                      >
                        {t.title}
                      </span>
                    </button>
                    <Markers task={t} />
                  </span>
                </span>
                <span className="min-w-0">
                  <AssigneeCell task={t} />
                </span>
                <span className="min-w-0">
                  <PriorityCell task={t} />
                </span>
                <span className="min-w-0">
                  <DueCell task={t} />
                </span>
              </div>
              {failed[t.key] && (
                <div className="sticky left-0 w-fit max-w-[58rem] px-[1.3rem] pb-[0.6rem]">
                  <ErrorNotice inline>{m.notSaved(failed[t.key] ?? "")}</ErrorNotice>
                </div>
              )}
              {stale === t.key && (
                <div className="sticky left-0 w-fit max-w-[58rem] px-[1.3rem] pb-[0.6rem]">
                  <StaleLine taskKey={t.key} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

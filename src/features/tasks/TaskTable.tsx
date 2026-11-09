import { closed, STATES } from "@/domain/tasks"
import { type Lang, useLang, useMessages } from "@/i18n"
import type { Task } from "@/platform/task-schemas"
import { cx } from "@/ui/cx"
import { type Column, DataTable } from "@/ui/DataTable"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { AssigneeCell, DueCell, PriorityCell, StatusCell } from "./cells"
import { taskMessages } from "./messages"
import { StaleLine } from "./Note"
import { Markers } from "./parts"
import { useTasks } from "./store"

// Wide enough for each language's longest status and priority, so none is cut ("К выполнению", "Без приоритета").
// One width per language, not per value: a cell that changes never moves the columns (rule 9).
const WIDTHS: Record<Lang, { "--status": string; "--priority": string }> = {
  en: { "--status": "8.2rem", "--priority": "8.2rem" },
  ru: { "--status": "9.9rem", "--priority": "10.5rem" },
  es: { "--status": "9rem", "--priority": "9rem" },
}

const keyOrder = (t: Task) => {
  const [p = "", n = "0"] = t.key.split("-")
  return `${p}-${n.padStart(9, "0")}`
}

type Words = (typeof taskMessages)["en"]

const columns = (m: Words): Column<Task>[] => [
  {
    id: "status",
    head: m.status,
    width: "var(--status)",
    lead: true,
    sortBy: (t) => STATES.indexOf(t.state),
    cell: (t) => <StatusCell task={t} />,
  },
  {
    id: "key",
    head: m.task,
    width: "5.2rem",
    lead: true,
    sortBy: keyOrder,
    className: "font-mono text-[0.9rem] tabular-nums text-ink-soft",
    cell: (t) => t.key,
  },
  {
    id: "title",
    head: m.titleField,
    hideHead: true,
    width: "minmax(0,1fr)",
    lead: true,
    cell: (t) => <Title task={t} />,
  },
  { id: "assignee", head: m.assignee, width: "7.6rem", cell: (t) => <AssigneeCell task={t} /> },
  {
    id: "priority",
    head: m.priority,
    width: "var(--priority)",
    sortBy: (t) => -(t.priority ?? -1),
    cell: (t) => <PriorityCell task={t} />,
  },
  { id: "due", head: m.due, width: "7.6rem", sortBy: (t) => t.dueAt ?? "9999", cell: (t) => <DueCell task={t} /> },
]

// Below the table's minimum width it scrolls sideways inside its frame; status, key and title stay in view.
export function TaskTable({ top }: { top?: React.ReactNode }) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const tasks = useTasks((s) => s.tasks)
  const order = useTasks((s) => s.order)
  const failed = useTasks((s) => s.failed)
  const stale = useTasks((s) => s.stale?.key)
  const byKey = new Map(tasks.map((t) => [t.key, t]))
  const rows = order.map((k) => byKey.get(k)).filter((t): t is Task => Boolean(t))
  return (
    <DataTable
      label={m.title}
      rows={rows}
      rowKey={(t) => t.key}
      columns={columns(m)}
      leadWidth="minmax(30rem,1fr)"
      minWidth="calc(50.6rem + var(--priority))"
      style={WIDTHS[lang] as React.CSSProperties}
      top={top}
      below={(t) =>
        failed[t.key] || stale === t.key ? (
          <>
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
          </>
        ) : null
      }
    />
  )
}

function Title({ task: t }: { task: Task }) {
  return (
    <>
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
    </>
  )
}

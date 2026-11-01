// cspell:words hermes
// Design prototype for the Tasks page plan (docs/dev/plans/2026-10-31-tasks-page.md). Made-up data, no platform calls.
// `?view=table|kanban` picks the view. `?tasks=<state>` picks what it shows: default, loading, none, nomatch, missing,
// old, fail, write-fail, conflict. The query box stands in for `src/features/query/QueryBar` (PR #34, not on main yet);
// the real page sends the query to `memo tasks list <query> --json` and filters nothing itself. Here a tiny parser
// filters the made-up rows by the same words, so the picture matches what memo would answer.
import {
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  ExternalLink,
  GitBranch,
  GripVertical,
  Link2,
  Lock,
  Plus,
  RefreshCw,
  Rows3,
  Search,
} from "lucide-react"
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { reducedMotion } from "@/ui/motion"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"

// Board order. memo 0.127 has open, done and dismissed; "in_progress" is the state this plan asks memo for (NEED-1).
// One constant, so the board follows whatever memo ends up offering.
const STATUSES = [
  { id: "open", label: "To do", tone: "idle" },
  { id: "in_progress", label: "Doing", tone: "brand" },
  { id: "done", label: "Done", tone: "ok" },
  { id: "dismissed", label: "Dropped", tone: "idle" },
] as const satisfies readonly { id: string; label: string; tone: LampTone | "brand" }[]
type Status = (typeof STATUSES)[number]["id"]
const statusOf = (id: Status) => STATUSES.find((s) => s.id === id) ?? STATUSES[0]

const PRIORITIES = [
  { value: 0, label: "Urgent" },
  { value: 1, label: "High" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Low" },
  { value: 4, label: "Someday" },
] as const

type Person = { name: string }
type Task = {
  key: string
  project: string
  title: string
  status: Status
  priority: number
  assignee: Person | null
  /** An agent's claim (`claimed_by`, `claimed_until`): it is working on the task now. */
  claim: string | null
  due: string | null
  blockedBy: string[]
  body: string
  history: [string, string][]
}

const PROJECTS = [
  { key: "HRB", name: "Harbour launch" },
  { key: "OPS", name: "Operations" },
  { key: "HOME", name: "Home" },
]
// memo assigns people (`person:<id>`), never agents; an agent shows up through its claim instead.
const PEOPLE: Person[] = [{ name: "You" }, { name: "Kai Sample" }, { name: "Ana Ruiz" }]
const you = PEOPLE[0] ?? null
const kai = PEOPLE[1] ?? null
const ana = PEOPLE[2] ?? null

// "Today" in the prototype is Saturday 31 October 2026.
const TODAY = "2026-10-31"
const TASKS: Task[] = [
  {
    key: "HRB-12",
    project: "HRB",
    title: "Send Kai the pricing table with the clinic discount",
    status: "in_progress",
    priority: 1,
    assignee: you,
    claim: null,
    due: "2026-11-04",
    blockedBy: [],
    body: "Second tab of the pricing sheet. Kai asked for the clinic discount spelled out per seat.",
    history: [
      ["31 Oct 09:14", "You moved it from To do to Doing"],
      ["28 Oct 10:05", "You created it"],
    ],
  },
  {
    key: "HRB-14",
    project: "HRB",
    title: "Book the two pilot clinics for February",
    status: "open",
    priority: 0,
    assignee: ana,
    claim: null,
    due: "2026-10-30",
    blockedBy: [],
    body: "",
    history: [["27 Oct 16:40", "You created it"]],
  },
  {
    key: "HRB-15",
    project: "HRB",
    title: "Draft the launch announcement for 2 March",
    status: "open",
    priority: 2,
    assignee: you,
    claim: "claude-code",
    due: "2026-11-20",
    blockedBy: ["HRB-14"],
    body: "Waits until both pilot clinics have said yes.",
    history: [
      ["31 Oct 08:40", "claude-code claimed it until 10:40"],
      ["29 Oct 08:02", "You created it"],
    ],
  },
  {
    key: "HRB-9",
    project: "HRB",
    title: "Agenda for the Monday call with Kai",
    status: "dismissed",
    priority: 2,
    assignee: kai,
    claim: null,
    due: "2026-11-06",
    blockedBy: [],
    body: "Kai wants the points the evening before.",
    history: [["30 Oct 18:10", "You dropped it: the call moved to Friday"]],
  },
  {
    key: "OPS-3",
    project: "OPS",
    title: "Renew the domain and check the DNS records",
    status: "open",
    priority: 1,
    assignee: you,
    claim: null,
    due: "2026-11-02",
    blockedBy: [],
    body: "",
    history: [],
  },
  {
    key: "OPS-4",
    project: "OPS",
    title: "Summarise last week's support chats",
    status: "in_progress",
    priority: 3,
    assignee: null,
    claim: "hermes",
    due: null,
    blockedBy: [],
    body: "",
    history: [],
  },
  {
    key: "HOME-2",
    project: "HOME",
    title: "Call the landlord about the boiler",
    status: "open",
    priority: 2,
    assignee: you,
    claim: null,
    due: null,
    blockedBy: [],
    body: "",
    history: [],
  },
  {
    key: "HRB-8",
    project: "HRB",
    title: "Send the signed NDA back to Kai",
    status: "done",
    priority: 1,
    assignee: you,
    claim: null,
    due: "2026-10-29",
    blockedBy: [],
    body: "",
    history: [["29 Oct 12:30", "You closed it"]],
  },
  {
    key: "OPS-2",
    project: "OPS",
    title: "Move the backups to the new disk",
    status: "done",
    priority: 2,
    assignee: you,
    claim: null,
    due: null,
    blockedBy: [],
    body: "",
    history: [],
  },
]

const params = new URLSearchParams(window.location.search)
const STATE = params.get("tasks") ?? "default"

// ---- The query: the one place filters live. Pickers write words into it; memo reads it. ----

type Term = { field: string | null; value: string }
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const quote = (v: string) => (/[\s:()"]/.test(v) ? `"${v}"` : v)
function terms(q: string): Term[] {
  const out: Term[] = []
  for (const m of q.matchAll(/(?:(\w+):)?(?:"([^"]*)"|(\S+))/g)) {
    out.push({ field: m[1] ?? null, value: m[2] ?? m[3] ?? "" })
  }
  return out
}
const valuesOf = (q: string, field: string) =>
  terms(q)
    .filter((t) => t.field === field)
    .map((t) => t.value)
function setField(q: string, field: string, values: string[]): string {
  const rest = q
    .replaceAll(new RegExp(`(^|\\s)${field}:(?:"[^"]*"|\\S+)`, "g"), " ")
    .replace(/\s+/g, " ")
    .trim()
  return [rest, ...values.map((v) => `${field}:${quote(v)}`)].filter(Boolean).join(" ")
}
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

function matches(t: Task, q: string): boolean {
  const by = (field: string) => valuesOf(q, field)
  const any = (field: string, value: string) => {
    const vs = by(field).map((v) => v.toLowerCase())
    return vs.length === 0 || vs.includes(value.toLowerCase())
  }
  if (!any("project", t.project) || !any("state", t.status)) return false
  if (by("ready").includes("true") && (t.status !== "open" || t.blockedBy.some((k) => TASKS.find((x) => x.key === k)?.status !== "done")))
    return false
  if (!any("assignee", t.assignee?.name ?? "none")) return false
  const levels = by("priority")
  if (levels.length > 0 && !levels.some((p) => (p.startsWith("<=") ? t.priority <= Number(p.slice(2)) : t.priority === Number(p))))
    return false
  const due = by("due")
  if (due.length > 0) {
    const d = t.due ? days(TODAY, t.due) : null
    const ok = due.some((v) =>
      v === "overdue"
        ? d !== null && d < 0 && t.status !== "done"
        : v === "none"
          ? d === null
          : v === "week"
            ? d !== null && d >= 0 && d <= 7
            : true,
    )
    if (!ok) return false
  }
  const words = terms(q).filter((x) => x.field === null)
  const text = `${t.key} ${t.title} ${t.body}`.toLowerCase()
  return words.every((w) => text.includes(w.value.toLowerCase()))
}

// ---- The page ----

type Edit = Partial<Pick<Task, "status" | "priority" | "assignee" | "due" | "project">>

export function TasksPage() {
  const [view, setView] = useState<"table" | "kanban">(params.get("view") === "kanban" ? "kanban" : "table")
  const [query, setQuery] = useState(STATE === "nomatch" ? "project:HRB assignee:\"Ana Ruiz\" state:done" : "")
  const [tasks, setTasks] = useState(TASKS)
  // Board order is the page's own until memo keeps a rank (NEED-2): a dropped card stays where it was dropped.
  const [order, setOrder] = useState(() => TASKS.map((t) => t.key))
  const [open, setOpen] = useState<string | null>(STATE === "default" && params.get("view") !== "kanban" ? "HRB-12" : null)
  const [failed, setFailed] = useState<string | null>(STATE === "write-fail" ? "OPS-3" : null)
  const [said, setSaid] = useState("")

  const edit = (key: string, change: Edit) => {
    if (STATE === "write-fail") {
      setFailed(key)
      return
    }
    setFailed(null)
    setEdited((e) => new Set([...e, key]))
    setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, ...change } : t)))
  }
  const move = (key: string, status: Status, before: string | null) => {
    const from = tasks.find((t) => t.key === key)?.status
    edit(key, { status })
    if (STATE === "write-fail") return
    setOrder((o) => {
      const rest = o.filter((k) => k !== key)
      const at = before ? rest.indexOf(before) : rest.length
      return [...rest.slice(0, at), key, ...rest.slice(at)]
    })
    if (from !== status) setSaid(`${key} moved to ${statusOf(status).label}.`)
  }

  // A row edited out of the filter stays until the owner changes the query or reads again (rule 9).
  const [edited, setEdited] = useState<Set<string>>(new Set())
  const shown = useMemo(() => tasks.filter((t) => matches(t, query) || edited.has(t.key)), [tasks, query, edited])
  const onQuery = (q: string) => {
    setEdited(new Set())
    setQuery(q)
  }

  const unusable = STATE === "missing" || STATE === "old" || STATE === "fail"
  return (
    <div className="flex min-w-0 flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">Tasks</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">
            What you and your agents plan to do, kept by Memo. Agents read and update the same list.{" "}
            <a className="inline-flex items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover" href="#x">
              How tasks work
              <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
            </a>
          </p>
        </div>
        {!unusable && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" aria-hidden />}>
              Read again
            </Button>
            <ViewSwitch value={view} onChange={setView} />
            <Button size="sm" icon={<Plus className="size-4" aria-hidden />}>
              New task
            </Button>
          </div>
        )}
      </div>

      {STATE === "missing" ? (
        <Notice>
          <p>
            Tasks are kept by <b className="font-semibold text-ink">Memo</b>, which is not installed. Install it on the
            Tools page; you and your agents can then plan work here.
          </p>
          <Button size="sm">Go to Tools</Button>
        </Notice>
      ) : STATE === "old" ? (
        <Notice>
          <p>
            Memo <span className="font-mono">0.127.0</span> can list tasks but cannot move them between columns. Update
            Memo to <span className="font-mono">0.130.0</span> or newer to use this page.
          </p>
          <Button variant="primary" size="sm">
            Update Memo
          </Button>
        </Notice>
      ) : STATE === "fail" ? (
        <ErrorNotice
          detail="memo tasks list: another Memo process holds the store (store.busy)"
          action={<Button size="sm">Try again</Button>}
        >
          Could not read tasks. Another Memo sync holds the store; try again in a minute.
        </ErrorNotice>
      ) : (
        <>
          <Filters query={query} onQuery={onQuery} view={view} />
          {STATE === "conflict" && (
            <ErrorNotice action={<Button size="sm">Read again</Button>}>
              HRB-12 changed while you edited it: hermes moved it to Waiting at 09:16. Your change was not saved.
            </ErrorNotice>
          )}
          {STATE === "loading" ? (
            <LoadingRack />
          ) : STATE === "none" ? (
            <Empty />
          ) : view === "table" ? (
            <Table
              tasks={shown}
              all={tasks}
              open={open}
              onOpen={(k) => setOpen(open === k ? null : k)}
              onEdit={edit}
              failed={failed}
            />
          ) : (
            <Board tasks={shown} all={tasks} order={order} onMove={move} onEdit={edit} failed={failed} />
          )}
        </>
      )}
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  )
}

function ViewSwitch({ value, onChange }: { value: "table" | "kanban"; onChange: (v: "table" | "kanban") => void }) {
  const name = useId()
  const items = [
    ["table", "Table", <Rows3 key="t" className="size-4" aria-hidden />],
    ["kanban", "Board", <Columns3 key="k" className="size-4" aria-hidden />],
  ] as const
  return (
    <fieldset className="inline-flex h-8 items-center rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">View</legend>
      {items.map(([id, label, icon]) => (
        <label key={id} className="relative h-full">
          <input
            type="radio"
            name={name}
            checked={id === value}
            onChange={() => onChange(id)}
            className="peer sr-only"
          />
          <span className="flex h-full cursor-pointer items-center gap-[0.4rem] rounded-[0.35rem] px-[0.65rem] text-[0.875rem] text-ink-soft transition-colors duration-150 hover:text-ink peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
            {icon}
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

// ---- Filters: the query box and the pickers that write into it ----

function Filters({ query, onQuery, view }: { query: string; onQuery: (q: string) => void; view: string }) {
  const count = (field: string, value: string) =>
    TASKS.filter((t) => matches(t, setField(setField(query, field, []), field, [value]))).length
  const multi = (field: string, options: { value: string; label: string; hint?: string; mono?: boolean }[]) => ({
    selected: valuesOf(query, field),
    options: options.map((o) => ({ ...o, count: count(field, o.value) })),
    onChange: (vs: string[]) => onQuery(setField(query, field, vs)),
  })
  return (
    <div className="flex flex-col gap-[0.7rem]">
      <label className="relative block">
        <span className="sr-only">Search tasks</span>
        <Search className="pointer-events-none absolute top-1/2 left-[0.8rem] size-4 -translate-y-1/2 text-ink-dim" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search tasks, or filter: project:HRB assignee:you due:overdue ready:true"
          className="selectable h-[2.8rem] w-full rounded-[0.35rem] border border-line-strong bg-app pr-[0.8rem] pl-[2.3rem] font-mono text-[0.95rem] text-ink outline-none placeholder:font-sans placeholder:text-ink-dim focus:border-brand"
        />
      </label>
      <div className="flex flex-wrap items-center gap-[0.5rem]">
        <Picker
          label="Project"
          {...multi(
            "project",
            PROJECTS.map((p) => ({ value: p.key, label: p.name, hint: p.key })),
          )}
        />
        <Picker
          label="Assignee"
          {...multi("assignee", [
            ...PEOPLE.map((p) => ({ value: p.name, label: p.name })),
            { value: "none", label: "Nobody" },
          ])}
        />
        <Picker
          label="Priority"
          {...multi(
            "priority",
            PRIORITIES.map((p) => ({ value: String(p.value), label: p.label, hint: `P${p.value}` })),
          )}
        />
        <Picker
          label="Due"
          {...multi("due", [
            { value: "overdue", label: "Overdue" },
            { value: "week", label: "In the next 7 days" },
            { value: "none", label: "No date" },
          ])}
        />
        {view === "table" && (
          <Picker
            label="Status"
            {...multi(
              "state",
              STATUSES.map((s) => ({ value: s.id, label: s.label })),
            )}
          />
        )}
        <Toggle
          label="Can start now"
          on={valuesOf(query, "ready").includes("true")}
          onChange={(on) => onQuery(setField(query, "ready", on ? ["true"] : []))}
        />
        {query && (
          <Button variant="ghost" size="sm" onClick={() => onQuery("")}>
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

type Option = { value: string; label: string; hint?: string; mono?: boolean | undefined; count?: number; icon?: ReactNode }

/**
 * A searchable picker: a button that opens a box to type in over a list of choices. Several choices for filters, one
 * for editing a cell. Styled like `Select`; the real one goes to `src/ui/Picker.tsx`.
 */
function Picker(props: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (values: string[]) => void
  single?: boolean
  trigger?: ReactNode
  align?: "start" | "end"
}) {
  const { label, options, selected, onChange, single = false, trigger, align = "start" } = props
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()
  const shown = options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(text.toLowerCase()))
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", away)
    return () => document.removeEventListener("pointerdown", away)
  }, [open])
  const toggle = (v: string) => {
    if (single) {
      onChange([v])
      setOpen(false)
      return
    }
    onChange(selected.some((s) => same(s, v)) ? selected.filter((s) => !same(s, v)) : [...selected, v])
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setOpen(false)
    else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, shown.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const o = shown[active]
      if (o) toggle(o.value)
    }
  }
  const names = selected.map((v) => options.find((o) => same(o.value, v))?.label ?? v)
  return (
    <div ref={box} className="relative">
      {trigger ? (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen(!open)}
          className="-mx-[0.4rem] flex min-h-8 w-[calc(100%+0.8rem)] cursor-pointer items-center rounded-[0.35rem] px-[0.4rem] text-left hover:bg-app-3"
        >
          {trigger}
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cx(
            "flex h-8 cursor-pointer items-center gap-[0.4rem] rounded-[0.35rem] border pr-[0.4rem] pl-[0.6rem] text-[0.875rem] transition-colors duration-150",
            selected.length > 0
              ? "border-brand/50 bg-brand-soft text-ink"
              : "border-line-strong bg-app text-ink-soft hover:bg-app-2",
          )}
        >
          <span>{label}</span>
          {names.length > 0 && (
            <span className="max-w-[12rem] truncate font-medium text-ink">
              {names.length > 2 ? `${names.length} chosen` : names.join(", ")}
            </span>
          )}
          <ChevronDown className="size-4 text-ink-dim" aria-hidden />
        </button>
      )}
      {open && (
        <div
          className={cx(
            "reveal absolute top-[calc(100%+4px)] z-30 w-[17rem] rounded-[0.45rem] border border-line bg-app p-[0.3rem] shadow-panel",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: the picker opens to be typed in
            autoFocus
            role="combobox"
            aria-controls={listId}
            aria-expanded
            aria-activedescendant={`${listId}-${active}`}
            aria-label={`Find ${label.toLowerCase()}`}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
            placeholder={`Find ${label.toLowerCase()}`}
            className="mb-[0.3rem] h-8 w-full rounded-[0.35rem] border border-line-strong bg-app px-[0.55rem] text-[0.9rem] text-ink outline-none placeholder:text-ink-dim focus:border-brand"
          />
          <ul id={listId} role="listbox" aria-multiselectable={!single} className="max-h-[16rem] overflow-y-auto">
            {shown.map((o, i) => {
              const on = selected.some((v) => same(v, o.value))
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={on}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => toggle(o.value)}
                  onPointerEnter={() => setActive(i)}
                  className={cx(
                    "flex min-h-[2.1rem] cursor-pointer items-center gap-[0.55rem] rounded-[0.3rem] px-[0.5rem] text-[0.9rem]",
                    i === active && "bg-app-3",
                  )}
                >
                  <span
                    className={cx(
                      "grid size-[1rem] shrink-0 place-items-center rounded-[0.25rem] border",
                      single && "rounded-full",
                      on ? "border-brand bg-brand text-brand-ink" : "border-line-strong",
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
                  </span>
                  {o.icon}
                  <span className={cx("min-w-0 flex-1 truncate", o.mono && "font-mono text-[0.85rem]")}>{o.label}</span>
                  {o.hint && <span className="font-mono text-[0.8rem] text-ink-dim">{o.hint}</span>}
                  {o.count !== undefined && (
                    <span className="w-[1.5rem] text-right font-mono text-[0.8rem] tabular-nums text-ink-dim">
                      {o.count}
                    </span>
                  )}
                </li>
              )
            })}
            {shown.length === 0 && <li className="px-[0.5rem] py-[0.4rem] text-[0.9rem] text-ink-dim">No match</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---- Small pieces shared by both views ----

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

function DueText({ task }: { task: Task }) {
  if (!task.due) return <span className="text-ink-dim">—</span>
  const d = days(TODAY, task.due)
  const late = d < 0 && task.status !== "done"
  return (
    <span
      className={cx(
        "font-mono text-[0.9rem] tabular-nums",
        late ? "text-bad" : d <= 3 && task.status !== "done" ? "text-warn-ink" : "text-ink-soft",
      )}
    >
      {fmtDate(task.due)}
      {late && <span className="ml-[0.35rem] font-sans text-[0.85rem]">late</span>}
    </span>
  )
}

function PriorityMark({ value }: { value: number }) {
  const p = PRIORITIES[value]
  return (
    <span className="inline-flex items-center gap-[0.35rem] text-[0.9rem] text-ink-soft">
      <span
        aria-hidden
        className={cx(
          "inline-flex h-[0.8rem] items-end gap-[2px]",
          value === 0 ? "text-bad" : value === 1 ? "text-warn" : "text-ink-dim",
        )}
      >
        {[0, 1, 2].map((b) => (
          <span
            key={b}
            className={cx("w-[3px] rounded-[1px] bg-current", 3 - b > value - 1 ? "" : "opacity-25")}
            style={{ height: `${(b + 1) * 33}%` }}
          />
        ))}
      </span>
      {p?.label}
    </span>
  )
}

// "Doing" is a steady purple lamp: the pulsing busy lamp stays for an agent working on a task right now (DESIGN.md
// gains a sixth tone if the owner keeps this).
function StateLamp({ tone }: { tone: LampTone | "brand" }) {
  if (tone === "brand") return <span aria-hidden className="inline-block size-[0.85rem] shrink-0 rounded-full bg-brand" />
  return <Lamp tone={tone} size="sm" />
}

function Assignee({ person }: { person: Person | null }) {
  if (!person) return <span className="text-ink-dim">Nobody</span>
  return <span className="truncate text-[0.95rem]">{person.name}</span>
}

function Claim({ task }: { task: Task }) {
  if (!task.claim) return null
  return (
    <span className="inline-flex items-center gap-[0.35rem] text-[0.85rem] text-ink-soft">
      <Lamp tone="busy" size="sm" />
      <span className="font-mono">{task.claim}</span> is on it
    </span>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cx(
        "flex h-8 cursor-pointer items-center gap-[0.45rem] rounded-[0.35rem] border px-[0.6rem] text-[0.875rem] transition-colors duration-150",
        on ? "border-brand/50 bg-brand-soft text-ink" : "border-line-strong bg-app text-ink-soft hover:bg-app-2",
      )}
    >
      <span
        className={cx(
          "grid size-[0.95rem] place-items-center rounded-[0.25rem] border",
          on ? "border-brand bg-brand text-brand-ink" : "border-line-strong",
        )}
      >
        {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
      </span>
      {label}
    </button>
  )
}

const statusOptions = STATUSES.map((s) => ({ value: s.id, label: s.label, icon: <StateLamp tone={s.tone} /> }))
const priorityOptions = PRIORITIES.map((p) => ({ value: String(p.value), label: p.label, hint: `P${p.value}` }))
const peopleOptions = [
  ...PEOPLE.map((p) => ({ value: p.name, label: p.name })),
  { value: "", label: "Nobody" },
]

function Blocked({ task, all }: { task: Task; all: Task[] }) {
  const open = task.blockedBy.filter((k) => all.find((t) => t.key === k)?.status !== "done")
  if (open.length === 0) return null
  return (
    <span className="inline-flex items-center gap-[0.3rem] text-[0.85rem] text-warn-ink">
      <Lock className="size-[0.85rem]" aria-hidden />
      waits for <span className="font-mono">{open.join(", ")}</span>
    </span>
  )
}

// ---- Table view ----

type Sort = { by: "key" | "priority" | "due" | "status"; dir: 1 | -1 }

function Table(props: {
  tasks: Task[]
  all: Task[]
  open: string | null
  onOpen: (k: string) => void
  onEdit: (k: string, e: Edit) => void
  failed: string | null
}) {
  const { tasks, all, open, onOpen, onEdit, failed } = props
  const [sort, setSort] = useState<Sort>({ by: "priority", dir: 1 })
  // The order is fixed when the sort changes, not when a value does: an edited row stays where it is (rule 9).
  const [rank, setRank] = useState<string[]>([])
  useEffect(() => {
    const key = (t: Task) =>
      sort.by === "priority"
        ? t.priority
        : sort.by === "due"
          ? (t.due ?? "9999")
          : sort.by === "status"
            ? STATUSES.findIndex((s) => s.id === t.status)
            : t.key
    setRank(
      [...all]
        .sort((a, b) => (key(a) < key(b) ? -sort.dir : key(a) > key(b) ? sort.dir : a.key.localeCompare(b.key)))
        .map((t) => t.key),
    )
  }, [sort]) // biome-ignore lint: prototype
  const rows = [...tasks].sort((a, b) => rank.indexOf(a.key) - rank.indexOf(b.key))
  const head = (by: Sort["by"], label: string) => (
    <button
      type="button"
      onClick={() => setSort({ by, dir: sort.by === by ? (-sort.dir as 1 | -1) : 1 })}
      aria-sort={sort.by === by ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      className="inline-flex cursor-pointer items-center gap-1 hover:text-ink"
    >
      {label}
      {sort.by === by && (
        <ChevronDown className={cx("size-[0.85rem] transition-transform", sort.dir === -1 && "rotate-180")} />
      )}
    </button>
  )
  const grid =
    "grid grid-cols-[6.6rem_5.4rem_minmax(0,1fr)_4.6rem_7.6rem_6.6rem_6.2rem] items-center gap-x-[0.9rem] px-[1.3rem] xl:gap-x-[1.2rem]"
  if (rows.length === 0) return <NoMatch />
  return (
    <div role="table" aria-label="Tasks" className="rounded-[0.2rem] border border-line-strong bg-app">
      <div
        role="row"
        className={cx(grid, "sticky top-0 z-10 h-[2.6rem] border-line border-b bg-app text-[0.9rem] font-medium text-ink-dim")}
      >
        <span role="columnheader">{head("status", "Status")}</span>
        <span role="columnheader">{head("key", "Task")}</span>
        <span role="columnheader">
          <span className="sr-only">Title</span>
        </span>
        <span role="columnheader">Project</span>
        <span role="columnheader">Assignee</span>
        <span role="columnheader">{head("priority", "Priority")}</span>
        <span role="columnheader">{head("due", "Due")}</span>
      </div>
      {rows.map((t) => (
        <div key={t.key} role="rowgroup" className="border-line not-first:border-t [&+&]:border-t">
          <div role="row" className={cx(grid, "group min-h-[3.6rem] py-[0.45rem]", t.status === "done" && "text-ink-soft")}>
            <span role="cell">
              <Picker
                label={`Status of ${t.key}`}
                single
                options={statusOptions}
                selected={[t.status]}
                onChange={([v]) => onEdit(t.key, { status: v as Status })}
                trigger={
                  <span className="flex items-center gap-[0.5rem] text-[0.9rem]">
                    <StateLamp tone={statusOf(t.status).tone} />
                    {statusOf(t.status).label}
                  </span>
                }
              />
            </span>
            <span role="cell" className="font-mono text-[0.9rem] tabular-nums text-ink-soft">
              {t.key}
            </span>
            <span role="cell" className="min-w-0">
              <button
                type="button"
                aria-expanded={open === t.key}
                onClick={() => onOpen(t.key)}
                className="block w-full min-w-0 cursor-pointer text-left"
              >
                <span
                  className={cx(
                    "block truncate text-[1rem] font-medium group-hover:text-brand",
                    t.status === "done" && "font-normal line-through decoration-ink-dim/60",
                  )}
                >
                  {t.title}
                </span>
                <span className="flex flex-wrap gap-x-[0.9rem]">
                  <Blocked task={t} all={all} />
                  <Claim task={t} />
                </span>
              </button>
            </span>
            <span role="cell" className="min-w-0">
              <Picker
                label={`Project of ${t.key}`}
                single
                options={PROJECTS.map((p) => ({ value: p.key, label: p.name, hint: p.key }))}
                selected={[t.project]}
                onChange={([v]) => onEdit(t.key, { project: v ?? t.project })}
                trigger={<span className="truncate text-[0.95rem] text-ink-soft">{t.project}</span>}
              />
            </span>
            <span role="cell" className="min-w-0">
              <Picker
                label={`Assignee of ${t.key}`}
                single
                options={peopleOptions}
                selected={[t.assignee?.name ?? ""]}
                onChange={([v]) => onEdit(t.key, { assignee: PEOPLE.find((p) => p.name === v) ?? null })}
                trigger={<Assignee person={t.assignee} />}
              />
            </span>
            <span role="cell">
              <Picker
                label={`Priority of ${t.key}`}
                single
                options={priorityOptions}
                selected={[String(t.priority)]}
                onChange={([v]) => onEdit(t.key, { priority: Number(v) })}
                trigger={<PriorityMark value={t.priority} />}
              />
            </span>
            <span role="cell">
              <DuePicker task={t} onEdit={onEdit} />
            </span>
          </div>
          {failed === t.key && (
            <div className="px-[1.3rem] pb-[0.6rem]">
              <ErrorNotice inline>Memo did not save the change: the store is busy (store.busy). Nothing changed.</ErrorNotice>
            </div>
          )}
          <Collapse open={open === t.key}>
            <Details task={t} all={all} />
          </Collapse>
        </div>
      ))}
    </div>
  )
}

function DuePicker({ task, onEdit }: { task: Task; onEdit: (k: string, e: Edit) => void }) {
  const add = (n: number) => {
    const d = new Date(`${TODAY}T12:00:00`)
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }
  const choices: Option[] = [
    { value: TODAY, label: "Today", hint: fmtDate(TODAY) },
    { value: add(1), label: "Tomorrow", hint: fmtDate(add(1)) },
    { value: add(2), label: "Monday", hint: fmtDate(add(2)) },
    { value: add(7), label: "In a week", hint: fmtDate(add(7)) },
    { value: "", label: "No date" },
  ]
  return (
    <Picker
      label={`Due date of ${task.key}`}
      single
      align="end"
      options={choices}
      selected={[task.due ?? ""]}
      onChange={([v]) => onEdit(task.key, { due: v || null })}
      trigger={<DueText task={task} />}
    />
  )
}

function Details({ task, all }: { task: Task; all: Task[] }) {
  return (
    <div className="grid gap-[1.6rem] border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-[0.8rem]">
        <label className="flex flex-col gap-[0.35rem]">
          <span className="text-[0.9rem] font-medium text-ink-dim">Title</span>
          <input
            defaultValue={task.title}
            className="selectable h-[2.4rem] rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] text-[0.95rem] text-ink outline-none focus:border-brand"
          />
        </label>
        <label className="flex flex-col gap-[0.35rem]">
          <span className="text-[0.9rem] font-medium text-ink-dim">Notes</span>
          <textarea
            rows={3}
            defaultValue={task.body}
            placeholder="Anything you or an agent should know"
            className="selectable rounded-[0.35rem] border border-line-strong bg-app px-[0.625rem] py-[0.5rem] text-[0.95rem] text-ink outline-none placeholder:text-ink-dim focus:border-brand"
          />
        </label>
        <div className="flex gap-2">
          <Button size="sm">Save</Button>
          <Button size="sm" variant="ghost">
            Cancel
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-[1.1rem]">
        <section className="flex flex-col gap-[0.4rem]">
          <h3 className="flex items-center gap-[0.4rem] text-[0.9rem] font-medium text-ink-dim">
            <GitBranch className="size-[0.95rem]" aria-hidden /> Depends on
          </h3>
          {task.blockedBy.length === 0 ? (
            <p className="text-[0.95rem] text-ink-soft">Nothing. It can start now.</p>
          ) : (
            task.blockedBy.map((k) => {
              const b = all.find((t) => t.key === k)
              return (
                <p key={k} className="flex items-center gap-[0.5rem] text-[0.95rem]">
                  <StateLamp tone={statusOf(b?.status ?? "open").tone} />
                  <span className="font-mono text-[0.9rem]">{k}</span>
                  <span className="truncate text-ink-soft">{b?.title}</span>
                </p>
              )
            })
          )}
          <button type="button" className="inline-flex w-fit items-center gap-[0.3rem] text-[0.9rem] font-medium text-brand hover:text-brand-hover">
            <Link2 className="size-[0.9rem]" aria-hidden /> Add a task it waits for
          </button>
        </section>
        <section className="flex flex-col gap-[0.4rem]">
          <h3 className="flex items-center gap-[0.4rem] text-[0.9rem] font-medium text-ink-dim">
            <CalendarDays className="size-[0.95rem]" aria-hidden /> History
          </h3>
          <ul className="flex flex-col gap-[0.25rem] text-[0.9rem]">
            {(task.history.length ? task.history : [["—", "No changes yet"] as [string, string]]).map(([at, what]) => (
              <li key={at + what} className="grid grid-cols-[6.6rem_minmax(0,1fr)] gap-x-3">
                <span className="font-mono tabular-nums text-ink-dim">{at}</span>
                <span className="text-ink-soft">{what}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

// ---- Board view ----

type Drag = { key: string; x: number; y: number; dx: number; dy: number; w: number; to: Status; before: string | null }

function Board(props: {
  tasks: Task[]
  all: Task[]
  order: string[]
  onMove: (key: string, status: Status, before: string | null) => void
  onEdit: (k: string, e: Edit) => void
  failed: string | null
}) {
  const { tasks, all, order, onMove, failed } = props
  const [drag, setDrag] = useState<Drag | null>(null)
  // Keyboard move: Space lifts the focused card, arrows carry it, Space drops, Escape puts it back.
  const [held, setHeld] = useState<{ key: string; to: Status; index: number } | null>(null)
  const [said, setSaid] = useState("")
  const press = useRef<{ key: string; x: number; y: number; el: HTMLElement } | null>(null)
  // A held card re-mounts in its new column; focus follows it so the next key still reaches it.
  useEffect(() => {
    if (held) document.querySelector<HTMLElement>(`[data-card="${held.key}"]`)?.focus({ preventScroll: true })
  }, [held])

  const column = (s: Status) =>
    tasks.filter((t) => t.status === s).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))

  const target = (x: number, y: number, key: string): Pick<Drag, "to" | "before"> | null => {
    const col = document.elementsFromPoint(x, y).find((el) => el instanceof HTMLElement && el.dataset.column) as
      | HTMLElement
      | undefined
    if (!col) return null
    const to = col.dataset.column as Status
    const cards = [...col.querySelectorAll<HTMLElement>("[data-card]")].filter((c) => c.dataset.card !== key)
    const next = cards.find((c) => {
      const r = c.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    return { to, before: next?.dataset.card ?? null }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, key: string) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button,a,input")) return
    press.current = { key, x: e.clientX, y: e.clientY, el: e.currentTarget }
  }
  useEffect(() => {
    const onMoveEv = (e: PointerEvent) => {
      const p = press.current
      if (!p) return
      // A short movement is a click or a text selection, not a drag.
      if (!drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return
      const r = p.el.getBoundingClientRect()
      const t = target(e.clientX, e.clientY, p.key)
      window.getSelection()?.removeAllRanges()
      setDrag((d) => ({
        key: p.key,
        x: e.clientX,
        y: e.clientY,
        dx: d?.dx ?? p.x - r.left,
        dy: d?.dy ?? p.y - r.top,
        w: d?.w ?? r.width,
        to: t?.to ?? d?.to ?? (all.find((x) => x.key === p.key)?.status as Status),
        before: t ? t.before : (d?.before ?? null),
      }))
    }
    const onUp = () => {
      if (drag) onMove(drag.key, drag.to, drag.before)
      press.current = null
      setDrag(null)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && drag) {
        press.current = null
        setDrag(null)
      }
    }
    window.addEventListener("pointermove", onMoveEv)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointermove", onMoveEv)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("keydown", onKey)
    }
  })

  const onCardKey = (e: KeyboardEvent<HTMLElement>, t: Task) => {
    const cols = STATUSES.map((s) => s.id)
    if (!held) {
      if (e.key === " ") {
        e.preventDefault()
        setHeld({ key: t.key, to: t.status, index: column(t.status).findIndex((x) => x.key === t.key) })
        setSaid(`Picked up ${t.key}. Arrow keys move it, Space drops it, Escape puts it back.`)
      }
      return
    }
    if (held.key !== t.key) return
    e.preventDefault()
    const others = (s: Status) => column(s).filter((x) => x.key !== t.key)
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const i = cols.indexOf(held.to) + (e.key === "ArrowRight" ? 1 : -1)
      const to = cols[Math.max(0, Math.min(cols.length - 1, i))] as Status
      const index = Math.min(held.index, others(to).length)
      setHeld({ ...held, to, index })
      setSaid(`${statusOf(to).label}, place ${index + 1} of ${others(to).length + 1}.`)
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const index = Math.max(0, Math.min(others(held.to).length, held.index + (e.key === "ArrowDown" ? 1 : -1)))
      setHeld({ ...held, index })
      setSaid(`Place ${index + 1} of ${others(held.to).length + 1}.`)
    } else if (e.key === " " || e.key === "Enter") {
      onMove(t.key, held.to, others(held.to)[held.index]?.key ?? null)
      setHeld(null)
      setSaid(`Dropped ${t.key} in ${statusOf(held.to).label}.`)
    } else if (e.key === "Escape") {
      setHeld(null)
      setSaid(`${t.key} put back.`)
    }
  }

  const lifted = drag ?? (held ? { key: held.key, to: held.to, before: null } : null)
  const dragged = drag ? all.find((t) => t.key === drag.key) : null
  return (
    <>
      <div className="grid grid-cols-[repeat(4,minmax(12rem,1fr))] gap-[0.9rem] overflow-x-auto pb-[0.4rem] xl:gap-[1.2rem]">
        {STATUSES.map((s) => {
          const cards = column(s.id)
          const heldHere = held && held.to === s.id ? held : null
          const visible = cards.filter((c) => !(heldHere && c.key === held?.key) && !(held && held.key === c.key && held.to !== s.id))
          const shownCards = heldHere
            ? [...visible.slice(0, heldHere.index), all.find((x) => x.key === heldHere.key), ...visible.slice(heldHere.index)].filter(
                (x): x is Task => Boolean(x),
              )
            : cards.filter((c) => !(held && held.key === c.key))
          const over = drag?.to === s.id
          return (
            <section
              key={s.id}
              data-column={s.id}
              aria-label={`${s.label}, ${cards.length} tasks`}
              className={cx(
                "flex min-h-[24rem] min-w-0 flex-col rounded-[0.2rem] border bg-app transition-colors duration-150",
                over ? "border-brand/60" : "border-line-strong",
              )}
            >
              <h2 className="flex h-[3rem] items-center gap-[0.55rem] border-line border-b px-[1rem]">
                <StateLamp tone={s.tone} />
                <span className="text-[1rem] font-semibold">{s.label}</span>
                <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{cards.length}</span>
                {(s.id === "done" || s.id === "dismissed") && (
                  <span className="ml-auto text-[0.85rem] text-ink-dim">14 days</span>
                )}
              </h2>
              <ul className="flex flex-1 flex-col">
                {shownCards.map((t) => (
                  <li key={t.key} className="contents">
                    {drag && drag.to === s.id && drag.before === t.key && <DropLine />}
                    <Card
                      task={t}
                      all={all}
                      ghost={drag?.key === t.key}
                      held={held?.key === t.key}
                      failed={failed === t.key}
                      onPointerDown={(e) => onPointerDown(e, t.key)}
                      onKeyDown={(e) => onCardKey(e, t)}
                      onStatus={(st) => onMove(t.key, st, null)}
                    />
                  </li>
                ))}
                {drag && drag.to === s.id && drag.before === null && <DropLine />}
                {cards.length === 0 && !lifted && (
                  <li className="px-[1rem] py-[1rem] text-[0.9rem] text-ink-dim">Nothing here. Drag a task in.</li>
                )}
              </ul>
            </section>
          )
        })}
      </div>
      {drag && dragged && (
        <div
          aria-hidden
          className={cx(
            "pointer-events-none fixed z-50 rounded-[0.35rem] border border-brand/50 bg-app shadow-panel",
            !reducedMotion() && "rotate-[1.2deg]",
          )}
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w }}
        >
          <CardBody task={dragged} all={all} />
        </div>
      )}
      <p aria-live="assertive" className="sr-only">
        {said}
      </p>
    </>
  )
}

function DropLine() {
  return <li aria-hidden className="mx-[0.6rem] my-[-1px] h-[2px] rounded-full bg-brand" />
}

function Card(props: {
  task: Task
  all: Task[]
  ghost: boolean
  held: boolean
  failed: boolean
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onStatus: (s: Status) => void
}) {
  const { task, all, ghost, held, failed } = props
  return (
    // biome-ignore lint/a11y/useSemanticElements: a card holds buttons, so it cannot be one
    <div
      role="button"
      tabIndex={0}
      data-card={task.key}
      aria-roledescription="draggable task"
      aria-label={`${task.key} ${task.title}`}
      onPointerDown={props.onPointerDown}
      onKeyDown={props.onKeyDown}
      className={cx(
        "group relative cursor-grab touch-none border-line border-b transition-[background-color,opacity,box-shadow] duration-150 select-none [-webkit-user-select:none] last:border-b-0 hover:bg-app-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
        ghost && "opacity-35 [&_*]:invisible bg-app-3 outline-dashed outline-1 -outline-offset-4 outline-line-strong",
        held && "z-10 bg-app shadow-panel outline-2 outline-brand",
      )}
    >
      <CardBody task={task} all={all} onStatus={props.onStatus} />
      {failed && (
        <div className="px-[1rem] pb-[0.6rem]">
          <ErrorNotice inline>Not moved: the store is busy.</ErrorNotice>
        </div>
      )}
    </div>
  )
}

function CardBody({ task, all, onStatus }: { task: Task; all: Task[]; onStatus?: (s: Status) => void }) {
  return (
    <div className="flex flex-col gap-[0.4rem] px-[1rem] py-[0.75rem]">
      <div className="flex items-center gap-[0.5rem]">
        <GripVertical
          className="absolute top-[0.85rem] left-[0.1rem] size-[0.85rem] text-ink-dim opacity-0 group-hover:opacity-100"
          aria-hidden
        />
        <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{task.key}</span>
        <span className="ml-auto">
          <PriorityMark value={task.priority} />
        </span>
      </div>
      <p className={cx("line-clamp-3 text-[0.95rem] font-medium leading-snug", task.status === "done" && "text-ink-soft")}>
        {task.title}
      </p>
      <Blocked task={task} all={all} />
      <Claim task={task} />
      <div className="flex items-center gap-[0.6rem] text-[0.9rem] text-ink-soft">
        <span className="min-w-0 truncate">
          <Assignee person={task.assignee} />
        </span>
        <span className="ml-auto">{task.due && <DueText task={task} />}</span>
        {onStatus && (
          <Picker
            label={`Move ${task.key}`}
            single
            align="end"
            options={statusOptions}
            selected={[task.status]}
            onChange={([v]) => onStatus(v as Status)}
            trigger={
              <span className="flex items-center text-ink-dim" title="Move to…">
                <ChevronDown className="size-4" aria-hidden />
              </span>
            }
          />
        )}
      </div>
    </div>
  )
}

// ---- States ----

function LoadingRack() {
  return (
    <div className="rounded-[0.2rem] border border-line-strong bg-app">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex h-[3.6rem] items-center gap-[0.9rem] border-line px-[1.3rem] not-first:border-t">
          <Skeleton className="size-[0.85rem] rounded-full" />
          <Skeleton className="h-[0.9rem] w-[4rem]" />
          <Skeleton className="h-[1rem] w-[45%]" />
        </div>
      ))}
    </div>
  )
}

function Empty() {
  return (
    <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-[0.95rem] text-ink-soft">
      <p className="font-medium text-ink">No tasks yet.</p>
      <p className="mt-1 max-w-[70ch]">
        Add one with New task, or ask an agent connected to Memo: "remind me to send Kai the pricing table on Monday".
        Tasks you and your agents add appear here.
      </p>
    </div>
  )
}

function NoMatch() {
  return (
    <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.2rem] text-[0.95rem] text-ink-soft">
      <p>
        No task matches. <Pill>state:done</Pill> hides open work; remove a filter above, or press{" "}
        <span className="font-medium text-ink">Clear</span>.
      </p>
    </div>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.1rem] text-[0.95rem] text-ink-soft">
      {children}
    </div>
  )
}


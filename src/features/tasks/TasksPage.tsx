import { Columns3, ExternalLink, Plus, RefreshCw, Rows3 } from "lucide-react"
import { type ReactNode, useEffect } from "react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton, StableText } from "@/ui/Skeleton"
import { openTool } from "../tools/go"
import { useTools } from "../tools/store"
import { Filters } from "./Filters"
import { taskMessages } from "./messages"
import { NewTask } from "./NewTask"
import { Note } from "./Note"
import { useTasks, type View } from "./store"
import { TaskBoard } from "./TaskBoard"
import { TaskTable } from "./TaskTable"

const GUIDE = "https://github.com/WireCatLabs/cli-memo/blob/main/docs/tasks.md"

export function TasksPage() {
  const m = useMessages(taskMessages)
  const unusable = useTasks((s) => s.unusable)
  const loaded = useTasks((s) => s.loaded)
  const reading = useTasks((s) => s.reading)
  const error = useTasks((s) => s.error)
  const view = useTasks((s) => s.view)
  const creating = useTasks((s) => s.creating)

  useEffect(() => {
    void useTasks.getState().load()
  }, [])

  const usable = loaded && !unusable && !error
  return (
    <div className="flex min-w-0 flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] leading-none font-extrabold tracking-[-0.035em]">{m.title}</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">
            {m.intro}{" "}
            <button
              type="button"
              onClick={() => void platform.openUrl(GUIDE)}
              className="inline-flex cursor-pointer items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
            >
              {m.guide}
              <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
            </button>
          </p>
        </div>
        <div className={cx("flex items-center gap-2", !usable && "invisible")} aria-hidden={!usable || undefined}>
          <Button
            variant="ghost"
            size="sm"
            disabled={reading}
            onClick={() => void useTasks.getState().load()}
            icon={<RefreshCw className={cx("size-4", reading && "motion-safe:animate-spin")} aria-hidden />}
          >
            <StableText value={reading ? m.reading : m.readAgain} variants={[m.reading, m.readAgain]} />
          </Button>
          <ViewSwitch value={view} onChange={(v) => useTasks.getState().setView(v)} />
          <Button
            size="sm"
            aria-expanded={creating}
            onClick={() => useTasks.getState().startCreate(!creating)}
            icon={<Plus className="size-4" aria-hidden />}
          >
            {m.newTask}
          </Button>
        </div>
      </div>
      <Body />
      <Note />
    </div>
  )
}

function Body() {
  const m = useMessages(taskMessages)
  const unusable = useTasks((s) => s.unusable)
  const loaded = useTasks((s) => s.loaded)
  const error = useTasks((s) => s.error)
  const install = useTools((s) => s.install)

  if (unusable?.kind === "missing") {
    return (
      <Notice>
        <p className="max-w-[70ch]">{m.missing}</p>
        <Button size="sm" onClick={() => openTool("memo")}>
          {m.goTools}
        </Button>
      </Notice>
    )
  }
  if (unusable?.kind === "old") {
    return (
      <Notice>
        <p className="max-w-[70ch]">{m.old(unusable.version, unusable.need)}</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            install("memo")
            openTool("memo")
          }}
        >
          {m.update}
        </Button>
      </Notice>
    )
  }
  if (error) {
    return (
      <ErrorNotice
        detail={error}
        action={
          <Button size="sm" onClick={() => void useTasks.getState().load()}>
            {m.tryAgain}
          </Button>
        }
      >
        {m.readFailed}
      </ErrorNotice>
    )
  }
  return (
    <>
      <Filters />
      <More />
      {loaded ? <Rack /> : <Loading />}
    </>
  )
}

/** More tasks match than one read holds. */
function More() {
  const m = useMessages(taskMessages)
  const more = useTasks((s) => s.more)
  const total = useTasks((s) => s.total)
  return more ? <p className="-mt-[0.6rem] text-[0.9rem] text-ink-soft">{m.more(total)}</p> : null
}

function Rack() {
  const m = useMessages(taskMessages)
  const view = useTasks((s) => s.view)
  const tasks = useTasks((s) => s.tasks)
  const query = useTasks((s) => s.query)
  const badQuery = useTasks((s) => s.badQuery)
  const creating = useTasks((s) => s.creating)
  const form = (
    <Collapse open={creating}>
      <NewTask />
    </Collapse>
  )

  if (badQuery) {
    return (
      <Frame>
        <p className="text-bad">{m.badQuery}</p>
        <p className="selectable mt-1 font-mono text-[0.9rem] text-ink-soft">{badQuery}</p>
      </Frame>
    )
  }
  if (tasks.length === 0) {
    return (
      <div className="rounded-[0.2rem] border border-line-strong bg-app">
        {form}
        <div className="px-[1.3rem] py-[1.3rem] text-[0.95rem] text-ink-soft">
          {query.trim() ? (
            <p>
              {m.noMatch}{" "}
              <Button size="sm" variant="ghost" onClick={() => useTasks.getState().setQuery("")}>
                {m.clear}
              </Button>
            </p>
          ) : (
            <>
              <p className="font-medium text-ink">{m.empty}</p>
              <p className="mt-1 max-w-[70ch]">{m.emptyBody}</p>
            </>
          )}
        </div>
      </div>
    )
  }
  if (view === "board") {
    return (
      <div className="flex flex-col gap-[0.9rem]">
        {creating && <div className="rounded-[0.2rem] border border-line-strong bg-app">{form}</div>}
        <TaskBoard />
      </div>
    )
  }
  return <TaskTable top={form} />
}

function Loading() {
  const m = useMessages(taskMessages)
  return (
    <div className="rounded-[0.2rem] border border-line-strong bg-app">
      <div className="h-[2.6rem] border-line border-b" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex h-[3.6rem] items-center gap-[0.9rem] border-line px-[1.3rem] not-first:border-t">
          <Skeleton className="size-[0.85rem] rounded-full" {...(i === 0 ? { label: m.reading } : {})} />
          <Skeleton className="h-[0.9rem] w-[4rem]" />
          <Skeleton className="h-[1rem] w-[45%]" />
        </div>
      ))}
    </div>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.2rem] text-[0.95rem]">
      {children}
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

function ViewSwitch({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const m = useMessages(taskMessages)
  const items = [
    ["table", m.table, <Rows3 key="t" className="size-4" aria-hidden />],
    ["board", m.board, <Columns3 key="b" className="size-4" aria-hidden />],
  ] as const
  return (
    <fieldset className="inline-flex h-8 items-center rounded-[0.45rem] border-0 bg-app-3 p-[3px]">
      <legend className="sr-only">{m.view}</legend>
      {items.map(([id, label, icon]) => (
        <label key={id} className="relative h-full">
          <input
            type="radio"
            name="tasks-view"
            checked={id === value}
            onChange={() => onChange(id)}
            className="peer sr-only"
          />
          <span className="flex h-full cursor-pointer items-center gap-[0.4rem] rounded-[0.35rem] px-[0.65rem] text-[0.875rem] text-ink-soft transition-colors duration-150 peer-checked:bg-app peer-checked:text-ink peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-brand hover:text-ink">
            {icon}
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

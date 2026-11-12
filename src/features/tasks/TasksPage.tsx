import { Columns3, Plus, Rows3 } from "lucide-react"
import { useEffect } from "react"
import { gapFromRead } from "@/domain/needs"
import { type Lang, useLang, useMessages } from "@/i18n"
import { DemoNote } from "@/shared/DemoNote"
import { Page, PageHeader } from "@/shared/Page"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { EmptyState } from "@/ui/EmptyState"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { RefreshButton } from "@/ui/RefreshButton"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { Filters } from "./Filters"
import { taskMessages } from "./messages"
import { NewTask } from "./NewTask"
import { Note } from "./Note"
import { useTasks, type View } from "./store"
import { TaskBoard } from "./TaskBoard"
import { TaskDialog } from "./TaskDialog"
import { TaskTable } from "./TaskTable"

const guide = (lang: Lang) => `https://wirecat.dev/${lang}/docs/memo/tasks`

export function TasksPage() {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const unusable = useTasks((s) => s.unusable)
  const loaded = useTasks((s) => s.loaded)
  const reading = useTasks((s) => s.reading)
  const error = useTasks((s) => s.error)
  const view = useTasks((s) => s.view)
  const demo = useTasks((s) => s.demo)

  useEffect(() => {
    if (!demo) useTasks.getState().visit()
  }, [demo])

  const usable = loaded && !unusable && !error
  return (
    <Page fill={view === "board"}>
      <PageHeader
        title={m.title}
        section="tasks"
        intro={m.intro}
        compact
        guide={{ label: m.guide, href: guide(lang) }}
        actions={
          <div
            className={cx("flex flex-wrap items-center gap-2", !usable && "invisible")}
            aria-hidden={!usable || undefined}
            inert={demo || undefined}
          >
            <RefreshButton
              busy={reading}
              onClick={() => void useTasks.getState().load()}
              label={m.readAgain}
              busyLabel={m.reading}
            />
            <Segmented<View>
              size="md"
              tour="tasks-view"
              label={m.view}
              value={view}
              onChange={(v) => useTasks.getState().setView(v)}
              options={[
                { value: "table", label: m.table, icon: <Rows3 className="size-4" aria-hidden /> },
                { value: "board", label: m.board, icon: <Columns3 className="size-4" aria-hidden /> },
              ]}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => useTasks.getState().startCreate(true)}
              icon={<Plus className="size-4" aria-hidden />}
            >
              {m.newTask}
            </Button>
          </div>
        }
      />
      {demo && <DemoNote />}
      <div inert={demo || undefined} className="contents">
        <Body />
        <Note />
      </div>
      <NewTask />
    </Page>
  )
}

function Body() {
  const m = useMessages(taskMessages)
  const unusable = useTasks((s) => s.unusable)
  const loaded = useTasks((s) => s.loaded)
  const error = useTasks((s) => s.error)

  const gap = gapFromRead(unusable)
  if (gap) return <ToolNeeded gap={gap} />
  if (error) {
    return (
      <ErrorNotice
        raw={error}
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
      <TaskDialog />
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

  if (badQuery) {
    return (
      <ErrorNotice tone="warn" detail={<span className="font-mono">{badQuery}</span>}>
        {m.badQuery}
      </ErrorNotice>
    )
  }
  if (tasks.length === 0) {
    return query.trim() ? (
      <EmptyState
        action={
          <Button size="sm" onClick={() => useTasks.getState().setQuery("")}>
            {m.clear}
          </Button>
        }
      >
        {m.noMatch}
      </EmptyState>
    ) : (
      <EmptyState title={m.empty}>{m.emptyBody}</EmptyState>
    )
  }
  if (view === "board") return <TaskBoard />
  return <TaskTable />
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

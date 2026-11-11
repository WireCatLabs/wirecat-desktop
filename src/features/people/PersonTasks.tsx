import { useEffect } from "react"
import { tasksQuery } from "@/domain/tasks"
import { openTarget } from "@/features/links"
import { StateText, useTasks } from "@/features/tasks"
import { useMessages } from "@/i18n"
import { useNav } from "@/shared/nav"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

const SHOWN = 10

/** The tasks assigned to this person; a task opens in the Tasks page's dialog, and all of them on that page. */
export function PersonTasks({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const got = usePeople((s) => s.tasks[reference])
  useEffect(() => {
    void usePeople.getState().loadTasks(reference)
  }, [reference])
  const leave = () => usePeople.getState().reveal(null)
  const toTasks = () => {
    leave()
    useNav.getState().go("tasks")
    useTasks.getState().setQuery(tasksQuery([reference]))
  }

  const read = got?.state === "ready" ? got.read : null
  if (read?.kind === "ready" && read.total === 0) return null
  return (
    <section className="flex flex-col gap-[0.5rem]">
      <h3 className="font-medium">
        {m.tasksTitle}
        {read?.kind === "ready" && <span className="ml-2 font-normal text-ink-soft tabular-nums">{read.total}</span>}
      </h3>
      {!got || got.state === "loading" ? (
        <Skeleton className="h-[2.4rem] w-full" />
      ) : got.state === "failed" ? (
        <ErrorNotice
          raw={got.error}
          inline
          action={
            <Button size="sm" onClick={() => void usePeople.getState().loadTasks(reference)}>
              {m.readAgain}
            </Button>
          }
        >
          {m.tasksFailed}
        </ErrorNotice>
      ) : read?.kind === "badQuery" ? (
        <ErrorNotice
          raw={read.message}
          inline
          action={
            <Button size="sm" onClick={toTasks}>
              {m.tasksOpenPage}
            </Button>
          }
        >
          {m.tasksRefused}
        </ErrorNotice>
      ) : read?.kind === "old" || read?.kind === "missing" ? (
        <ErrorNotice
          inline
          action={
            <Button size="sm" onClick={toTasks}>
              {m.tasksOpenPage}
            </Button>
          }
        >
          {m.tasksNeedMemo}
        </ErrorNotice>
      ) : read?.kind === "ready" ? (
        <>
          <ul className="flex flex-col rounded-[0.45rem] border border-line">
            {read.tasks.slice(0, SHOWN).map((t) => (
              <li key={t.key} className="border-line not-first:border-t">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    leave()
                    void openTarget({ type: "task", id: t.key })
                  }}
                  className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)_8rem] items-center gap-3 px-[0.9rem] py-[0.5rem] text-left hover:bg-app-3 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span className="font-mono text-[0.85rem] text-ink-dim">{t.key}</span>
                  <span className="truncate">{t.title}</span>
                  <StateText state={t.state} />
                </button>
              </li>
            ))}
          </ul>
          {(read.total > SHOWN || read.more) && (
            <span>
              <Button size="sm" onClick={toTasks}>
                {m.tasksAll(read.total)}
              </Button>
            </span>
          )}
        </>
      ) : null}
    </section>
  )
}

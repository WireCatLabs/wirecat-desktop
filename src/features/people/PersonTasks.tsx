import { useEffect, useState } from "react"
import { STATES, setField } from "@/domain/tasks"
import { openTarget } from "@/features/links"
import { StateText, useTasks } from "@/features/tasks"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { TaskRead } from "@/platform/task-schemas"
import { useNav } from "@/shared/nav"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

const SHOWN = 10

/**
 * Every state, closed ones too: the table's count is memo's every task assigned to them, and memo's own search
 * otherwise leaves closed tasks out.
 */
const queryFor = (ref: string) => `${setField("", "assignee", [ref])} state:(${STATES.join(" OR ")})`

type Read = { state: "loading" } | { state: "ready"; read: TaskRead } | { state: "failed"; error: string }

/** The tasks assigned to this person; a task opens in the Tasks page's dialog, and the rest of them on that page. */
export function PersonTasks({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const [got, setGot] = useState<Read>({ state: "loading" })
  useEffect(() => {
    let live = true
    platform
      .taskList(queryFor(reference))
      .then((read) => live && setGot({ state: "ready", read }))
      .catch((e: unknown) => live && setGot({ state: "failed", error: e instanceof Error ? e.message : String(e) }))
    return () => {
      live = false
    }
  }, [reference])
  const leave = () => usePeople.getState().reveal(null)

  if (got.state === "ready" && (got.read.kind !== "ready" || got.read.total === 0)) return null
  return (
    <section className="flex flex-col gap-[0.5rem]">
      <h3 className="font-medium">
        {m.tasksTitle}
        {got.state === "ready" && got.read.kind === "ready" && (
          <span className="ml-2 font-normal text-ink-soft tabular-nums">{got.read.total}</span>
        )}
      </h3>
      {got.state === "loading" ? (
        <Skeleton className="h-[2.4rem] w-full" />
      ) : got.state === "failed" ? (
        <ErrorNotice raw={got.error} inline>
          {m.tasksFailed}
        </ErrorNotice>
      ) : got.read.kind === "ready" ? (
        <>
          <ul className="flex flex-col rounded-[0.45rem] border border-line">
            {got.read.tasks.slice(0, SHOWN).map((t) => (
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
          {(got.read.total > SHOWN || got.read.more) && (
            <span>
              <Button
                size="sm"
                onClick={() => {
                  leave()
                  useNav.getState().go("tasks")
                  useTasks.getState().setQuery(queryFor(reference))
                }}
              >
                {m.tasksAll(got.read.total)}
              </Button>
            </span>
          )}
        </>
      ) : null}
    </section>
  )
}

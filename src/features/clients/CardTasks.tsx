import { useQuery } from "@tanstack/react-query"
import { referenceOf } from "@/domain/links"
import { tasksQuery } from "@/domain/tasks"
import { openTarget } from "@/features/links"
import { DueText, StateText, useTasks } from "@/features/tasks"
import { useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import type { TaskRead } from "@/platform/task-schemas"
import { useNav } from "@/shared/nav"
import { Button } from "@/ui/Button"
import { CopyRef } from "@/ui/CopyRef"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { clientMessages } from "./messages"
import { useClients } from "./store"

const SHOWN = 10

const rawOf = (error: Error | null, got: TaskRead | undefined) => {
  const raw = error?.message ?? (got?.kind === "badQuery" ? got.message : null)
  return raw ? { raw } : {}
}

/** The client's contact people; the CRM user responsible for the card is the owner's side, not the client. */
export const contactRefs = (card: CrmCard) => [
  ...new Set(card.people.flatMap((p) => (p.role !== "owner" && p.ref ? [p.ref] : []))),
]

/**
 * The tasks of the card's contact people, as memo's task search finds them by assignee. memo has no field yet for a
 * deal's or a company's own tasks, so those are not asked for (and not guessed from every task here).
 */
export function CardTasks({ card }: { card: CrmCard }) {
  const m = useMessages(clientMessages)
  const refs = contactRefs(card)
  const query = refs.length ? tasksQuery(refs) : null
  const read = useQuery({
    queryKey: ["clients", "tasks", query],
    queryFn: () => platform.taskList(query ?? ""),
    enabled: query !== null,
  })
  const leave = () => useClients.getState().setOpen(null)
  const toTasks = () => {
    leave()
    useNav.getState().go("tasks")
    if (query) useTasks.getState().setQuery(query)
  }
  const got = read.data

  return (
    <section className="flex flex-col gap-[0.5rem]">
      <h3 className="font-medium">
        {m.tasksTitle}
        {got?.kind === "ready" && got.total > 0 && (
          <span className="ml-2 font-normal text-ink-soft tabular-nums">{got.total}</span>
        )}
      </h3>
      {query === null ? (
        <p className="text-[0.9rem] text-ink-dim">{m.tasksNoPeople}</p>
      ) : read.isPending ? (
        <Skeleton className="h-[2.4rem] w-full" />
      ) : read.error || (got && got.kind !== "ready") ? (
        <ErrorNotice
          {...rawOf(read.error, got)}
          inline
          action={
            <Button size="sm" onClick={() => void read.refetch()}>
              {m.readAgain}
            </Button>
          }
        >
          {m.tasksFailed}
        </ErrorNotice>
      ) : got?.kind === "ready" && got.tasks.length === 0 ? (
        <p className="text-[0.9rem] text-ink-dim">{m.tasksNone}</p>
      ) : got?.kind === "ready" ? (
        <>
          <ul className="flex flex-col rounded-[0.45rem] border border-line">
            {got.tasks.slice(0, SHOWN).map((t) => (
              <li key={t.key} className="flex items-center gap-1 border-line pr-[0.4rem] not-first:border-t">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    leave()
                    void openTarget({ type: "task", id: t.key })
                  }}
                  className="flex min-w-0 flex-1 flex-col gap-[0.2rem] py-[0.5rem] pl-[0.9rem] text-left hover:bg-app-3 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <span className="min-w-0 truncate">{t.title}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.85rem]">
                    <span className="font-mono text-ink-dim">{t.key}</span>
                    <StateText state={t.state} />
                    <DueText task={t} />
                  </span>
                </button>
                <CopyRef value={referenceOf({ type: "task", id: t.key })} />
              </li>
            ))}
          </ul>
          {(got.total > SHOWN || got.more) && (
            <span>
              <Button size="sm" onClick={toTasks}>
                {m.tasksAll(got.total)}
              </Button>
            </span>
          )}
        </>
      ) : null}
    </section>
  )
}

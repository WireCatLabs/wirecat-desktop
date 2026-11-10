import { ChevronDown } from "lucide-react"
import { useId, useState } from "react"
import { useMessages } from "@/i18n"
import type { Doubt } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Pager } from "@/ui/Pager"
import { Skeleton } from "@/ui/Skeleton"
import { peopleMessages } from "./messages"
import { sourceOf } from "./sources"
import { DOUBTS_PAGE, usePeople } from "./store"

/**
 * `memo people links check` above the contacts: people whose accounts may not all be theirs, with memo's reason and the
 * split it suggests. There is no "this is right" here: memo cannot record that yet (IDEA-273), so a doubt stays until
 * the link changes.
 */
export function LinkDoubts() {
  const m = useMessages(peopleMessages)
  const doubts = usePeople((s) => s.doubts)
  const { readDoubts } = usePeople.getState()
  const [open, setOpen] = useState(true)
  const head = useId()
  const body = useId()
  const last = doubts?.last
  if (!doubts || (!last && doubts.state !== "failed") || (last && last.items.length === 0 && doubts.page === 1))
    return null

  return (
    <section
      aria-labelledby={head}
      className="flex flex-col gap-[0.75rem] rounded-[0.45rem] border border-line px-[1.1rem] py-[0.85rem]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h2 id={head} className="flex items-center gap-2 font-semibold">
            <Lamp tone="warn" size="sm" />
            {m.doubtsTitle}
            {typeof last?.total === "number" && (
              <span className="font-normal text-ink-soft tabular-nums">· {m.doubtsCount(last.total)}</span>
            )}
          </h2>
          {open && <p className="mt-[0.15rem] text-[0.9rem] text-ink-soft">{m.doubtsHelp}</p>}
        </div>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls={body}
          onClick={() => setOpen(!open)}
          icon={<ChevronDown className={open ? "size-4 rotate-180" : "size-4"} aria-hidden />}
        >
          {open ? m.doubtsHide : m.doubtsShow}
        </Button>
      </div>
      {open && (
        <div id={body} className="flex flex-col gap-[0.6rem]">
          {doubts.state === "failed" && (
            <ErrorNotice inline>
              {m.doubtsFailed} {doubts.error}
            </ErrorNotice>
          )}
          {last ? (
            <ul aria-busy={doubts.state === "loading"} className="flex flex-col">
              {last.items.map((doubt) => (
                <DoubtRow key={`${doubt.person}:${doubt.reason}`} doubt={doubt} />
              ))}
            </ul>
          ) : (
            <Skeleton className="h-[3rem] w-full" />
          )}
          {last && (doubts.page > 1 || last.more) && (
            <Pager
              page={doubts.page}
              label={m.doubtsPages}
              onPage={(page) => void readDoubts(page)}
              busy={doubts.state === "loading"}
              size={DOUBTS_PAGE}
              {...(last.total === null ? { hasMore: last.more } : { total: last.total })}
            />
          )}
        </div>
      )}
    </section>
  )
}

function DoubtRow({ doubt }: { doubt: Doubt }) {
  const m = useMessages(peopleMessages)
  const { reveal, need, askSplit, askUndo } = usePeople.getState()
  const unlink = doubt.moves.find((x) => x.op === "unlink")
  const unmerge = doubt.moves.find((x) => x.op === "unmerge")
  const accounts = doubt.identities.map((i) => {
    const source = sourceOf(i.identity.split(":")[0] ?? "").name
    return i.name ? `${source} ${i.name}` : m.anAccount(source)
  })
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-line py-[0.6rem] not-first:border-t">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{doubt.name ?? m.unknown}</p>
        <p className="text-[0.92rem]">{m.doubtReasons[doubt.reason] ?? m.doubtOther}</p>
        {accounts.length > 0 && <p className="selectable text-[0.9rem] text-ink-soft">{accounts.join(" · ")}</p>}
      </div>
      <span className="flex flex-wrap gap-2">
        {unlink && (
          <Button
            size="sm"
            onClick={() => {
              need(doubt.person)
              askSplit(doubt.person, unlink.identities)
            }}
          >
            {m.doubtSplit}
          </Button>
        )}
        {unmerge && (
          <Button
            size="sm"
            onClick={() => {
              need(doubt.person)
              askUndo({ ref: doubt.person, merge: unmerge.merge })
            }}
          >
            {m.undo}
          </Button>
        )}
        <Button size="sm" variant="ghost" aria-haspopup="dialog" onClick={() => reveal(doubt.person)}>
          {m.doubtOpen}
        </Button>
      </span>
    </li>
  )
}

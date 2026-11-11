import { Check, Split, Undo2 } from "lucide-react"
import { useLang, useMessages } from "@/i18n"
import type { PersonDetail } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { groupMatches } from "./groups"
import { IdentityList } from "./IdentityList"
import { useJoinedFromName, usePersonName } from "./labels"
import { MatchCard } from "./MatchCard"
import { peopleMessages } from "./messages"
import { PersonTasks } from "./PersonTasks"
import { Refusal } from "./Refusal"
import { usePeople } from "./store"

/** One person, from a table row or a search: their accounts by source, what was joined into them, their matches. */
export function PersonDialog() {
  const name = usePersonName()
  const open = usePeople((s) => s.open)
  return (
    <Dialog
      open={open !== null}
      title={open ? name(open) : ""}
      onClose={() => usePeople.getState().reveal(null)}
      wide="xl"
      scroll
    >
      {open && <Details key={open} reference={open} />}
    </Dialog>
  )
}

function Details({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const detail = usePeople((s) => s.details[reference])
  const decided = usePeople((s) => s.decided)
  const failed = usePeople((s) => s.failed[reference])
  const box = "pb-[1.2rem]"
  if (!detail || detail.state === "loading")
    return (
      <div className={box}>
        <Skeleton className="h-[5rem] w-full rounded-[0.35rem]" label={m.loadingPerson} />
      </div>
    )
  if (detail.state === "failed")
    return (
      <div className={box}>
        <ErrorNotice raw={detail.error} inline>
          {m.personFailed}
        </ErrorNotice>
      </div>
    )
  return (
    <div className={`${box} reveal grid gap-[1.4rem]`}>
      {detail.person.mergedInto && <NowPartOf into={detail.person.mergedInto} />}
      <div className="flex min-w-0 flex-col gap-[0.8rem]">
        <div>
          <h3 className="font-medium">{m.accounts}</h3>
          <p className="text-[0.9rem] text-ink-soft">{m.accountsHelp}</p>
        </div>
        <IdentityList
          identities={detail.person.identities}
          {...(detail.person.identities.length > 1
            ? { onUnlink: (identity: string) => usePeople.getState().askSplit(reference, [identity]) }
            : {})}
        />
        {detail.person.identities.filter((i) => i.movable).length > 0 && detail.person.identities.length > 1 && (
          <span>
            <Button
              size="sm"
              icon={<Split className="size-4" aria-hidden />}
              onClick={() => usePeople.getState().askSplit(reference)}
            >
              {m.split}
            </Button>
          </span>
        )}
        <DoneNote reference={reference} />
        {failed && <Refusal error={failed} />}
      </div>
      <PersonTasks reference={detail.person.ref} />
      <div className="flex min-w-0 flex-col gap-[0.9rem] empty:hidden">
        <Merges person={detail.person} />
        {groupMatches(detail.person.matches, decided).map((group) => (
          <MatchCard key={group.key} group={group} from={reference} />
        ))}
      </div>
    </div>
  )
}

function Merges({ person }: { person: PersonDetail }) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const joinedFrom = useJoinedFromName()
  if (person.merges.length === 0) return null
  return (
    <section className="flex flex-col gap-[0.4rem]">
      <h3 className="font-medium">{m.merges}</h3>
      <ul className="flex flex-col gap-[0.5rem]">
        {person.merges.map((merge) => (
          <li key={merge.id} className="flex flex-wrap items-center justify-between gap-2 text-[0.95rem]">
            <span className="min-w-0">
              {m.mergeLine(joinedFrom(merge.from), merge.method ? (m.methods[merge.method] ?? merge.method) : null)}
              {merge.at && (
                <span className="ml-2 font-mono text-[0.85rem] text-ink-dim">
                  {new Date(merge.at).toLocaleDateString(lang, { dateStyle: "medium" })}
                </span>
              )}
              <span className="block font-mono text-[0.85rem] text-ink-dim">{merge.identities.join(", ")}</span>
            </span>
            <Button
              size="sm"
              icon={<Undo2 className="size-4" aria-hidden />}
              onClick={() => usePeople.getState().askUndo({ ref: person.ref, merge: merge.id })}
            >
              {m.undoMerge}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** memo answered with the person this one was merged into; the page says so and opens that one on request. */
function NowPartOf({ into }: { into: string }) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem]">
      {m.nowPartOf(name(into))}
      <Button size="sm" onClick={() => usePeople.getState().reveal(into)}>
        {m.openPerson(name(into))}
      </Button>
    </p>
  )
}

function DoneNote({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const joinedFrom = useJoinedFromName()
  const done = usePeople((s) => s.done[reference])
  if (!done) return null
  const text =
    done.op === "unlink"
      ? m.done.unlink(done.count, done.movedTo)
      : done.op === "unmerge"
        ? m.done.unmerge(joinedFrom(done.from))
        : m.done[done.op](name(done.with))
  return (
    <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
      <Check className="size-4 shrink-0 text-ok" aria-hidden />
      {text}
    </p>
  )
}

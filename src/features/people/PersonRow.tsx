import { Check, Split, Undo2, User, UserRound } from "lucide-react"
import { useId } from "react"
import { useLang, useMessages } from "@/i18n"
import type { Listed, PersonDetail } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Skeleton } from "@/ui/Skeleton"
import { TextButton } from "@/ui/TextButton"
import { IdentityList } from "./IdentityList"
import { usePersonName } from "./labels"
import { MatchCard } from "./MatchCard"
import { peopleMessages } from "./messages"
import { Refusal } from "./Refusal"
import { usePeople } from "./store"

/** One person; opened, their accounts by source, what was joined into them, and the matches about them. */
export function PersonRow({ person }: { person: Listed }) {
  const m = useMessages(peopleMessages)
  const open = usePeople((s) => s.open === person.ref)
  const panel = useId()
  const Icon = person.owner ? UserRound : User
  return (
    <div className="border-line not-first:border-t" data-person={person.ref}>
      <TextButton
        as="div"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => usePeople.getState().toggle(person.ref)}
        className="group flex min-h-[3.6rem] cursor-pointer items-center gap-[0.8rem] px-[1.3rem] py-[0.7rem]"
      >
        <Icon className="size-[1.2rem] shrink-0 text-ink-soft" strokeWidth={1.8} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-medium group-hover:text-brand">
            {person.owner ? m.you : (person.name ?? m.noName)}
          </span>
          <span className="font-mono text-[0.85rem] text-ink-dim">{person.ref}</span>
        </span>
        <ExpandChevron open={open} />
      </TextButton>
      <Collapse open={open} id={panel}>
        <Details reference={person.ref} />
      </Collapse>
    </div>
  )
}

function Details({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const detail = usePeople((s) => s.details[reference])
  const failed = usePeople((s) => s.failed[reference])
  const box = "border-line border-t bg-app-2/60 px-[1.3rem] py-[1.1rem]"
  if (!detail || detail.state === "loading")
    return (
      <div className={box}>
        <Skeleton className="h-[5rem] w-full rounded-[0.35rem]" label={m.loadingPerson} />
      </div>
    )
  if (detail.state === "failed")
    return (
      <div className={box}>
        <ErrorNotice inline>
          {m.personFailed} {detail.error}
        </ErrorNotice>
      </div>
    )
  return (
    <div className={`${box} grid gap-[1.4rem] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]`}>
      <div className="flex min-w-0 flex-col gap-[0.8rem]">
        <div>
          <h3 className="font-medium">{m.accounts}</h3>
          <p className="text-[0.9rem] text-ink-soft">{m.accountsHelp}</p>
        </div>
        <IdentityList identities={detail.person.identities} />
        {detail.person.identities.length > 1 && (
          <span>
            <Button
              size="sm"
              variant="ghost"
              className="-ml-2"
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
      <div className="flex min-w-0 flex-col gap-[0.9rem]">
        <Merges person={detail.person} />
        {detail.person.matches.map((match) => (
          <MatchCard key={match.id} match={match} from={reference} />
        ))}
      </div>
    </div>
  )
}

function Merges({ person }: { person: PersonDetail }) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const name = usePersonName()
  if (person.merges.length === 0) return null
  return (
    <section className="flex flex-col gap-[0.4rem]">
      <h3 className="font-medium">{m.merges}</h3>
      <ul className="flex flex-col gap-[0.5rem]">
        {person.merges.map((merge) => (
          <li key={merge.id} className="flex flex-wrap items-center justify-between gap-2 text-[0.95rem]">
            <span className="min-w-0">
              {m.mergeLine(name(merge.from), merge.method ? (m.methods[merge.method] ?? merge.method) : null)}
              {merge.at && (
                <span className="ml-2 font-mono text-[0.85rem] text-ink-dim">
                  {new Date(merge.at).toLocaleDateString(lang, { dateStyle: "medium" })}
                </span>
              )}
              <span className="block font-mono text-[0.85rem] text-ink-dim">
                {merge.identities.map((i) => i.identity).join(", ")}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
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

function DoneNote({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const done = usePeople((s) => s.done[reference])
  if (!done) return null
  const text =
    done.op === "unlink"
      ? m.done.unlink(done.count, done.movedTo)
      : done.op === "unmerge"
        ? m.done.unmerge(name(done.from))
        : m.done[done.op](name(done.with))
  return (
    <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
      <Check className="size-4 shrink-0 text-ok" aria-hidden />
      {text}
    </p>
  )
}

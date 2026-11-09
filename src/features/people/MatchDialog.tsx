import { useMessages } from "@/i18n"
import type { Match } from "@/platform/people-schemas"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { groupMatches } from "./groups"
import { IdentityList } from "./IdentityList"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/**
 * Everything memo said about a match or a group of them, raw values included: every person's every account, and the
 * matches' own words.
 */
export function MatchDialog() {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const matches = usePeople((s) => s.matches)
  const decided = usePeople((s) => s.decided)
  const key = usePeople((s) => s.matchOpen)
  // A match about an open person may lie past the matches the page read: its group is then made from that person's.
  const details = usePeople((s) => s.details)
  const theirs = Object.values(details).flatMap((d) => (d.state === "ready" ? d.person.matches : []))
  const find = (list: Match[]) =>
    groupMatches(list, decided).find((g) => g.key === key || g.matches.some((x) => x.id === key))
  const group = key ? (find(matches) ?? find(theirs)) : undefined
  const match = group?.matches.find((x) => !decided[x.id]) ?? group?.matches[0]
  const facts: [string, string | null][] = match
    ? [
        [m.facts.match, group?.matches.map((x) => x.id).join(", ") ?? match.id],
        [m.facts.signal, match.signal],
        [m.facts.identity, match.identity],
        [m.facts.with, match.with],
        [m.facts.evidence, match.evidence.join(", ") || null],
        [m.facts.candidates, match.candidates.join(", ") || null],
      ]
    : []
  return (
    <Dialog
      open={group !== undefined}
      title={m.matchDetails}
      onClose={() => usePeople.getState().openMatch(null)}
      wide="xl"
      scroll
    >
      {group && match && (
        <div className="flex flex-col gap-[1.2rem] pb-[1.2rem]">
          <div className="grid gap-[1.2rem] md:grid-cols-2">
            {group.people.map((ref) => (
              <section key={ref} aria-label={name(ref)} className="flex min-w-0 flex-col gap-[0.6rem]">
                <h3 className="font-medium text-ink">
                  {name(ref)} <span className="selectable font-mono text-[0.85rem] text-ink-dim">{ref}</span>
                </h3>
                <Accounts reference={ref} />
              </section>
            ))}
          </div>
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-[1rem] gap-y-[0.3rem] text-[0.9rem]">
            {facts
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-dim">{label}</dt>
                  <dd className="selectable font-mono break-all text-ink">{value}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}
    </Dialog>
  )
}

function Accounts({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const detail = usePeople((s) => s.details[reference])
  if (!detail || detail.state === "loading") return <Skeleton className="h-[5rem] w-full" label={m.loadingPerson} />
  if (detail.state === "failed")
    return (
      <ErrorNotice inline>
        {m.personFailed} {detail.error}
      </ErrorNotice>
    )
  return <IdentityList identities={detail.person.identities} />
}

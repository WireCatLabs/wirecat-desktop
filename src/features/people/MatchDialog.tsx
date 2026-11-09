import { useMessages } from "@/i18n"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { IdentityList } from "./IdentityList"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/** Everything memo said about a match, raw values included: both people's every account, and the match's own words. */
export function MatchDialog() {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  // A match about an open person may lie past the matches the page read.
  const match = usePeople(
    (s) =>
      s.matches.find((x) => x.id === s.matchOpen) ??
      Object.values(s.details)
        .flatMap((d) => (d.state === "ready" ? d.person.matches : []))
        .find((x) => x.id === s.matchOpen),
  )
  const facts: [string, string | null][] = match
    ? [
        [m.facts.match, match.id],
        [m.facts.signal, match.signal],
        [m.facts.identity, match.identity],
        [m.facts.with, match.with],
        [m.facts.evidence, match.evidence.join(", ") || null],
        [m.facts.candidates, match.candidates.join(", ") || null],
      ]
    : []
  return (
    <Dialog
      open={match !== undefined}
      title={m.matchDetails}
      onClose={() => usePeople.getState().openMatch(null)}
      wide="xl"
      scroll
    >
      {match && (
        <div className="flex flex-col gap-[1.2rem] pb-[1.2rem]">
          <div className="grid gap-[1.2rem] md:grid-cols-2">
            {match.persons.map((ref) => (
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

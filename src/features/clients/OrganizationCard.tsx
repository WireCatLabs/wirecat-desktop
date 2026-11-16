import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { useId, useState } from "react"
import { moneyOf } from "@/domain/clients"
import { useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { tooOld } from "@/platform/command-error"
import type { OrganizationCard as Card } from "@/platform/person-profile-schemas"
import { ClientCalls } from "@/shared/ClientCalls"
import { errorText } from "@/shared/errors"
import { callMessages } from "@/shared/messages-calls"
import { Collapse } from "@/ui/Collapse"
import { CopyRef } from "@/ui/CopyRef"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { organizationMessages } from "./messages-organization"

/** The deal's company, folded until the owner opens it, so its card is read only then. */
export function CompanySection({ name, reference }: { name: string; reference: string }) {
  const m = useMessages(organizationMessages)
  return (
    <Disclosure summary={m.show(name)}>
      <OrganizationCard reference={reference} />
    </Disclosure>
  )
}

/**
 * A company's card inside the deal's: its people, its open deals and leads, and how many calls its people had. memo
 * lists no calls of a company, so a person's calls are read when the owner opens that person, one read per click.
 */
function OrganizationCard({ reference }: { reference: string }) {
  const m = useMessages(organizationMessages)
  const read = useQuery({
    queryKey: ["organization", reference] as const,
    queryFn: () => platform.organizationCard(reference),
    staleTime: 60_000,
  })
  if (read.isPending) return <Skeleton className="h-[6rem] w-full rounded-control" label={m.loading} />
  if (read.isError)
    return tooOld(read.error) ? (
      <p className="text-[0.9rem] text-ink-soft">{m.old}</p>
    ) : (
      <ErrorNotice inline raw={errorText(read.error)}>
        {m.failed}
      </ErrorNotice>
    )
  return <Shown card={read.data} />
}

function Shown({ card }: { card: Card }) {
  const m = useMessages(organizationMessages)
  const lang = useLang()
  const morePeople = card.peopleTotal - card.people.length
  const moreDeals = card.dealsTotal - card.deals.length
  return (
    <div className="reveal flex min-w-0 flex-col gap-[1.1rem] rounded-inset border border-line p-[0.9rem]">
      <section className="flex min-w-0 flex-col gap-[0.4rem]" aria-label={m.people}>
        <h3 className="font-medium">{m.people}</h3>
        {card.meetings !== null && card.meetings > 0 && (
          <p className="text-[0.9rem] text-ink-soft">
            {m.calls(card.meetings)}. {m.callsHelp}
          </p>
        )}
        {card.people.length === 0 ? (
          <p className="text-[0.9rem] text-ink-soft">{m.noPeople}</p>
        ) : (
          <ul className="flex flex-col rounded-inset border border-line">
            {card.people.map((p) => (
              <Person key={p.reference} person={p} />
            ))}
          </ul>
        )}
        {morePeople > 0 && <p className="text-[0.9rem] text-ink-dim">{m.morePeople(morePeople)}</p>}
      </section>
      <section className="flex min-w-0 flex-col gap-[0.4rem]" aria-label={m.deals}>
        <h3 className="font-medium">{m.deals}</h3>
        {card.deals.length === 0 ? (
          <p className="text-[0.9rem] text-ink-soft">{m.noDeals}</p>
        ) : (
          <ul className="flex flex-col gap-[0.3rem]">
            {card.deals.map((d) => (
              <li key={d.reference} className="flex min-w-0 flex-wrap items-center gap-x-[0.6rem] text-[0.95rem]">
                <span className="selectable min-w-0 truncate">{d.title ?? d.reference}</span>
                <span className="text-[0.88rem] text-ink-soft">
                  {[
                    d.kind === "lead" ? m.lead : null,
                    d.stage,
                    d.amount && d.currency ? moneyOf(d.amount, d.currency, lang) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <CopyRef value={d.reference} />
              </li>
            ))}
          </ul>
        )}
        {moreDeals > 0 && <p className="text-[0.9rem] text-ink-dim">{m.moreDeals(moreDeals)}</p>}
      </section>
    </div>
  )
}

function Person({ person }: { person: Card["people"][number] }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <li className="border-line not-first:border-t">
      <span className="flex items-center gap-1 pr-[0.6rem]">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-[0.6rem] px-[0.8rem] py-[0.5rem] text-left hover:bg-app-3 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ChevronRight
            className={cx(
              "size-4 shrink-0 text-ink-dim transition-transform motion-reduce:transition-none",
              open && "rotate-90",
            )}
            aria-hidden
          />
          <span className="selectable min-w-0 truncate">{person.name ?? person.reference}</span>
          {person.role && <span className="truncate text-[0.88rem] text-ink-dim">{person.role}</span>}
        </button>
        <CopyRef value={person.reference} />
      </span>
      <Collapse open={open} id={id}>
        <div className="px-[0.8rem] pb-[0.8rem] pl-[2.2rem]">
          <PersonCalls reference={person.reference} />
        </div>
      </Collapse>
    </li>
  )
}

function PersonCalls({ reference }: { reference: string }) {
  const m = useMessages(organizationMessages)
  const c = useMessages(callMessages)
  const read = useQuery({
    queryKey: ["people", "contacts", reference] as const,
    queryFn: () => platform.peopleProfile(reference),
    staleTime: 60_000,
  })
  if (read.isPending) return <Skeleton className="h-[3rem] w-full rounded-control" label={c.loadingContacts} />
  if (read.isError)
    return (
      <ErrorNotice inline raw={errorText(read.error)}>
        {c.contactsFailed}
      </ErrorNotice>
    )
  const calls = read.data.meetings ?? []
  return calls.length === 0 ? (
    <p className="text-[0.9rem] text-ink-soft">{m.noCalls}</p>
  ) : (
    <ClientCalls calls={calls} help={m.personCalls} />
  )
}

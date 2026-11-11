import { Mail, PanelRightOpen, Phone } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import { scopesOf } from "@/domain/people"
import { formatDate, formatList, formatNumber, useLang, useMessages } from "@/i18n"
import type { Identity, Match } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { InfoTip } from "@/ui/InfoTip"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { type Contacts, contactsOf, keyOf, type MatchFact, matchFacts, sameMark, sharedValue } from "./contacts"
import type { MatchGroup } from "./groups"
import { useComparableName, usePersonName } from "./labels"
import { MatchActions } from "./MatchActions"
import { peopleMessages } from "./messages"
import { usePicks, useUnticked } from "./picks"
import { accountName, SourceIcon, sourceOf } from "./sources"
import { usePeople } from "./store"

/** A side shows this many accounts; Details shows them all. */
const ACCOUNTS_SHOWN = 4

/** The account a match names on this person: its own on the first side, the one it would join on the second. */
export const tieOf = (matches: readonly Match[], ref: string) => {
  for (const m of matches) {
    if (m.persons[0] === ref && m.identity) return m.identity
    if (m.persons[1] === ref && m.with) return m.with
  }
  return null
}

/**
 * People WireCat thinks may be one, side by side, with the account that ties them marked on each. Two people are one
 * match; three or more who share one phone or address are one group, and the owner ticks which of them are one person.
 * Decided, the card stays where it is and says what happened (rule 9).
 */
export function MatchCard({ group, from }: { group: MatchGroup; from?: string }) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const comparable = useComparableName()
  const decided = usePeople((s) => s.decided)
  const { openMatch } = usePeople.getState()
  const open = group.matches.filter((x) => !decided[x.id])
  const first = open[0] ?? group.matches[0]
  const people = group.people
  const picking = open.length > 0 && people.length > 2
  const unticked = useUnticked(group.key)
  const head = useId()
  const pickList = useId()
  const details = usePeople((s) => s.details)
  const listed = usePeople((s) => s.people)
  const contacts = people.map((ref) => {
    const d = details[ref]
    return contactsOf(
      d?.state === "ready" ? d.person : null,
      null,
      listed.find((x) => x.ref === ref),
    )
  })
  const shared = first ? sharedValue(first, contacts) : null
  // Kept once seen: a decision drops the people's details, and the decided card still says what it said (rule 9).
  const hidden = useRef(false)
  hidden.current ||=
    first?.signal === "phone" &&
    shared === null &&
    people.every((ref) => details[ref]?.state === "ready") &&
    contacts.every((c) => c.phones.length === 0)
  const names = people.map((p) => name(p))
  const facts = first ? matchFacts(first, people.map(comparable), contacts) : []
  if (!first) return null

  const done = open.length === 0
  const moving = first.joins === "identity" && first.identity
  const chosen = people.filter((p) => !unticked.includes(p))
  const all = chosen.length === people.length

  return (
    <article
      aria-labelledby={head}
      className="flex min-w-0 flex-col gap-[0.75rem] rounded-[0.45rem] border border-line bg-app px-[1.1rem] py-[0.95rem]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={head} className="min-w-0 font-medium">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => openMatch(group.key)}
            className="rounded-[0.2rem] text-left text-ink underline decoration-line-strong underline-offset-[0.2em] hover:decoration-brand"
          >
            {titleOf(names, m.everyone)}
          </button>
        </h3>
        <Proposer by={first.proposer} />
      </div>
      {m.signalNames[first.signal ?? ""] && (
        <Signal group={group} match={first} value={shared} hidden={hidden.current} names={names} />
      )}
      <MatchFacts facts={facts} />
      {moving && (
        <p className="text-[0.9rem] text-ink-soft">
          {m.moveHeading(moveWords(first, m.anAccount), name(first.persons[1] ?? ""))} {m.moveHelp}
        </p>
      )}
      {first.reason && first.proposer?.kind !== "rule" && <p className="selectable text-[0.95rem]">{first.reason}</p>}
      {first.proposer?.kind === "rule" && first.signal !== "name" && !m.signalNames[first.signal ?? ""] && (
        <p className="text-[0.95rem]">{m.ruleFallback}</p>
      )}
      {picking && <p className="text-[0.9rem] text-ink-soft">{m.pickHelp}</p>}
      <div id={pickList} className={cx("grid gap-[0.6rem] md:grid-cols-2", people.length > 2 && "xl:grid-cols-3")}>
        {people.map((ref) => (
          <Side
            key={ref}
            reference={ref}
            contacts={contacts[people.indexOf(ref)] ?? { phones: [], emails: [] }}
            same={(v) => shared !== null && keyOf(first.signal)(v) === keyOf(first.signal)(shared)}
            tie={tieOf(open.length ? open : group.matches, ref)}
            decided={done}
            pick={
              picking
                ? {
                    on: !unticked.includes(ref),
                    set: (on) => usePicks.getState().set(group.key, ref, on),
                  }
                : null
            }
          />
        ))}
      </div>
      <MatchActions
        group={group}
        from={from}
        chosen={chosen}
        pickId={pickList}
        confirmLabel={picking ? (all ? m.mergeAll(people.length) : m.joinPicked(chosen.length)) : m.confirm}
        hint={picking && chosen.length < 2 && <span className="text-[0.85rem] text-ink-dim">{m.pickTwo}</span>}
        lead={
          <Button
            size="sm"
            aria-haspopup="dialog"
            icon={<PanelRightOpen className="size-4" aria-hidden />}
            onClick={() => openMatch(group.key)}
          >
            {m.details}
          </Button>
        }
      />
    </article>
  )
}

/** Each name once, whatever its case: «Билайн бизнес · билайн бизнес» says nothing the count does not. */
export function titleOf(names: readonly string[], count: (n: number) => string) {
  const unique = names.filter((n, i) => names.findIndex((x) => x.toLocaleLowerCase() === n.toLocaleLowerCase()) === i)
  return unique.length < names.length ? `${unique.join(" · ")} · ${count(names.length)}` : unique.join(" · ")
}

/** What the two sides have in common, each with its value: "Name  Beeline business", "Domain  beeline.ru". */
export function MatchFacts({ facts }: { facts: MatchFact[] }) {
  const m = useMessages(peopleMessages)
  if (facts.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-[0.5rem] gap-y-[0.35rem]">
      <span className="text-[0.9rem] text-ink-soft">{m.factsLead}</span>
      <dl className="contents">
        {facts.map((f) => (
          <div
            key={f.kind}
            className="inline-flex min-w-0 items-baseline gap-[0.4rem] rounded-[0.3rem] bg-app-3 px-[0.5rem] py-[0.1rem]"
          >
            <dt className="text-[0.85rem] text-ink-soft">{m.factNames[f.kind]}</dt>
            {f.value && <dd className="selectable min-w-0 break-words font-medium text-ink">{f.value}</dd>}
          </div>
        ))}
      </dl>
    </div>
  )
}

export function moveWords(match: Match, anAccount: (source: string) => string) {
  const moved = usePeople.getState().details[match.persons[0] ?? ""]
  const i = moved?.state === "ready" ? moved.person.identities.find((x) => x.identity === match.identity) : undefined
  return i
    ? [sourceOf(i.provider).name, accountName(i)].filter(Boolean).join(" ")
    : anAccount(sourceOf(match.identity?.split(":")[0] ?? "").name)
}

/** Who found it, as a small label: WireCat's own matching, an agent by name, or a person. Why is in its tooltip. */
export function Proposer({ by }: { by: Match["proposer"] }) {
  const m = useMessages(peopleMessages)
  if (!by) return null
  const [label, tip] =
    by.kind === "rule"
      ? [m.wirecat, m.wirecatTip]
      : by.name
        ? [by.name, by.kind === "agent" ? m.agentTip(by.name) : m.personTip]
        : [m.personTip, m.personTip]
  return (
    <InfoTip label={tip} align="end" trigger={<Pill>{label}</Pill>}>
      {tip}
    </InfoTip>
  )
}

/**
 * What ties them, with the value itself when it is known: "Phone +7 912 555-01-47 · 2 people have it". The names of
 * everyone who has it are in the count's tooltip.
 */
function Signal({
  group,
  match,
  value,
  hidden,
  names,
}: {
  group: MatchGroup
  match: Match
  value: string | null
  /** A phone match where no account shows a number: they keep only its fingerprint. */
  hidden: boolean
  names: string[]
}) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const signal = match.signal ?? ""
  const sameTip = m.sameTip[signal]
  const Icon = signal === "phone" ? Phone : signal === "email" || signal === "guest-email" ? Mail : null
  return (
    <p className="flex flex-wrap items-center gap-x-[0.6rem] gap-y-[0.3rem]">
      {Icon && <Icon className="size-[1.05rem] shrink-0 text-ink-soft" aria-hidden />}
      <span className="text-[0.92rem] font-medium text-ink-soft">{m.signalNames[signal] ?? signal}</span>
      {value ? (
        <span className="selectable font-mono text-[1.05rem] font-semibold text-ink tabular-nums">{value}</span>
      ) : hidden ? (
        <InfoTip label={m.phoneHiddenTip} trigger={<Pill>{m.phoneHidden}</Pill>}>
          {m.phoneHiddenTip}
          {match.evidence.length > 0 && (
            <>
              {" "}
              {m.evidence} <span className="selectable font-mono text-ink">{match.evidence.join(", ")}</span>
            </>
          )}
        </InfoTip>
      ) : (
        sameTip && (
          <InfoTip label={sameTip} trigger={<Pill>{m.same}</Pill>}>
            {sameTip}
            {match.evidence.length > 0 && (
              <>
                {" "}
                {m.evidence} <span className="selectable font-mono text-ink">{match.evidence.join(", ")}</span>
              </>
            )}
          </InfoTip>
        )
      )}
      {sameTip && (
        <InfoTip
          label={m.sharedTip(group.sharing, formatList(names, lang))}
          trigger={
            <span className="text-[0.88rem] text-ink-dim underline decoration-dotted underline-offset-[0.2em]">
              {m.haveIt(group.sharing)}
            </span>
          }
        >
          {m.sharedTip(group.sharing, formatList(names, lang))}
        </InfoTip>
      )}
      {group.mailbox && (
        <InfoTip label={m.sharedMailboxTip} trigger={<Pill tone="warn">{m.sharedMailbox}</Pill>}>
          {m.sharedMailboxTip}
        </InfoTip>
      )}
    </p>
  )
}

/**
 * One of the people: name, how much there is of them, their phones and addresses with the shared one marked, when they
 * last talked, and their accounts by source. Once decided, the people may be one now, so their accounts are not read
 * again. The row of the page's list gives the activity; a person on another page has none here, and the line is left out.
 */
function Side({
  reference,
  contacts,
  same,
  tie,
  decided,
  pick,
}: {
  reference: string
  contacts: Contacts
  same: (value: string) => boolean
  /** The account the match names; marked when this side shows no shared phone or address to point at. */
  tie: string | null
  decided: boolean
  pick: { on: boolean; set: (on: boolean) => void } | null
}) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const name = usePersonName()
  const detail = usePeople((s) => s.details[reference])
  const tasks = usePeople((s) => s.seen[reference]?.tasks ?? 0)
  const row = usePeople((s) => s.people.find((p) => p.ref === reference))
  const box = useId()
  useEffect(() => {
    if (!detail && !decided) usePeople.getState().need(reference)
  }, [detail, decided, reference])
  const identities = detail?.state === "ready" ? detail.person.identities : []
  // The tie first: it is what the owner compares.
  const ordered = [...identities.filter((i) => i.identity === tie), ...identities.filter((i) => i.identity !== tie)]
  const rest = ordered.length - ACCOUNTS_SHOWN
  const facts = [identities.length ? m.accountsN(identities.length) : null, tasks > 0 ? m.tasksOf(tasks) : null]
  const values = [...contacts.phones, ...contacts.emails]
  const marked = values.some(same) ? null : tie
  const activity = [
    row?.lastContact ? `${m.lastContact}: ${formatDate(row.lastContact, { dateStyle: "medium" }, lang)}` : null,
    row?.messagesFrom ? `${m.messagesFrom}: ${formatNumber(row.messagesFrom, lang)}` : null,
  ].filter(Boolean)
  return (
    <section
      aria-label={name(reference)}
      className={cx(
        "flex min-w-0 flex-col gap-[0.5rem] rounded-[0.35rem] border border-line px-[0.85rem] py-[0.7rem] transition-opacity duration-(--motion-fast)",
        pick && !pick.on && "opacity-60",
      )}
    >
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-[0.5rem]">
          {pick && <Checkbox id={box} checked={pick.on} onChange={pick.set} aria-label={m.pick(name(reference))} />}
          <span className="min-w-0 truncate font-semibold text-ink">{name(reference)}</span>
        </span>
        <span className="text-[0.85rem] text-ink-dim tabular-nums">{facts.filter(Boolean).join(" · ")}</span>
      </p>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-x-[0.9rem] gap-y-[0.2rem]">
          {values.map((v) => (
            <li
              key={v}
              className={cx(
                "selectable font-mono text-[0.9rem] break-all tabular-nums",
                same(v) ? sameMark : "text-ink-soft",
              )}
            >
              {v}
            </li>
          ))}
        </ul>
      )}
      {activity.length > 0 && <p className="text-[0.85rem] text-ink-soft">{activity.join(" · ")}</p>}
      {decided && detail?.state !== "ready" ? null : !detail || detail.state === "loading" ? (
        <div className="flex flex-col gap-[0.4rem]">
          <Skeleton className="h-[1.6rem] w-full" label={m.loadingPerson} />
          <Skeleton className="h-[1.6rem] w-[70%]" />
        </div>
      ) : detail.state === "failed" ? (
        <ErrorNotice raw={detail.error} inline>
          {m.personFailed}
        </ErrorNotice>
      ) : (
        <ul className="flex flex-col gap-[0.3rem]">
          {ordered.slice(0, ACCOUNTS_SHOWN).map((i) => (
            <Account key={i.identity} identity={i} tie={i.identity === marked} />
          ))}
          {rest > 0 && <li className="text-[0.85rem] text-ink-dim">{m.moreAccounts(rest)}</li>}
        </ul>
      )}
    </section>
  )
}

/** A source, the account's name and its handle when it has both, and where it was seen. */
export function Account({ identity: i, tie = false }: { identity: Identity; tie?: boolean }) {
  const m = useMessages(peopleMessages)
  const handle = accountName(i)
  const named = i.name?.trim()
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-[0.5rem] gap-y-[0.2rem] text-[0.92rem]">
      <SourceIcon provider={i.provider} className="text-ink-soft" labelled />
      {named && <span className="min-w-0 truncate">{named}</span>}
      {handle && handle !== named && <span className="min-w-0 truncate text-ink-soft">{handle}</span>}
      {scopesOf(i.seenIn).map((k) => (
        <Pill key={k} size="sm">
          {m.scopes[k]}
        </Pill>
      ))}
      {tie && <span className="ml-auto text-[0.8rem] font-medium text-ink-dim">{m.tie}</span>}
    </li>
  )
}

import { Bot, CalendarDays, ExternalLink, Link2, Mail, Phone } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import { isConversation } from "@/domain/conversation"
import { linkTargetOf } from "@/domain/links"
import { sourceLink } from "@/domain/source-link"
import { openConversation } from "@/features/conversation"
import { formatDate, formatNumber, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Identity, Listed, Match, PersonDetail } from "@/platform/people-schemas"
import type { PersonProfile } from "@/platform/person-profile-schemas"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { TextButton } from "@/ui/TextButton"
import { groupMatches, type MatchGroup } from "./groups"
import { usePersonName } from "./labels"
import { MatchActions } from "./MatchActions"
import { moveWords, tieOf } from "./MatchCard"
import { peopleMessages } from "./messages"
import { useUnticked } from "./picks"
import { type ProfileRead, useProfiles } from "./profiles"
import { accountName, SourceIcon, sourceOf } from "./sources"
import { usePeople } from "./store"

type Contacts = { phones: string[]; emails: string[] }

/** The last ten digits: `+7 912…` and `8 912…` are one number. */
const phoneKey = (phone: string) => phone.replace(/\D/g, "").slice(-10)
const emailKey = (email: string) => email.trim().toLowerCase()
const keyOf = (signal: string | null) => (signal === "phone" ? phoneKey : emailKey)
const looksLikePhone = (v: string) => /^\+?[\d\s().-]{7,20}$/.test(v.trim())
const looksLikeEmail = (v: string) => /^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(v.trim())
/** A WhatsApp id is a phone only as `<digits>@s.whatsapp.net` or `@c.us`, or bare digits; `@lid` is no number. */
const WHATSAPP_PHONE = /^(\d{7,15})(?:@s\.whatsapp\.net|@c\.us)?$/

const uniqueBy = (values: string[], key: (v: string) => string) =>
  values.filter((v, i) => key(v) !== "" && values.findIndex((w) => key(w) === key(v)) === i)

/** A person's phones and addresses: what memo's row and context give, and what their accounts are. */
export function contactsOf(
  person: PersonDetail | null,
  profile: PersonProfile | null,
  row: Listed | undefined,
): Contacts {
  const ids = (provider: string) =>
    (person?.identities ?? []).filter((i) => i.provider === provider).map((i) => i.identity.slice(provider.length + 1))
  const contact = row?.contact ?? ""
  const whatsapp = ids("whatsapp").flatMap((id) => {
    const digits = WHATSAPP_PHONE.exec(id)?.[1]
    return digits ? [`+${digits}`] : []
  })
  const own = (key: "phone" | "email") =>
    [row?.[key], ...(person?.identities ?? []).map((i) => i[key])].filter((v): v is string => !!v)
  const phones = [
    ...(profile?.phones ?? []),
    ...own("phone"),
    ...(looksLikePhone(contact) ? [contact] : []),
    ...whatsapp,
  ]
  const emails = [
    ...(profile?.emails ?? []),
    ...own("email"),
    ...(looksLikeEmail(contact) ? [contact] : []),
    ...ids("email"),
  ]
  return { phones: uniqueBy(phones, phoneKey), emails: uniqueBy(emails, emailKey) }
}

/** The page's own list row knows their counts for certain; the name search behind the profile can miss them. */
const withRow = (profile: PersonProfile, row: Listed | undefined): PersonProfile =>
  row
    ? {
        ...profile,
        messagesFrom: row.messagesFrom ?? profile.messagesFrom,
        lastContact: row.lastContact ?? profile.lastContact,
        tasks: row.tasks,
        tasksMore: false,
      }
    : profile

/**
 * The value the people share, as memo named it, else a phone or address two of them have. `null` when neither is
 * known: the dialog then says only what kind of thing they share, and marks the accounts the match names.
 */
export function sharedValue(match: Match, contacts: Contacts[]): string | null {
  const phone = match.signal === "phone"
  if (!phone && match.signal !== "email" && match.signal !== "guest-email") return null
  // memo's evidence may be a reference (a meeting's) rather than the value: only a phone or an address is shown.
  const evidence = match.evidence.find(phone ? looksLikePhone : looksLikeEmail)
  if (evidence) return evidence
  const key = keyOf(match.signal)
  const lists = contacts.map((c) => (phone ? c.phones : c.emails))
  const holders = (v: string) => lists.filter((l) => l.some((w) => key(w) === key(v))).length
  return lists.flat().find((v) => holders(v) > 1) ?? null
}

/**
 * Two people, or a group, side by side as the owner knows them: contacts, where they come from, how much they talk,
 * and what was said last, with what they share marked on each. The owner answers from here; decided, the dialog keeps
 * what was compared and says what happened (rule 9).
 */
export function MatchDialog() {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const matches = usePeople((s) => s.matches)
  const decided = usePeople((s) => s.decided)
  const key = usePeople((s) => s.matchOpen)
  // A match about an open person may lie past the matches the page read: its group is then made from that person's.
  const details = usePeople((s) => s.details)
  const profiles = useProfiles((s) => s.profiles)
  const theirs = Object.values(details).flatMap((d) => (d.state === "ready" ? d.person.matches : []))
  const find = (list: Match[]) =>
    groupMatches(list, decided).find((g) => g.key === key || g.matches.some((x) => x.id === key))
  const found = key ? (find(matches) ?? find(theirs)) : undefined
  // A match opened from a person's dialog lives in that person's details, which a join drops: keep it while open.
  const last = useRef<{ key: string | null; group: MatchGroup | undefined }>({ key: null, group: undefined })
  if (found || last.current.key !== key) last.current = { key, group: found }
  const group = key ? last.current.group : undefined
  const open = group?.matches.filter((x) => !decided[x.id]) ?? []
  const match = open[0] ?? group?.matches[0]
  const done = group !== undefined && open.length === 0
  const people = group?.people ?? []
  const listed = usePeople((s) => s.people)
  const unticked = useUnticked(group?.key ?? "")
  const picking = open.length > 0 && people.length > 2
  const chosen = picking ? people.filter((p) => !unticked.includes(p)) : people

  // A decision re-reads the people and drops the one merged away: what the owner compared stays as it was.
  const kept = useRef<{ key: string | null; people: Record<string, { name: string; person: PersonDetail | null }> }>({
    key: null,
    people: {},
  })
  if (kept.current.key !== key) kept.current = { key, people: {} }
  for (const ref of people) {
    const d = details[ref]
    const had = kept.current.people[ref]
    if (done && had) continue
    kept.current.people[ref] = { name: name(ref), person: d?.state === "ready" ? d.person : (had?.person ?? null) }
  }

  const refs = people.join(" ")
  useEffect(() => {
    if (!refs) return
    for (const ref of refs.split(" ")) {
      // Decided, a person may be merged away: their accounts are not read again, as on the card.
      if (!done && !usePeople.getState().details[ref]) usePeople.getState().need(ref)
      void useProfiles.getState().load(ref)
    }
  }, [refs, done])

  const close = () => {
    usePeople.getState().openMatch(null)
    useProfiles.getState().clear()
  }
  const contacts = people.map((ref) => {
    const p = profiles[ref]
    const row = listed.find((x) => x.ref === ref)
    return contactsOf(kept.current.people[ref]?.person ?? null, p?.state === "ready" ? p.profile : null, row)
  })
  const shared = match ? sharedValue(match, contacts) : null
  const sharedKind = match?.signal === "phone" ? "phone" : "email"
  const sharedKey = keyOf(match?.signal ?? null)
  const same = (kind: "phone" | "email", v: string) =>
    shared !== null && kind === sharedKind && sharedKey(v) === sharedKey(shared)
  const moving = match?.joins === "identity" && match.identity
  const confirmLabel = moving
    ? m.moveAccount
    : picking && chosen.length < people.length
      ? m.joinPicked(chosen.length)
      : people.length > 2
        ? m.mergeAll(people.length)
        : m.merge

  return (
    <Dialog
      open={group !== undefined}
      title={m.matchDetails}
      onClose={close}
      wide="xl"
      scroll
      actions={
        group && (
          <div className="flex w-full flex-col gap-[0.6rem]">
            <MatchActions
              group={group}
              chosen={chosen}
              confirmLabel={confirmLabel}
              hint={picking && chosen.length < 2 && <span className="text-[0.85rem] text-ink-dim">{m.pickTwo}</span>}
            />
          </div>
        )
      }
    >
      {group && match && (
        <div className="flex flex-col gap-[1.1rem] pb-[0.4rem]">
          <SharedSignal match={match} value={shared} />
          {moving && (
            <p className="text-ink-soft">
              {m.moveHeading(moveWords(match, m.anAccount), name(match.persons[1] ?? ""))} {m.moveHelp}
            </p>
          )}
          {match.reason && <p className="selectable max-w-[70ch] text-ink-soft">“{match.reason}”</p>}
          <div className={cx("grid grid-cols-1 gap-x-[2rem] md:grid-cols-2", people.length > 2 && "xl:grid-cols-3")}>
            {people.map((ref, i) => {
              const d = details[ref]
              const p = profiles[ref]
              const row = listed.find((x) => x.ref === ref)
              return (
                <Column
                  key={ref}
                  waiting={!done}
                  left={picking && !chosen.includes(ref)}
                  name={kept.current.people[ref]?.name ?? name(ref)}
                  person={kept.current.people[ref]?.person ?? null}
                  failed={d?.state === "failed" && !kept.current.people[ref]?.person ? d.error : null}
                  profile={p?.state === "ready" ? { state: "ready", profile: withRow(p.profile, row) } : p}
                  contacts={contacts[i] ?? { phones: [], emails: [] }}
                  same={same}
                  tie={shared === null ? tieOf(open.length ? open : group.matches, ref) : null}
                />
              )
            })}
          </div>
        </div>
      )}
    </Dialog>
  )
}

/** What the people share, said plainly: the phone or address itself when it is known. */
function SharedSignal({ match, value }: { match: Match; value: string | null }) {
  const m = useMessages(peopleMessages)
  const signal = match.signal ?? ""
  const by = match.proposer
  const said = m.shared[signal]
  const [Icon, words] = said
    ? [signal === "phone" ? Phone : Mail, said(value)]
    : by?.kind === "agent" && by.name
      ? [Bot, m.sharedAgent(by.name)]
      : by && by.kind !== "rule"
        ? [Link2, m.sharedPerson]
        : [Link2, m.sharedOther]
  return (
    // Opening lands here, not on Merge: Enter must not join two people by accident.
    <p
      data-autofocus
      tabIndex={-1}
      className="flex items-center gap-[0.6rem] rounded-[0.45rem] bg-brand-soft px-[0.9rem] py-[0.65rem] font-medium text-ink step-heading"
    >
      <Icon className="size-[1.1rem] shrink-0 text-brand" aria-hidden />
      <span className="selectable min-w-0">{words}</span>
    </p>
  )
}

/** One row of a person's column; the columns share rows, so each kind of fact lines up across the people. */
function Cell({ label, children, first }: { label?: string; children: ReactNode; first?: boolean }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-[0.45rem] py-[0.8rem]", !first && "border-line border-t")}>
      {label && <h4 className="text-[0.85rem] font-medium text-ink-dim">{label}</h4>}
      {children}
    </div>
  )
}

const sameMark = "rounded-[0.3rem] bg-brand-soft px-[0.35rem] ring-1 ring-brand/40"

function Value({ text, same }: { text: string; same: boolean }) {
  const m = useMessages(peopleMessages)
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-[0.5rem]">
      <span className={cx("selectable font-mono text-[0.95rem] break-all tabular-nums", same && sameMark)}>{text}</span>
      {same && <span className="text-[0.8rem] font-medium text-brand">{m.tie}</span>}
    </span>
  )
}

function Lines() {
  const m = useMessages(peopleMessages)
  return (
    <div className="flex flex-col gap-[0.4rem]">
      <Skeleton className="h-[1.2rem] w-[70%]" label={m.loadingPerson} />
      <Skeleton className="h-[1.2rem] w-[45%]" />
    </div>
  )
}

function Column({
  waiting,
  left,
  name,
  person,
  failed,
  profile,
  contacts,
  same,
  tie,
}: {
  /** Still undecided: a missing read is on its way. Decided, a person merged away is not read again. */
  waiting: boolean
  /** Unticked on the group's card: a join leaves them as they are. */
  left: boolean
  name: string
  person: PersonDetail | null
  failed: string | null
  profile: ProfileRead | undefined
  contacts: Contacts
  same: (kind: "phone" | "email", value: string) => boolean
  tie: string | null
}) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const ready = profile?.state === "ready" ? profile.profile : null
  const loading = !profile || profile.state === "loading"
  const handles = (person?.identities ?? []).filter((i) => i.username)
  const companies = (ready?.organizations ?? []).map((o) => [o.name, o.role].filter(Boolean).join(", ")).filter(Boolean)
  const anything = contacts.phones.length + contacts.emails.length + handles.length + companies.length > 0
  const count = (n: number | null) => (n === null ? m.unknown : formatNumber(n, lang))
  const stats: [string, string][] = ready
    ? [
        [m.lastContact, ready.lastContact ? formatDate(ready.lastContact, { dateStyle: "medium" }, lang) : m.unknown],
        [m.messagesFrom, count(ready.messagesFrom)],
        [m.dealsN, count(ready.deals)],
        [m.tasksN, ready.tasksMore ? `${count(ready.tasks)}+` : count(ready.tasks)],
      ]
    : []

  return (
    <section
      aria-label={name}
      className={cx(
        "row-span-4 grid min-w-0 grid-rows-subgrid transition-opacity duration-(--motion-fast) max-md:not-first:mt-[1.2rem]",
        left && "opacity-60",
      )}
    >
      <Cell first>
        <h3 className="text-[1.08rem] leading-[1.25] font-semibold text-ink">{name}</h3>
        {failed ? (
          <ErrorNotice inline>
            {m.personFailed} {failed}
          </ErrorNotice>
        ) : person ? (
          <ul className="flex flex-col gap-[0.3rem]">
            {person.identities.map((i) => (
              <Source key={i.identity} identity={i} person={name} tie={i.identity === tie} />
            ))}
          </ul>
        ) : waiting ? (
          <Lines />
        ) : null}
      </Cell>
      <Cell label={m.contacts}>
        {anything ? (
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-[0.9rem] gap-y-[0.35rem]">
            <Facts
              label={m.phone}
              values={contacts.phones.map((p) => <Value key={p} text={p} same={same("phone", p)} />)}
            />
            <Facts
              label={m.email}
              values={contacts.emails.map((e) => <Value key={e} text={e} same={same("email", e)} />)}
            />
            <Facts
              label={m.handles}
              values={handles.map((i) => (
                <span key={i.identity} className="flex items-center gap-[0.4rem]">
                  <SourceIcon provider={i.provider} className="text-ink-soft" />
                  <span className="selectable">{accountName(i)}</span>
                </span>
              ))}
            />
            <Facts
              label={m.company}
              values={companies.map((c) => (
                <span key={c} className="selectable">
                  {c}
                </span>
              ))}
            />
          </dl>
        ) : loading || (!person && waiting) ? (
          <Lines />
        ) : (
          <p className="text-ink-dim">{m.noContacts}</p>
        )}
      </Cell>
      <Cell label={m.activity}>
        {profile?.state === "failed" ? (
          <ErrorNotice inline>
            {m.profileFailed} {profile.error}
          </ErrorNotice>
        ) : ready ? (
          <dl className="grid grid-cols-2 gap-x-[1rem] gap-y-[0.5rem]">
            {stats.map(([label, value]) => (
              <div key={label} className="flex min-w-0 flex-col">
                <dt className="text-[0.85rem] text-ink-soft">{label}</dt>
                <dd className="font-medium text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Lines />
        )}
      </Cell>
      <Cell label={m.recent}>
        {ready && ready.recent.length > 0 ? (
          <Recent items={ready.recent} />
        ) : loading ? (
          <Lines />
        ) : (
          <p className="text-ink-dim">{ready ? m.noRecent : m.unknown}</p>
        )}
      </Cell>
    </section>
  )
}

function Facts({ label, values }: { label: string; values: ReactNode[] }) {
  if (values.length === 0) return null
  return (
    <div className="contents">
      <dt className="pt-[0.1rem] text-ink-soft">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-[0.2rem]">{values}</dd>
    </div>
  )
}

/** Where the person comes from, in words, with the way to open it there when the source has a page. */
function Source({ identity: i, person, tie }: { identity: Identity; person: string; tie: boolean }) {
  const m = useMessages(peopleMessages)
  const source = sourceOf(i.provider).name
  const handle = accountName(i)
  const crm = i.provider === "bitrix24" && i.identity.includes("/contact/")
  const extra = handle && handle !== person && !crm ? handle : null
  const href = sourceLink(i.identity, i.username)
  return (
    <li className={cx("flex min-w-0 flex-wrap items-center gap-x-[0.5rem] gap-y-[0.2rem]", tie && sameMark)}>
      <SourceIcon provider={i.provider} className={tie ? "text-brand" : "text-ink-soft"} />
      <span className="text-ink">{crm ? m.contactIn(source) : source}</span>
      {extra && <span className="selectable min-w-0 truncate text-ink-soft">{extra}</span>}
      {href && (
        <button
          type="button"
          onClick={() => void platform.openUrl(href)}
          aria-label={m.openIn(source)}
          title={m.openIn(source)}
          className="inline-flex items-center gap-[0.25rem] rounded-[0.2rem] text-[0.9rem] text-brand transition-colors duration-(--motion-fast) hover:text-brand-hover"
        >
          <ExternalLink className="size-[0.85rem]" aria-hidden />
          {m.openShort}
        </button>
      )}
      {tie && <span className="ml-auto text-[0.8rem] font-medium text-brand">{m.tie}</span>}
    </li>
  )
}

/** The latest messages or meetings; a message opens its conversation in WireCat. */
function Recent({ items }: { items: PersonProfile["recent"] }) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const row = "flex min-w-0 flex-col gap-[0.1rem] rounded-[0.35rem] px-[0.45rem] py-[0.35rem]"
  return (
    <ul className="-mx-[0.45rem] flex flex-col">
      {items.map((r) => {
        const target = r.locator ? linkTargetOf(r.locator) : null
        const where = r.kind === "event" ? m.meeting : (r.chat ?? sourceOf(r.provider ?? "").name)
        const body = (
          <>
            <span className="flex min-w-0 items-center gap-[0.4rem] text-[0.85rem] text-ink-soft">
              {r.kind === "event" ? (
                <CalendarDays className="size-4 shrink-0" aria-hidden />
              ) : (
                <SourceIcon provider={r.provider ?? ""} />
              )}
              <span className="min-w-0 truncate">{where}</span>
              {r.at && (
                <span className="ml-auto shrink-0 tabular-nums">
                  {formatDate(r.at, { day: "numeric", month: "short" }, lang)}
                </span>
              )}
            </span>
            <span className="line-clamp-2 text-ink">
              {r.outgoing && <span className="text-ink-soft">{m.you}: </span>}
              {r.text}
            </span>
          </>
        )
        return (
          <li key={`${r.locator ?? r.kind}|${r.at ?? ""}|${r.text.slice(0, 40)}`}>
            {target && isConversation(target) ? (
              <TextButton
                as="div"
                title={m.openChat(where)}
                className={cx(
                  row,
                  "selectable cursor-pointer transition-colors duration-(--motion-fast) hover:bg-app-2",
                )}
                onClick={() => {
                  usePeople.getState().openMatch(null)
                  useProfiles.getState().clear()
                  openConversation(target)
                }}
              >
                {body}
              </TextButton>
            ) : (
              <div className={cx(row, "selectable")}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

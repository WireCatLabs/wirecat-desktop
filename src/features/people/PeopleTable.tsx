import { AtSign, Building2, Inbox, Mail, Megaphone, Phone, Users, UserX } from "lucide-react"
import { type ReactNode, useEffect } from "react"
import { cleanName, contactOf, filterPeople, looksLikeAccount } from "@/domain/people"
import { formatWhen } from "@/domain/runs"
import { formatNumber, useLang, useMessages } from "@/i18n"
import { type Listed, PEOPLE_SORTS, PERSON_KINDS, type PersonKind } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { type Column, DataTable } from "@/ui/DataTable"
import { EmptyState } from "@/ui/EmptyState"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FilterBar, ToggleChip } from "@/ui/FilterBar"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import { Segmented } from "@/ui/Segmented"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { SourceIcon, sourceOf } from "./sources"
import { usePeople } from "./store"

const KIND_ICONS: Record<PersonKind, ReactNode> = {
  person: <Users className="size-4" aria-hidden />,
  organization: <Building2 className="size-4" aria-hidden />,
  automated: <Megaphone className="size-4" aria-hidden />,
  stranger: <UserX className="size-4" aria-hidden />,
  unsorted: <Inbox className="size-4" aria-hidden />,
}

export function PeopleTable() {
  const m = useMessages(peopleMessages)
  const people = usePeople((s) => s.people)
  const more = usePeople((s) => s.peopleMore)
  const query = usePeople((s) => s.query)
  const withTasks = usePeople((s) => s.withTasks)
  const named = usePeople((s) => s.named)
  const page = usePeople((s) => s.page)
  const size = usePeople((s) => s.pageSize)
  const kinded = usePeople((s) => s.kinded)
  const kind = usePeople((s) => s.kind)
  const kinds = usePeople((s) => s.kinds)
  const reading = usePeople((s) => s.reading)
  const total = usePeople((s) => s.total)
  const sort = usePeople((s) => s.sort)
  const { setQuery, setFilter, setPage, setPageSize, setKind, setSort, findAccount, reveal, want } =
    usePeople.getState()
  const columns = useColumns(kinded)
  const account = looksLikeAccount(query)

  // memo cuts, sorts and searches the pages; only an older memo, which lists everyone at once, is cut here.
  const found = kinded ? people : filterPeople(people, { query, withTasks, named })
  const count = kinded ? (total?.value ?? people.length) : found.length
  const pages = Math.max(1, Math.ceil(count / size))
  const at = kinded ? page : Math.min(page, pages)
  const rows = kinded ? people : found.slice((at - 1) * size, at * size)
  const onScreen = kinded ? "" : rows.map((p) => p.ref).join(" ")
  // biome-ignore lint/correctness/useExhaustiveDependencies: a read drops the details, and `people` is new after it
  useEffect(() => want(onScreen ? onScreen.split(" ") : []), [onScreen, people, want])

  const tabs = kinded && (
    <div className="flex flex-col gap-[0.5rem]">
      <KindTabs kind={kind} kinds={kinds} onKind={setKind} />
      <p className="text-[0.9rem] text-ink-soft">{m.kindHelp[kind]}</p>
    </div>
  )

  if (people.length === 0 && !kinded) return <EmptyState title={m.emptyTitle}>{m.emptyBody}</EmptyState>
  return (
    <section aria-label={m.rows} className="flex flex-col gap-[0.8rem]">
      {tabs}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (account) void findAccount()
        }}
      >
        <FilterBar query={query} onQuery={setQuery} label={m.search} placeholder={m.searchHint}>
          {kinded ? (
            <Select
              size="sm"
              aria-label={m.sortLabel}
              value={sort}
              onChange={setSort}
              options={PEOPLE_SORTS.map((value) => ({ value, label: m.sorts[value] }))}
            />
          ) : (
            <>
              <ToggleChip on={withTasks} onChange={(on) => setFilter({ withTasks: on })}>
                {m.withTasks}
              </ToggleChip>
              <ToggleChip on={named} onChange={(on) => setFilter({ named: on })}>
                {m.named}
              </ToggleChip>
            </>
          )}
          {account && (
            <Button size="sm" type="submit">
              {m.findAccount}
            </Button>
          )}
          {(!kinded || total) && (
            <span className="ml-auto font-mono text-[0.85rem] text-ink-dim tabular-nums">
              {m.everyone(count)}
              {kinded && total?.more ? "+" : ""}
            </span>
          )}
        </FilterBar>
      </form>
      <AccountResult account={query.trim()} />
      {found.length === 0 && !reading ? (
        <p className="text-[0.95rem] text-ink-soft">{query.trim() ? m.noMatch : m.emptyKind}</p>
      ) : (
        <DataTable
          key={kind}
          label={m.rows}
          busy={reading}
          rows={rows}
          rowKey={(p) => p.ref}
          columns={columns}
          density="compact"
          minWidth={kinded ? "52rem" : "34rem"}
          onRowClick={(p) => reveal(p.ref)}
        />
      )}
      {(kinded ? at > 1 || more || count > PAGE_SIZES[0] : count > PAGE_SIZES[0]) && (
        <Pager
          page={at}
          onPage={setPage}
          busy={reading}
          // In a group memo gives no total: the pager then only knows whether there is a next page.
          {...(kinded && !total
            ? { hasMore: more }
            : { total: count, totalMore: kinded ? (total?.more ?? false) : more })}
          size={size}
          sizes={PAGE_SIZES}
          onSize={setPageSize}
        />
      )}
      {more && !kinded && <p className="text-[0.9rem] text-ink-dim">{m.peopleMore}</p>}
    </section>
  )
}

/** The kinds of people, each with its count, as the one switch every page uses. */
function KindTabs(props: {
  kind: PersonKind
  kinds: Partial<Record<PersonKind, { value: number; more: boolean }>>
  onKind: (kind: PersonKind) => void
}) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  return (
    <Segmented<PersonKind>
      size="md"
      label={m.kindsLabel}
      value={props.kind}
      onChange={props.onKind}
      options={PERSON_KINDS.map((k) => {
        const count = props.kinds[k]
        return {
          value: k,
          label: m.kinds[k] ?? k,
          icon: KIND_ICONS[k],
          count: count ? `${formatNumber(count.value, lang)}${count.more ? "+" : ""}` : "—",
        }
      })}
    />
  )
}

function useColumns(kinded: boolean): Column<Listed>[] {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const now = new Date()
  const t = m.columnsKind
  const tasks: Column<Listed> = {
    id: "tasks",
    head: t.tasks,
    width: "5rem",
    className: "text-right tabular-nums",
    cell: (p) => (p.tasks > 0 ? p.tasks : <span className="text-ink-dim">—</span>),
  }
  if (!kinded)
    return [
      { id: "name", head: t.name, width: "minmax(14rem,1fr)", cell: (p) => <Name person={p} /> },
      { id: "contact", head: t.contact, width: "16rem", cell: (p) => <ContactFromAccounts reference={p.ref} /> },
      { ...tasks, sortBy: (p) => p.tasks },
    ]
  return [
    {
      id: "name",
      head: t.name,
      width: "minmax(14rem,1fr)",
      cell: (p) => <Name person={p} />,
    },
    {
      id: "contact",
      head: t.contact,
      width: "15rem",
      cell: (p) => <Contact person={p} />,
    },
    {
      id: "messages",
      head: t.messages,
      width: "9rem",
      className: "text-right tabular-nums",
      cell: (p) => (p.messagesFrom ? formatNumber(p.messagesFrom, lang) : <span className="text-ink-dim">—</span>),
    },
    {
      id: "last",
      head: t.last,
      width: "9.5rem",
      className: "truncate font-mono text-[0.9rem] tabular-nums text-ink-soft",
      cell: (p) => (p.lastContact ? formatWhen(p.lastContact, now, lang) : "—"),
    },
    tasks,
  ]
}

function Name({ person: p }: { person: Listed }) {
  const name = usePersonName()
  const shown = name(p.ref, p.displayName ?? p.name)
  const raw = p.name?.trim()
  return (
    <button
      type="button"
      data-opens={p.ref}
      aria-haspopup="dialog"
      title={raw && raw !== shown ? raw : undefined}
      onClick={(e) => {
        e.stopPropagation()
        usePeople.getState().reveal(p.ref)
      }}
      className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-[0.2rem] text-left focus-visible:outline-2 focus-visible:outline-brand"
    >
      <span
        className={
          cleanName(p.displayName ?? p.name) || p.owner
            ? "truncate font-medium group-hover:text-brand"
            : "truncate text-ink-soft group-hover:text-brand"
        }
      >
        {shown}
      </span>
    </button>
  )
}

/** Phone and email one under the other; with neither, the messenger handle; with nothing, a quiet dash. */
function Contact({ person: p }: { person: Listed }) {
  const m = useMessages(peopleMessages)
  const lines: { icon: ReactNode; value: string; label?: string }[] = [
    ...(p.phone ? [{ icon: <Phone className={ICON} aria-hidden />, value: p.phone }] : []),
    ...(p.email ? [{ icon: <Mail className={ICON} aria-hidden />, value: p.email }] : []),
  ]
  const handle = p.username
  // Which messenger the handle is on arrives with a newer memo; until then it is a bare @name.
  const source = p.usernameSource ? sourceOf(p.usernameSource) : null
  if (lines.length === 0 && handle)
    lines.push(
      source
        ? {
            icon: <SourceIcon provider={p.usernameSource ?? ""} className="text-ink-dim" labelled />,
            value: `@${handle}`,
          }
        : { icon: <AtSign className={ICON} aria-hidden />, value: `@${handle}`, label: m.handle(handle) },
    )
  if (lines.length === 0)
    return (
      <span className="text-ink-dim" title={m.noContact}>
        <span aria-hidden>—</span>
        <span className="sr-only">{m.noContact}</span>
      </span>
    )
  return (
    <span className="flex min-w-0 flex-col gap-[0.15rem] text-[0.92rem] text-ink-soft">
      {lines.map((l) => (
        <span key={l.value} className="flex min-w-0 items-center gap-[0.45rem]" title={l.label}>
          {l.icon}
          <span className="selectable truncate font-mono text-[0.88rem]">{l.value}</span>
        </span>
      ))}
    </span>
  )
}

const ICON = "size-4 shrink-0 text-ink-dim"

/** For an older memo, which gives no contact: the person's phone, else email, else handle, with its source's icon. */
function ContactFromAccounts({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const detail = usePeople((s) => s.details[reference])
  if (!detail || detail.state === "loading") return <Skeleton className="h-[0.9rem] w-[7rem]" />
  if (detail.state === "failed") return <span className="text-ink-dim">—</span>
  const found = contactOf(detail.person.identities)
  if (!found)
    return (
      <span className="text-ink-dim" title={m.noContact}>
        —
      </span>
    )
  return (
    <span className="flex min-w-0 items-center gap-[0.45rem] text-[0.92rem] text-ink-soft">
      <SourceIcon provider={found.provider} className="text-ink-dim" labelled />
      <span className="selectable truncate font-mono text-[0.88rem]">{found.value}</span>
    </span>
  )
}

/** Who has the account the search named, as memo found it exactly; Open opens that person. */
function AccountResult({ account }: { account: string }) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const found = usePeople((s) => s.found)
  if (!found) return null
  return (
    <div role="status" className="text-[0.95rem]">
      {found.state === "looking" ? (
        <span className="text-ink-soft">{m.lookingAccount}</span>
      ) : found.state === "none" ? (
        <span className="text-ink-soft">{m.noAccount(account)}</span>
      ) : found.state === "failed" ? (
        <ErrorNotice raw={found.error} inline>
          {m.readFailed}
        </ErrorNotice>
      ) : (
        <span className="flex flex-wrap items-center gap-x-3">
          {m.accountOf(account, name(found.ref))}
          <Button size="sm" onClick={() => usePeople.getState().reveal(found.ref)}>
            {m.openPerson(name(found.ref))}
          </Button>
        </span>
      )}
    </div>
  )
}

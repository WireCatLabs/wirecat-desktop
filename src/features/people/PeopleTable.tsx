import { AtSign, Building2, Inbox, Mail, Megaphone, Phone, Users, UserX } from "lucide-react"
import { type ReactNode, useEffect } from "react"
import { cleanName, contactOf, filterPeople, looksLikeAccount, personName } from "@/domain/people"
import { formatWhen } from "@/domain/runs"
import { formatNumber, useLang, useMessages } from "@/i18n"
import { type Listed, PERSON_KINDS, type PersonKind } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { type Column, DataTable } from "@/ui/DataTable"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FilterBar, ToggleChip } from "@/ui/FilterBar"
import { PAGE_SIZES, Pager } from "@/ui/Pager"
import { Segmented } from "@/ui/Segmented"
import { Skeleton } from "@/ui/Skeleton"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { SourceIcon } from "./sources"
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
  const lang = useLang()
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
  const { setQuery, setFilter, setPage, setPageSize, setKind, findAccount, reveal, want } = usePeople.getState()
  const columns = useColumns(kinded)
  const account = looksLikeAccount(query)

  // memo already keeps the nameless out of its people; an older memo lists everyone, so the page does it there.
  const found = filterPeople(people, { query, withTasks, named: !kinded && named })
  const pages = Math.max(1, Math.ceil(found.length / size))
  const at = Math.min(page, pages)
  const rows = found.slice((at - 1) * size, at * size)
  const onScreen = kinded ? "" : rows.map((p) => p.ref).join(" ")
  // biome-ignore lint/correctness/useExhaustiveDependencies: a read drops the details, and `people` is new after it
  useEffect(() => want(onScreen ? onScreen.split(" ") : []), [onScreen, people, want])

  const tabs = kinded && (
    <div className="flex flex-col gap-[0.4rem]">
      <Segmented
        size="md"
        label={m.kindsLabel}
        value={kind}
        onChange={setKind}
        options={PERSON_KINDS.map((k) => ({
          value: k,
          icon: KIND_ICONS[k],
          label: kinds[k] === undefined ? (m.kinds[k] ?? k) : `${m.kinds[k] ?? k} ${formatNumber(kinds[k] ?? 0, lang)}`,
        }))}
      />
      <p className="text-[0.9rem] text-ink-soft">{m.kindHelp[kind]}</p>
    </div>
  )

  if (people.length === 0 && !kinded)
    return (
      <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-[0.95rem] text-ink-soft">
        <p className="font-medium text-ink">{m.emptyTitle}</p>
        <p className="mt-1">{m.emptyBody}</p>
      </div>
    )
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
          <ToggleChip on={withTasks} onChange={(on) => setFilter({ withTasks: on })}>
            {m.withTasks}
          </ToggleChip>
          {!kinded && (
            <ToggleChip on={named} onChange={(on) => setFilter({ named: on })}>
              {m.named}
            </ToggleChip>
          )}
          {account && (
            <Button size="sm" type="submit">
              {m.findAccount}
            </Button>
          )}
          <span className="ml-auto font-mono text-[0.85rem] text-ink-dim tabular-nums">{m.everyone(found.length)}</span>
        </FilterBar>
      </form>
      <AccountResult account={query.trim()} />
      {found.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">{people.length === 0 ? m.emptyKind : m.noMatch}</p>
      ) : (
        <DataTable
          key={kind}
          label={m.rows}
          busy={reading}
          rows={kinded ? found : rows}
          rowKey={(p) => p.ref}
          columns={columns}
          density="compact"
          minWidth={kinded ? "52rem" : "34rem"}
          onRowClick={(p) => reveal(p.ref)}
          {...(kinded ? { page: { index: at, size } } : {})}
        />
      )}
      {found.length > PAGE_SIZES[0] && (
        <Pager
          page={at}
          onPage={setPage}
          total={found.length}
          totalMore={more}
          size={size}
          sizes={PAGE_SIZES}
          onSize={setPageSize}
        />
      )}
      {more && <p className="text-[0.9rem] text-ink-dim">{m.peopleMore}</p>}
    </section>
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
    sortBy: (p) => p.tasks,
    className: "text-right tabular-nums",
    cell: (p) => (p.tasks > 0 ? p.tasks : <span className="text-ink-dim">—</span>),
  }
  if (!kinded)
    return [
      { id: "name", head: t.name, width: "minmax(14rem,1fr)", cell: (p) => <Name person={p} /> },
      { id: "contact", head: t.contact, width: "16rem", cell: (p) => <ContactFromAccounts reference={p.ref} /> },
      tasks,
    ]
  return [
    {
      id: "name",
      head: t.name,
      width: "minmax(14rem,1fr)",
      sortBy: (p) => (p.owner ? m.you : (personName(p) ?? m.noName)).toLocaleLowerCase(),
      cell: (p) => <Name person={p} />,
    },
    {
      id: "contact",
      head: t.contact,
      width: "15rem",
      cell: (p) => <Contact value={p.contact} />,
    },
    {
      id: "messages",
      head: t.messages,
      width: "9rem",
      sortBy: (p) => p.messagesFrom ?? -1,
      className: "text-right tabular-nums",
      cell: (p) => (p.messagesFrom ? formatNumber(p.messagesFrom, lang) : <span className="text-ink-dim">—</span>),
    },
    {
      id: "last",
      head: t.last,
      width: "9.5rem",
      sortBy: (p) => p.lastContact ?? "",
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

/** memo's contact as it is: a phone, an email address or a handle, its kind as an icon. */
function Contact({ value }: { value: string | null }) {
  const m = useMessages(peopleMessages)
  if (!value) return <span className="text-[0.9rem] text-ink-dim">{m.noContact}</span>
  const Icon = value.startsWith("@") ? AtSign : value.includes("@") ? Mail : Phone
  return (
    <span className="flex min-w-0 items-center gap-[0.45rem] text-[0.92rem] text-ink-soft">
      <Icon className="size-4 shrink-0 text-ink-dim" aria-hidden />
      <span className="selectable truncate font-mono text-[0.88rem]">{value}</span>
    </span>
  )
}

/** For an older memo, which gives no contact: the person's phone, else email, else handle, with its source's icon. */
function ContactFromAccounts({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const detail = usePeople((s) => s.details[reference])
  if (!detail || detail.state === "loading") return <Skeleton className="h-[0.9rem] w-[7rem]" />
  if (detail.state === "failed") return <span className="text-ink-dim">—</span>
  const found = contactOf(detail.person.identities)
  if (!found) return <span className="text-[0.9rem] text-ink-dim">{m.noContact}</span>
  return (
    <span className="flex min-w-0 items-center gap-[0.45rem] text-[0.92rem] text-ink-soft">
      <SourceIcon provider={found.provider} className="text-ink-dim" />
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
        <ErrorNotice inline>
          {m.readFailed} {found.error}
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

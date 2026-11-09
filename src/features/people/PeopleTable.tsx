import { useEffect } from "react"
import { cleanName, filterPeople, looksLikeAccount } from "@/domain/people"
import { useMessages } from "@/i18n"
import type { Listed } from "@/platform/people-schemas"
import { Button } from "@/ui/Button"
import { type Column, DataTable } from "@/ui/DataTable"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FilterBar, ToggleChip } from "@/ui/FilterBar"
import { Pager } from "@/ui/Pager"
import { Skeleton } from "@/ui/Skeleton"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { SourceIcons } from "./sources"
import { usePeople } from "./store"

/** A page of people; their accounts are read for the rows on screen only. */
export const PAGE = 50

export function PeopleTable() {
  const m = useMessages(peopleMessages)
  const people = usePeople((s) => s.people)
  const more = usePeople((s) => s.peopleMore)
  const query = usePeople((s) => s.query)
  const withTasks = usePeople((s) => s.withTasks)
  const named = usePeople((s) => s.named)
  const page = usePeople((s) => s.page)
  const { setQuery, setFilter, setPage, findAccount, reveal, want } = usePeople.getState()
  const columns = useColumns()
  const account = looksLikeAccount(query)

  const found = filterPeople(people, { query, withTasks, named })
  const pages = Math.max(1, Math.ceil(found.length / PAGE))
  const at = Math.min(page, pages)
  const rows = found.slice((at - 1) * PAGE, at * PAGE)
  const onScreen = rows.map((p) => p.ref).join(" ")
  // biome-ignore lint/correctness/useExhaustiveDependencies: a read drops the details, and `people` is new after it
  useEffect(() => want(onScreen ? onScreen.split(" ") : []), [onScreen, people, want])

  if (people.length === 0)
    return (
      <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-[0.95rem] text-ink-soft">
        <p className="font-medium text-ink">{m.emptyTitle}</p>
        <p className="mt-1">{m.emptyBody}</p>
      </div>
    )
  return (
    <section aria-label={m.rows} className="flex flex-col gap-[0.8rem]">
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
          <ToggleChip on={named} onChange={(on) => setFilter({ named: on })}>
            {m.named}
          </ToggleChip>
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
        <p className="text-[0.95rem] text-ink-soft">{m.noMatch}</p>
      ) : (
        <DataTable
          label={m.rows}
          rows={rows}
          rowKey={(p) => p.ref}
          columns={columns}
          density="compact"
          minWidth="34rem"
          onRowClick={(p) => reveal(p.ref)}
        />
      )}
      {pages > 1 && <Pager page={at} hasMore={at < pages} onPage={setPage} />}
      {more && <p className="text-[0.9rem] text-ink-dim">{m.peopleMore}</p>}
    </section>
  )
}

function useColumns(): Column<Listed>[] {
  const m = useMessages(peopleMessages)
  return [
    { id: "name", head: m.columns.name, width: "minmax(14rem,1fr)", cell: (p) => <Name person={p} /> },
    { id: "accounts", head: m.columns.accounts, width: "13rem", cell: (p) => <Accounts reference={p.ref} /> },
    {
      id: "tasks",
      head: m.columns.tasks,
      width: "5rem",
      className: "text-right tabular-nums",
      cell: (p) => (p.tasks > 0 ? p.tasks : <span className="text-ink-dim">—</span>),
    },
  ]
}

function Name({ person: p }: { person: Listed }) {
  const name = usePersonName()
  const shown = name(p.ref, p.name)
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
          cleanName(p.name) || p.owner
            ? "truncate font-medium group-hover:text-brand"
            : "truncate text-ink-soft group-hover:text-brand"
        }
      >
        {shown}
      </span>
    </button>
  )
}

function Accounts({ reference }: { reference: string }) {
  const m = useMessages(peopleMessages)
  const detail = usePeople((s) => s.details[reference])
  if (!detail || detail.state === "loading") return <Skeleton className="h-[0.9rem] w-[5.5rem]" />
  if (detail.state === "failed") return <span className="text-ink-dim">—</span>
  const n = detail.person.identities.length
  if (n === 0) return <span className="text-[0.9rem] text-ink-dim">{m.noAccounts}</span>
  return (
    <span className="flex items-center gap-[0.7rem]">
      <SourceIcons identities={detail.person.identities} />
      <span className="text-[0.85rem] text-ink-dim tabular-nums">{m.accountsN(n)}</span>
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

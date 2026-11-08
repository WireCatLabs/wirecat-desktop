import { Building2, User, Users } from "lucide-react"
import { accountKey, type Kind, NOBODY, OWN, ownersOf } from "@/domain/clients"
import { setField, valuesOf } from "@/domain/query-terms"
import { useMessages } from "@/i18n"
import type { CrmAccount } from "@/platform/bindings"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FilterBar } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { Segmented } from "@/ui/Segmented"
import { type Ready, useScope, useScopeSet } from "./api"
import { clientMessages } from "./messages"
import { useClients } from "./store"

const name = (a: CrmAccount | null, own: string) => (a ? `${a.provider} · ${a.account}` : own)

/** The search field over the chips Tasks uses: pipeline and account read memo again, the rest narrow this read. */
export function ClientsFilters({ read, kind }: { read: Ready; kind: Kind }) {
  const m = useMessages(clientMessages)
  const query = useClients((s) => s.query)
  const { setQuery, choose } = useClients.getState()
  const current = read.pipelines.find((p) => p.ref === read.pipeline) ?? null
  const accounts = [...new Map(read.pipelines.map((p) => [accountKey(p.account), p.account])).entries()]
  const field = (f: "owner" | "stage") => ({
    selected: valuesOf(query, f),
    onChange: (values: string[]) => setQuery(setField(query, f, values)),
  })
  return (
    <div className="flex flex-col gap-[0.7rem]">
      <FilterBar query={query} onQuery={setQuery} label={m.search} placeholder={m.searchHint}>
        {accounts.length > 1 && (
          <FilterMenu
            label={m.account}
            single
            options={accounts.map(([key, a]) => ({
              value: key,
              label: name(a, m.ownAccount),
              icon: a ? <Building2 className="size-4" aria-hidden /> : <User className="size-4" aria-hidden />,
            }))}
            selected={current ? [accountKey(current.account)] : []}
            onChange={([key]) => {
              const first = read.pipelines.find((p) => accountKey(p.account) === (key ?? OWN))
              if (first) choose(kind, first.ref)
            }}
          />
        )}
        {read.pipelines.length > 1 && (
          <FilterMenu
            label={m.pipeline}
            single
            options={read.pipelines.map((p) => ({
              value: p.ref,
              label: p.name,
              hint: p.account?.provider ?? m.ownAccount,
            }))}
            selected={read.pipeline ? [read.pipeline] : []}
            onChange={([ref]) => ref && choose(kind, ref)}
          />
        )}
        <FilterMenu
          label={m.owner}
          options={ownersOf(read.cards).map((o) => ({ value: o, label: o === NOBODY ? m.nobody : o }))}
          {...field("owner")}
        />
        <FilterMenu
          label={m.stage}
          options={read.stages.map((s) => ({ value: s.name, label: s.name, count: s.items }))}
          {...field("stage")}
        />
      </FilterBar>
      {current?.account && <ScopeSwitch account={current.account} />}
    </div>
  )
}

/** Manager mode: whether the account's sync brings only what is assigned to the owner or the whole account. */
function ScopeSwitch({ account }: { account: CrmAccount }) {
  const m = useMessages(clientMessages)
  const scope = useScope(account)
  const set = useScopeSet(account)
  const answer = scope.data
  const value = set.isPending ? set.variables : (answer?.scope ?? "mine")
  const settable = answer?.kind === "settable" && !set.isPending
  return (
    <div className="flex flex-wrap items-center gap-x-[0.8rem] gap-y-[0.4rem] text-[0.9rem] text-ink-soft">
      <span>
        {m.scope} · {name(account, m.ownAccount)}
      </span>
      <fieldset disabled={!settable} className="contents">
        <Segmented<"mine" | "all">
          label={m.scope}
          value={value ?? "mine"}
          labelClass=""
          onChange={(s) => set.mutate(s)}
          options={[
            { value: "mine", label: m.scopes.mine, icon: <User className="size-4" aria-hidden /> },
            { value: "all", label: m.scopes.all, icon: <Users className="size-4" aria-hidden /> },
          ]}
        />
      </fieldset>
      <span className="max-w-[70ch]">{set.isPending ? m.scopeSaving : m.scopeHint}</span>
      {set.error && <ErrorNotice inline>{m.scopeFailed(set.error.message)}</ErrorNotice>}
    </div>
  )
}

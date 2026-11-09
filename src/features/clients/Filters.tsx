import { Building2, User, Users } from "lucide-react"
import { crmToolOf } from "@/domain/catalog"
import { accountKey, busiestOf, type Kind, NOBODY, OWN, ownersOf } from "@/domain/clients"
import { setField, valuesOf } from "@/domain/query-terms"
import { syncKey, useSync } from "@/features/tools"
import { useMessages } from "@/i18n"
import type { CrmAccount, CrmCard, CrmPipeline } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FilterBar } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { Segmented } from "@/ui/Segmented"
import { type Based, type Ready, useScope, useScopeSet, useWriter } from "./api"
import { clientMessages } from "./messages"
import { useClients } from "./store"

const nameOf = (a: CrmAccount | null, own: string) =>
  a ? `${crmToolOf(a.provider)?.name ?? a.provider} · ${a.account}` : own

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
            required
            options={accounts.map(([key, a]) => ({
              value: key,
              label: nameOf(a, m.ownAccount),
              icon: a ? <Building2 className="size-4" aria-hidden /> : <User className="size-4" aria-hidden />,
            }))}
            selected={current ? [accountKey(current.account)] : []}
            onChange={([key]) => {
              const busiest = busiestOf(read.pipelines.filter((p) => accountKey(p.account) === (key ?? OWN)))
              if (busiest) choose(kind, busiest.ref)
            }}
          />
        )}
        {read.pipelines.length > 1 && (
          <FilterMenu
            label={m.pipeline}
            single
            required
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
      {current?.account && <ScopeSwitch account={current.account} pipelines={read.pipelines} />}
    </div>
  )
}

/**
 * Manager mode: whether the account's sync brings only what is assigned to the owner or the whole account. The CRM's
 * CLI saves it as the account's profile, then the Tools page's runner syncs that profile and the board reads again.
 */
function ScopeSwitch({ account, pipelines }: { account: CrmAccount; pipelines: readonly CrmPipeline[] }) {
  const m = useMessages(clientMessages)
  const { writesWith, profile } = useWriter(account, pipelines)
  const scope = useScope(account, profile)
  const set = useScopeSet(account, profile)
  const tool = crmToolOf(account.provider)
  const phase = useSync((s) => (tool && profile ? s.runs[syncKey(tool.id, profile)]?.phase : undefined))
  const answer = scope.data
  const busy = set.isPending || phase === "running"
  const value = set.isPending ? set.variables : (answer?.scope ?? "mine")
  const settable = answer?.kind === "settable" && !busy
  const why = answer?.kind === "unavailable" ? answer.why : null
  const name = tool?.name ?? account.provider
  const hint =
    why === "crmCliMissing"
      ? m.scopeWhy.crmCliMissing(name)
      : why === "crmCliOld"
        ? m.scopeWhy.crmCliOld(name)
        : why === "crmCli"
          ? m.scopeWhy.crmCli
          : null
  return (
    <div className="flex flex-wrap items-center gap-x-[0.8rem] gap-y-[0.4rem] text-[0.9rem] text-ink-soft">
      <span>
        {m.scope} · {nameOf(account, m.ownAccount)}
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
      {why === "profile" && writesWith && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            useClients.getState().ask({ account, profiles: writesWith.profiles, why: writesWith.why, move: null })
          }
        >
          {m.chooseProfile}
        </Button>
      )}
      <span className="max-w-[70ch] basis-full text-ink-dim">
        {busy ? m.scopeSaving : m.scopeHint}
        {!busy && profile && settable && ` ${m.scopeAs(profile)}`}
        {!busy && hint && ` ${hint}`}
        {!busy && answer?.applied && ` ${m.applied(answer.applied.mode)}`}
      </span>
      {set.error && <ErrorNotice inline>{m.scopeFailed(set.error.message)}</ErrorNotice>}
    </div>
  )
}

/**
 * The base board's filters: account and pipeline narrow the cards of every pipeline, as owner and stage do. Each CRM
 * account with cards on screen gets its own sync switch.
 */
export function BaseFilters({ read, shown }: { read: Based; shown: readonly CrmCard[] }) {
  const m = useMessages(clientMessages)
  const query = useClients((s) => s.query)
  const pipelines = useClients((s) => s.pipelines)
  const accounts = useClients((s) => s.accounts)
  const { setQuery, setPipelines, setAccounts } = useClients.getState()
  const listed = [...new Map(read.pipelines.map((p) => [accountKey(p.account), p.account])).entries()]
  const offered = read.pipelines.filter((p) => accounts.length === 0 || accounts.includes(accountKey(p.account)))
  const crms = [
    ...new Map(shown.flatMap((c) => (c.account ? [[accountKey(c.account), c.account] as const] : []))).values(),
  ]
  const field = (f: "owner" | "stage") => ({
    selected: valuesOf(query, f),
    onChange: (values: string[]) => setQuery(setField(query, f, values)),
  })
  return (
    <div className="flex flex-col gap-[0.7rem]">
      <FilterBar query={query} onQuery={setQuery} label={m.search} placeholder={m.searchHint}>
        {listed.length > 1 && (
          <FilterMenu
            label={m.account}
            options={listed.map(([key, a]) => ({
              value: key,
              label: nameOf(a, m.ownAccount),
              icon: a ? <Building2 className="size-4" aria-hidden /> : <User className="size-4" aria-hidden />,
            }))}
            selected={accounts}
            onChange={(keys) => {
              setAccounts(keys)
              const kept = (ref: string) =>
                read.pipelines.some((p) => p.ref === ref && keys.includes(accountKey(p.account)))
              setPipelines(keys.length === 0 ? pipelines : pipelines.filter(kept))
            }}
          />
        )}
        {offered.length > 1 && (
          <FilterMenu
            label={m.pipeline}
            options={offered.map((p) => ({ value: p.ref, label: p.name, hint: p.account?.provider ?? m.ownAccount }))}
            selected={pipelines}
            onChange={setPipelines}
          />
        )}
        <FilterMenu
          label={m.owner}
          options={ownersOf(read.cards).map((o) => ({ value: o, label: o === NOBODY ? m.nobody : o }))}
          {...field("owner")}
        />
        <FilterMenu
          label={m.stage}
          options={[...new Set(read.cards.map((c) => c.stage))].map((st) => ({ value: st, label: st }))}
          {...field("stage")}
        />
      </FilterBar>
      {crms.map((a) => (
        <ScopeSwitch key={accountKey(a)} account={a} pipelines={read.pipelines} />
      ))}
    </div>
  )
}

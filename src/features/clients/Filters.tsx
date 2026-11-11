import { Building2, User } from "lucide-react"
import { type CatalogTool, crmToolOf, syncsHere } from "@/domain/catalog"
import { accountKey, inScope, NOBODY, ownersOf } from "@/domain/clients"
import { setField, valuesOf } from "@/domain/query-terms"
import { SyncButton, SyncFollowUp, SyncStatus, syncKey, useSync, useSyncControl } from "@/features/tools"
import { useMessages } from "@/i18n"
import type { CrmAccount, CrmCard, CrmPipeline } from "@/platform/bindings"
import { ToolIcon } from "@/shared/ToolIcon"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FilterBar } from "@/ui/FilterBar"
import { FilterMenu } from "@/ui/FilterMenu"
import { InfoTip } from "@/ui/InfoTip"
import { type Based, useScope, useScopeSet, useStageName, useWriter } from "./api"
import { clientMessages } from "./messages"
import { useClients } from "./store"

const nameOf = (a: CrmAccount | null, own: string) =>
  a ? `${crmToolOf(a.provider)?.name ?? a.provider} · ${a.account}` : own

/**
 * The account's sync brings only what is assigned to the owner: the owner's ruling (2026-11-10) is that another client
 * is found in the CRM itself. A scope of everyone's set before stops the CRM's sync, so it gets a way back to mine.
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
  const everyone = answer?.scope === "all" && !set.isSuccess
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
  const who = answer?.applied?.mode === "mine" ? answer.applied.also : null
  return (
    <section aria-label={nameOf(account, m.ownAccount)} className="flex flex-col gap-[0.4rem]">
      <div className="flex min-h-[2.25rem] flex-wrap items-center gap-x-[0.8rem] gap-y-[0.4rem] text-[0.9rem] text-ink-soft">
        <span className="inline-flex min-w-0 items-center gap-[0.4rem]">
          {tool && <ToolIcon id={tool.id} className="size-4 shrink-0" />}
          <span className="font-medium text-ink">{nameOf(account, m.ownAccount)}</span>
          {!everyone && <span>· {m.scopeWho(who)}</span>}
          {busy ? (
            <span className="text-ink-dim">{m.scopeSaving}</span>
          ) : (
            <InfoTip label={m.scopeAbout}>
              {m.scopeHint}
              {profile && settable && ` ${m.scopeAs(profile)}`}
              {hint && ` ${hint}`}
              {answer?.applied && ` ${m.applied(answer.applied.mode)}`}
            </InfoTip>
          )}
        </span>
        {everyone && (
          <>
            <ErrorNotice inline>{m.scopeAll}</ErrorNotice>
            <Button size="sm" disabled={!settable} onClick={() => set.mutate("mine")}>
              {m.scopeToMine}
            </Button>
          </>
        )}
        {why === "profile" && writesWith && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              useClients.getState().ask({ account, profiles: writesWith.profiles, why: writesWith.why, move: null })
            }
          >
            {m.chooseProfile}
          </Button>
        )}
        {tool && profile && syncsHere(tool) && (
          <CrmSync tool={tool} profile={profile} name={nameOf(account, m.ownAccount)} />
        )}
      </div>
      {set.error && (
        <ErrorNotice inline raw={set.error.message}>
          {m.scopeFailed}
        </ErrorNotice>
      )}
    </section>
  )
}

/** The CRM profile's own sync, as the Tools page runs it: when it last ran, its progress, and Sync. */
function CrmSync({ tool, profile, name }: { tool: CatalogTool; profile: string; name: string }) {
  const c = useSyncControl(tool, profile)
  return (
    <>
      <span className="ml-auto flex min-w-[12rem] items-center justify-end gap-3">
        <SyncStatus c={c} />
        <SyncButton c={c} name={name} />
      </span>
      <div className="basis-full empty:hidden">
        <SyncFollowUp c={c} />
      </div>
    </>
  )
}

/**
 * The base board's filters: account and pipeline narrow the cards of every pipeline, as owner and stage do. Each CRM
 * account with cards on screen gets its own sync switch.
 */
export function BaseFilters({ read, shown }: { read: Based; shown: readonly CrmCard[] }) {
  const m = useMessages(clientMessages)
  const names = useStageName(useClients((s) => s.kind))
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
  // Owners and stages of the chosen accounts and pipelines only: one of another CRM would empty the list. A value
  // chosen before stays offered, so it can be taken off.
  const scoped = read.cards.filter((c) => inScope(c, pipelines, accounts))
  const offeredOf = (f: "owner" | "stage", found: readonly string[]) => [...new Set([...found, ...valuesOf(query, f)])]
  return (
    <div className="flex flex-col gap-[0.7rem]">
      {crms.map((a) => (
        <ScopeSwitch key={accountKey(a)} account={a} pipelines={read.pipelines} />
      ))}
      <FilterBar query={query} onQuery={setQuery} label={m.search} placeholder={m.searchHint} inline>
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
            options={offered.map((p) => ({
              value: p.ref,
              label: names.pipeline(p.name, p.account !== null),
              hint: p.account?.provider ?? m.ownAccount,
            }))}
            selected={pipelines}
            onChange={setPipelines}
          />
        )}
        <FilterMenu
          label={m.owner}
          options={offeredOf("owner", ownersOf(scoped)).map((o) => ({ value: o, label: o === NOBODY ? m.nobody : o }))}
          {...field("owner")}
        />
        <FilterMenu
          label={m.stage}
          options={offeredOf(
            "stage",
            scoped.map((c) => c.stage),
          ).map((st) => ({
            value: st,
            label: names.stage(st, !scoped.some((c) => c.account === null && c.stage === st)),
          }))}
          {...field("stage")}
        />
      </FilterBar>
    </div>
  )
}

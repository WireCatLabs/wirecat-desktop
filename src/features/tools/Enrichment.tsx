import { AlertTriangle } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { isLocalHost } from "@/domain/ai-model"
import type { CatalogTool } from "@/domain/catalog"
import { formatUsd } from "@/domain/mail-agent"
import type { SyncEnrichment } from "@/domain/sync"
import { formatDate, formatNumber, type Lang, useLang, useMessages } from "@/i18n"
import type { EnrichmentMeasured, EnrichmentOffer, EnrichmentStatus, EnrichmentTarget } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { type EnrichmentChoice, useEnrichment, useEnrichmentPreview, useSetEnrichment } from "./api"
import { ModelAddressFields, useRefusalText } from "./ModelAddressFields"
import { type EnrichmentText, enrichmentMessages } from "./messages-enrichment"
import { ProviderKey, providerName } from "./ProviderKey"
import { syncKey, useSync } from "./sync-store"

type Done = { on: true } | { on: false; deleted: number } | null

/** memo's four benchmark shares as whole percents, or nothing when one is missing. */
function percents(m: EnrichmentMeasured | null | undefined): [number, number, number, number] | null {
  const all = m ? [m.rewordedOff, m.rewordedOn, m.ownWordsFirstOff, m.ownWordsFirstOn] : []
  if (all.length !== 4 || all.some((x) => x === null)) return null
  const [a, b, c, d] = all.map((x) => Math.round((x ?? 0) * 100))
  return [a ?? 0, b ?? 0, c ?? 0, d ?? 0]
}

const scenario = () => (platform.kind === "mock" ? new URLSearchParams(window.location.search).get("enrich") : null)
/**
 * Browser build only: `?enrich=consent` opens the consent step without a click, and `?enrich=address` opens it on a
 * plain-http address on another computer, for review captures.
 */
const consentByScenario = () => scenario() === "consent" || scenario() === "address"
const choiceByScenario = (): EnrichmentChoice | null =>
  scenario() === "address"
    ? { provider: "openai", model: "llama3.1:8b", baseUrl: "http://192.168.1.20:11434/v1" }
    : null

// Long enough that typing a model name or an address asks memo once, not at every letter.
const TYPING_MS = 600

/** Where the records go, as the owner knows it: the provider, or the address he gave. */
const whereOf = (t: EnrichmentTarget) => (t.baseUrl ? t.endpointHost : providerName(t.provider))
/** A model at an address is asked about only once both are typed. */
const complete = (c: EnrichmentChoice) => c.baseUrl === null || (c.baseUrl.trim() !== "" && c.model.trim() !== "")

function usdText(m: EnrichmentText, usd: number, lang: Lang) {
  return usd > 0 && usd < 0.01 ? m.lessThanCent : formatUsd(usd, lang)
}

const defaultChoice = (offered: EnrichmentOffer[]): EnrichmentChoice | null => {
  const offer = offered.find((o) => o.default) ?? offered[0]
  return offer ? { provider: offer.provider, model: offer.model, baseUrl: null } : null
}

/**
 * memo's search rewriting: a hosted model writes facts and questions beside each record. Off until the owner reads, in
 * this section, exactly what goes where and what it costs (memo's own preview), and agrees.
 */
export function Enrichment({ tool }: { tool: CatalogTool }) {
  const m = useMessages(enrichmentMessages)
  const headingId = useId()
  const state = useEnrichment(tool.id)
  const preview = useEnrichmentPreview(tool.id)
  const change = useSetEnrichment(tool.id)
  const refusalText = useRefusalText()
  const [consenting, setConsenting] = useState(consentByScenario)
  const [choice, setChoice] = useState<EnrichmentChoice | null>(choiceByScenario)
  const [confirmingOff, setConfirmingOff] = useState(false)
  const [done, setDone] = useState<Done>(null)
  const { mutate: ask } = preview

  const answer = state.data
  const status = answer?.state === "ready" ? answer.status : null
  const offered = status?.offered
  const chosen = useMemo(() => choice ?? (offered ? defaultChoice(offered) : null), [choice, offered])

  useEffect(() => {
    if (!consenting || !chosen || !complete(chosen)) return
    const timer = setTimeout(() => ask(chosen), chosen.baseUrl === null ? 0 : TYPING_MS)
    return () => clearTimeout(timer)
  }, [consenting, chosen, ask])

  // A sync is when memo rewrites the waiting records, so the counts are read again after each one.
  const lastSync = useSync((s) => s.runs[syncKey(tool.id, null)])
  const syncEnded = lastSync?.endedAt ?? null
  const { refetch } = state
  useEffect(() => {
    if (syncEnded !== null) refetch()
  }, [syncEnded, refetch])

  if (!tool.enrichment) return null
  const view = !answer ? "loading" : answer.state === "old" ? "old" : status?.on ? "on" : consenting ? "consent" : "off"
  const measured = percents(status?.measured)

  const turnOn = () => {
    if (!chosen) return
    change.mutate(chosen, {
      onSuccess: () => {
        setConsenting(false)
        setDone({ on: true })
      },
    })
  }
  const turnOff = () => {
    setConfirmingOff(false)
    change.mutate(null, { onSuccess: (s) => setDone({ on: false, deleted: s.deleted ?? 0 }) })
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 border-line border-t pt-4 lg:col-span-2"
    >
      <h4 id={headingId} className="text-[1.02rem] font-semibold text-ink">
        {m.title}
      </h4>
      <p className="max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">{m.what}</p>
      {measured && (
        <p className="max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-dim">{m.measured(...measured)}</p>
      )}
      <Collapse open={state.isError}>
        <ErrorNotice inline raw={state.isError ? errorText(state.error) : null}>
          {state.isError && m.readFailed}
        </ErrorNotice>
      </Collapse>
      <AutoHeight swap={view} className="max-w-[44rem]">
        <Crossfade swap={view}>
          {view === "loading" && !state.isError && <Skeleton className="h-[2.25rem] w-full max-w-[28rem]" />}
          {answer?.state === "old" && <p className="text-[0.9rem] text-ink-soft">{m.old(answer.version)}</p>}
          {view === "off" && status && (
            <Off
              m={m}
              status={status}
              deleted={done?.on === false ? done.deleted : null}
              onTurnOn={() => {
                setDone(null)
                setConsenting(true)
              }}
            />
          )}
          {view === "consent" && status && chosen && (
            <Consent
              m={m}
              toolId={tool.id}
              offered={status.offered}
              addresses={status.addresses}
              chosen={chosen}
              onChoose={(c) => {
                preview.reset()
                setChoice(c)
              }}
              preview={preview.isPending || !complete(chosen) ? null : (preview.data ?? null)}
              error={preview.isError ? preview.error : null}
              busy={change.isPending}
              onRetry={() => ask(chosen)}
              onAgree={turnOn}
              onCancel={() => {
                setConsenting(false)
                setChoice(null)
                preview.reset()
                change.reset()
              }}
            />
          )}
          {view === "on" && status && (
            <On
              m={m}
              toolId={tool.id}
              status={status}
              justOn={done?.on === true}
              sync={lastSync?.phase === "done" ? (lastSync.summary?.enrichment ?? null) : null}
              busy={change.isPending}
              onOff={() => setConfirmingOff(true)}
            />
          )}
        </Crossfade>
      </AutoHeight>
      <Collapse open={change.isError}>
        <ErrorNotice inline>
          {change.isError &&
            (change.variables
              ? (refusalText(change.error) ?? m.failedOn(errorText(change.error)))
              : m.failedOff(errorText(change.error)))}
        </ErrorNotice>
      </Collapse>
      <Dialog
        open={confirmingOff}
        title={m.offTitle}
        onClose={() => setConfirmingOff(false)}
        actions={
          <>
            <Button variant="secondary" data-autofocus onClick={() => setConfirmingOff(false)}>
              {m.keepOn}
            </Button>
            <Button variant="danger" onClick={turnOff}>
              {m.offConfirm}
            </Button>
          </>
        }
      >
        <p>{m.offWhat(m.records(status?.enriched ?? 0))}</p>
      </Dialog>
    </section>
  )
}

function Off(props: { m: EnrichmentText; status: EnrichmentStatus; deleted: number | null; onTurnOn: () => void }) {
  const { m, status, deleted, onTurnOn } = props
  const lang = useLang()
  const { target, estimate } = status
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.9rem] text-ink-soft" aria-live="polite">
        {deleted !== null ? m.turnedOff(m.records(deleted)) : m.off}
        {target && estimate.usd !== null && status.pending > 0 && (
          <> {m.offCost(m.records(status.pending), whereOf(target), usdText(m, estimate.usd, lang))}</>
        )}
      </p>
      <div>
        <Button size="sm" variant="secondary" onClick={onTurnOn}>
          {m.turnOn}
        </Button>
      </div>
    </div>
  )
}

function EnrichmentKey(props: {
  m: EnrichmentText
  toolId: string
  target: EnrichmentTarget
  keys: boolean
  onChanged?: () => void
}) {
  const { m, toolId, target, keys, onChanged } = props
  const envVar = target.key.envVar
  return (
    <ProviderKey
      toolId={toolId}
      provider={target.provider}
      found={target.key}
      keys={keys}
      missing={!keys && envVar ? m.keyMissing(envVar) : m.keyMissingGeneric}
      onChanged={onChanged}
      local={isLocalHost(target.endpointHost)}
    />
  )
}

function Consent(props: {
  m: EnrichmentText
  toolId: string
  offered: EnrichmentOffer[]
  addresses: boolean
  chosen: EnrichmentChoice
  onChoose: (c: EnrichmentChoice) => void
  preview: EnrichmentStatus | null
  error: unknown
  busy: boolean
  onRetry: () => void
  onAgree: () => void
  onCancel: () => void
}) {
  const { m, toolId, offered, addresses, chosen, onChoose, preview, error, busy, onRetry, onAgree, onCancel } = props
  const lang = useLang()
  const titleId = useId()
  const groupName = useId()
  const refused = useRefusalText()(error)
  const atAddress = chosen.baseUrl !== null
  // What was typed for a model at an address stays while the owner looks at memo's offers.
  const [own, setOwn] = useState({ model: atAddress ? chosen.model : "", baseUrl: chosen.baseUrl ?? "" })
  const chooseOwn = (next: typeof own) => {
    setOwn(next)
    onChoose({ provider: "openai", model: next.model, baseUrl: next.baseUrl })
  }
  const target = preview?.target ?? null
  const records = preview ? m.records(preview.pending) : ""
  const input = preview ? formatNumber(preview.estimate.inputTokens, lang) : ""
  const output = preview ? formatNumber(preview.estimate.outputTokens, lang) : ""
  const price = (usd: number | null) => (usd === null ? "?" : formatUsd(usd, lang))
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-[0.35rem] border border-line bg-app px-4 py-3.5"
    >
      <h5 id={titleId} className="font-semibold text-ink">
        {m.consentTitle}
      </h5>
      {(offered.length > 1 || addresses) && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[0.9rem] font-medium text-ink-dim">{m.modelLabel}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {offered.map((o) => (
              <label key={`${o.provider}/${o.model}`} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={groupName}
                  checked={!atAddress && o.provider === chosen.provider && o.model === chosen.model}
                  disabled={busy}
                  onChange={() => onChoose({ provider: o.provider, model: o.model, baseUrl: null })}
                  className="peer sr-only"
                />
                <span className="flex h-full flex-col gap-0.5 rounded-[0.35rem] border border-line-strong px-3 py-2 transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2">
                  <span className="text-[0.9rem] font-medium text-ink">
                    {m.offer(providerName(o.provider), o.model)}
                    {o.default && <span className="font-normal text-ink-dim"> · {m.memoDefault}</span>}
                  </span>
                  <span className="text-[0.8rem] text-ink-soft tabular-nums">
                    {m.offerPrice(price(o.usdPerMillionInput), price(o.usdPerMillionOutput))}
                  </span>
                </span>
              </label>
            ))}
            {addresses && (
              <label className="relative cursor-pointer">
                <input
                  type="radio"
                  name={groupName}
                  checked={atAddress}
                  disabled={busy}
                  onChange={() => chooseOwn(own)}
                  className="peer sr-only"
                />
                <span className="flex h-full flex-col gap-0.5 rounded-[0.35rem] border border-line-strong px-3 py-2 transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2">
                  <span className="text-[0.9rem] font-medium text-ink">{m.ownOffer}</span>
                  <span className="text-[0.8rem] text-ink-soft">{m.ownOfferNote}</span>
                </span>
              </label>
            )}
          </div>
        </fieldset>
      )}
      {atAddress && (
        <ModelAddressFields
          model={own.model}
          onModel={(model) => chooseOwn({ ...own, model })}
          modelLabel={m.modelLabel}
          modelHelp={m.ownModelHelp}
          address={own.baseUrl}
          onAddress={(baseUrl) => chooseOwn({ ...own, baseUrl })}
          addressLabel={m.addressLabel}
          addressHelp={m.addressHelp}
          withAddress
          disabled={busy}
        />
      )}
      {!complete(chosen) && <p className="text-[0.875rem] text-ink-dim">{m.ownNeeds}</p>}
      {complete(chosen) && !preview && !error && <Skeleton className="h-[7.5rem] w-full" label={m.counting} />}
      {error !== null && (
        <ErrorNotice
          raw={refused ? null : errorText(error)}
          inline
          action={
            refused ? undefined : (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                {m.tryAgain}
              </Button>
            )
          }
        >
          {refused ?? m.previewFailed}
        </ErrorNotice>
      )}
      {preview && target && (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.9rem] leading-relaxed text-ink">
          <li>{m.sends(records)}</li>
          <li>
            {target.baseUrl
              ? isLocalHost(target.endpointHost)
                ? m.toHere(target.endpointHost, target.model)
                : m.toAddress(target.endpointHost, target.model)
              : m.to(providerName(target.provider), target.endpointHost, target.model)}
          </li>
          <li>
            {preview.estimate.usd === null
              ? m.costUnknown(input, output)
              : m.cost(usdText(m, preview.estimate.usd, lang), input, output)}
          </li>
          {preview.perSync !== null && preview.syncsNeeded !== null && preview.syncsNeeded > 0 && (
            <li>{m.pace(m.records(preview.perSync), m.syncs(preview.syncsNeeded))}</li>
          )}
          <li>{m.kept}</li>
          <li className="-ml-5 list-none">
            <EnrichmentKey m={m} toolId={toolId} target={target} keys={preview.keys} onChanged={onRetry} />
          </li>
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="primary" disabled={!preview || busy} onClick={onAgree}>
          {preview && target ? m.agree(records, whereOf(target)) : m.turnOn}
        </Button>
        <Button size="sm" disabled={busy} onClick={onCancel}>
          {m.cancel}
        </Button>
        {busy && (
          <span className="text-[0.9rem] text-ink-dim" aria-live="polite">
            {m.turningOn}
          </span>
        )}
      </div>
    </section>
  )
}

function SyncLine({ m, sync }: { m: EnrichmentText; sync: SyncEnrichment }) {
  const lang = useLang()
  if (sync.status === "done") {
    const cost = sync.costUsd === null ? null : usdText(m, sync.costUsd, lang)
    return <p>{m.lastSyncDone(m.records(sync.sent), formatNumber(sync.enriched, lang), sync.failed, cost)}</p>
  }
  const reason =
    (sync.reasonId && Object.hasOwn(m.reasons, sync.reasonId) ? m.reasons[sync.reasonId] : undefined) ??
    sync.reason ??
    ""
  return (
    <p className="flex items-start gap-2 text-ink">
      <AlertTriangle className="mt-[0.2rem] size-4 shrink-0 text-warn" aria-hidden />
      <span>{sync.status === "stopped" ? m.lastSyncStopped(reason) : m.lastSyncFailed(reason)}</span>
    </p>
  )
}

function On(props: {
  m: EnrichmentText
  toolId: string
  status: EnrichmentStatus
  justOn: boolean
  sync: SyncEnrichment | null
  busy: boolean
  onOff: () => void
}) {
  const { m, toolId, status, justOn, sync, busy, onOff } = props
  const lang = useLang()
  const target = status.target
  const provider = target ? whereOf(target) : ""
  const when = status.consentedAt
    ? formatDate(status.consentedAt, { dateStyle: "medium", timeStyle: "short" }, lang)
    : ""
  const usd = status.estimate.usd === null ? null : usdText(m, status.estimate.usd, lang)
  return (
    <div className="flex flex-col gap-2 text-[0.9rem] text-ink-soft" aria-live="polite">
      {justOn && <p className="font-medium text-ink">{m.turnedOn(provider)}</p>}
      {target && (
        <p>
          {target.baseUrl
            ? m.onSinceAt(when, target.model, target.endpointHost)
            : m.onSince(when, provider, target.model, target.endpointHost)}
        </p>
      )}
      <p className="tabular-nums">
        {m.progress(formatNumber(status.enriched, lang), m.records(status.records))}{" "}
        {status.pending > 0 ? m.waiting(m.records(status.pending), status.syncsNeeded ?? 1, usd) : m.allDone}
      </p>
      {target && <EnrichmentKey m={m} toolId={toolId} target={target} keys={status.keys} />}
      {sync && <SyncLine m={m} sync={sync} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" disabled={busy} onClick={onOff}>
          {m.turnOff}
        </Button>
        {busy && <span className="text-ink-dim">{m.turningOff}</span>}
      </div>
    </div>
  )
}

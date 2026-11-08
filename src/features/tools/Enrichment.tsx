import { useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { formatUsd } from "@/domain/mail-agent"
import { formatDate, formatNumber, useLang, useMessages } from "@/i18n"
import type { EnrichmentStatus } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { useEnrichment, useEnrichmentPreview, useSetEnrichment } from "./api"
import { type EnrichmentText, enrichmentMessages } from "./messages-enrichment"

type Offer = NonNullable<CatalogTool["enrichment"]>
type Done = { on: true } | { on: false; deleted: number } | null

const PROVIDERS: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic" }

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

const hostOf = (endpoint: string | null) => {
  if (!endpoint) return null
  try {
    return new URL(endpoint).host
  } catch {
    return null
  }
}

/** Browser build only: `?enrich=consent` opens the consent step without a click, for review captures. */
const consentByScenario = () =>
  platform.kind === "mock" && new URLSearchParams(window.location.search).get("enrich") === "consent"

function usdText(m: EnrichmentText, usd: number, lang: string) {
  return usd > 0 && usd < 0.01 ? m.lessThanCent : formatUsd(usd, lang)
}

/**
 * memo's search rewriting: a hosted model writes facts and questions beside each record. Off until the owner reads, in
 * this section, exactly what goes where and what it costs (memo's own preview), and agrees.
 */
export function Enrichment({ tool }: { tool: CatalogTool }) {
  const offer = tool.enrichment
  const m = useMessages(enrichmentMessages)
  const headingId = useId()
  const state = useEnrichment(tool.id)
  const preview = useEnrichmentPreview(tool.id)
  const change = useSetEnrichment(tool.id)
  const [consenting, setConsenting] = useState(consentByScenario)
  const [confirmingOff, setConfirmingOff] = useState(false)
  const [done, setDone] = useState<Done>(null)
  const { mutate: ask } = preview

  useEffect(() => {
    if (consenting) ask()
  }, [consenting, ask])

  if (!offer) return null
  const answer = state.data
  const status = answer?.state === "ready" ? answer.status : null
  const view = !answer ? "loading" : answer.state === "old" ? "old" : status?.on ? "on" : consenting ? "consent" : "off"

  const turnOn = () =>
    change.mutate(true, {
      onSuccess: () => {
        setConsenting(false)
        setDone({ on: true })
      },
    })
  const turnOff = () => {
    setConfirmingOff(false)
    change.mutate(false, { onSuccess: (s) => setDone({ on: false, deleted: s.deleted ?? 0 }) })
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
      <p className="max-w-[70ch] text-[0.875rem] leading-relaxed text-ink-dim">{m.measured}</p>
      <Collapse open={state.isError}>
        <ErrorNotice inline>{state.isError && m.readFailed(messageOf(state.error))}</ErrorNotice>
      </Collapse>
      <AutoHeight swap={view} className="max-w-[44rem]">
        <Crossfade swap={view}>
          {view === "loading" && !state.isError && <Skeleton className="h-[2.25rem] w-full max-w-[28rem]" />}
          {answer?.state === "old" && <p className="text-[0.9rem] text-ink-soft">{m.old(answer.version)}</p>}
          {view === "off" && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDone(null)
                  setConsenting(true)
                }}
              >
                {m.turnOn}
              </Button>
              <span className="text-[0.9rem] text-ink-soft" aria-live="polite">
                {done?.on === false ? m.turnedOff(m.records(done.deleted)) : m.off}
              </span>
            </div>
          )}
          {view === "consent" && (
            <Consent
              m={m}
              offer={offer}
              preview={preview.data ?? null}
              error={preview.isError ? messageOf(preview.error) : null}
              busy={change.isPending}
              onRetry={() => ask()}
              onAgree={turnOn}
              onCancel={() => {
                setConsenting(false)
                preview.reset()
                change.reset()
              }}
            />
          )}
          {view === "on" && status && (
            <On
              m={m}
              offer={offer}
              status={status}
              justOn={done?.on === true}
              busy={change.isPending}
              onOff={() => setConfirmingOff(true)}
            />
          )}
        </Crossfade>
      </AutoHeight>
      <Collapse open={change.isError}>
        <ErrorNotice inline>
          {change.isError &&
            (change.variables ? m.failedOn(messageOf(change.error)) : m.failedOff(messageOf(change.error)))}
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

function Consent(props: {
  m: EnrichmentText
  offer: Offer
  preview: EnrichmentStatus | null
  error: string | null
  busy: boolean
  onRetry: () => void
  onAgree: () => void
  onCancel: () => void
}) {
  const { m, offer, preview, error, busy, onRetry, onAgree, onCancel } = props
  const lang = useLang()
  const titleId = useId()
  const records = preview ? m.records(preview.pending) : ""
  const tokens = preview
    ? [formatNumber(preview.estimate.inputTokens, lang), formatNumber(preview.estimate.outputTokens, lang)]
    : ["", ""]
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-[0.35rem] border border-line bg-app px-4 py-3.5"
    >
      <h5 id={titleId} className="font-semibold text-ink">
        {m.consentTitle}
      </h5>
      {!preview && !error && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <Skeleton className="h-[5.5rem] w-full" label={m.counting} />
        </div>
      )}
      {error && (
        <ErrorNotice
          inline
          action={
            <Button size="sm" variant="secondary" onClick={onRetry}>
              {m.tryAgain}
            </Button>
          }
        >
          {m.previewFailed(error)}
        </ErrorNotice>
      )}
      {preview && (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.9rem] leading-relaxed text-ink">
          <li>{m.sends(records)}</li>
          <li>{m.to(offer.provider, offer.host, offer.model)}</li>
          <li>
            {preview.estimate.usd === null
              ? m.costUnknown(tokens[0] ?? "", tokens[1] ?? "")
              : m.cost(usdText(m, preview.estimate.usd, lang), tokens[0] ?? "", tokens[1] ?? "")}
          </li>
          <li>{m.kept}</li>
          <li className="text-ink-soft">{m.key(offer.keyVariable)}</li>
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="primary" disabled={!preview || busy} onClick={onAgree}>
          {preview ? m.agree(records, offer.provider) : m.turnOn}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
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

function On(props: {
  m: EnrichmentText
  offer: Offer
  status: EnrichmentStatus
  justOn: boolean
  busy: boolean
  onOff: () => void
}) {
  const { m, offer, status, justOn, busy, onOff } = props
  const lang = useLang()
  const provider = (status.provider && PROVIDERS[status.provider]) ?? status.provider ?? offer.provider
  const host = hostOf(status.endpoint) ?? offer.host
  const when = status.consentedAt
    ? formatDate(status.consentedAt, { dateStyle: "medium", timeStyle: "short" }, lang)
    : ""
  const usd = status.estimate.usd === null ? null : usdText(m, status.estimate.usd, lang)
  return (
    <div className="flex flex-col gap-2 text-[0.9rem] text-ink-soft" aria-live="polite">
      {justOn && <p className="font-medium text-ink">{m.turnedOn(provider)}</p>}
      <p>{m.onSince(when, provider, status.model ?? offer.model, host)}</p>
      <p className="tabular-nums">
        {m.progress(formatNumber(status.enriched, lang), m.records(status.records))}{" "}
        {status.pending > 0 ? m.waiting(m.records(status.pending), usd) : m.allDone}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" disabled={busy} onClick={onOff}>
          {m.turnOff}
        </Button>
        {busy && <span className="text-ink-dim">{m.turningOff}</span>}
      </div>
    </div>
  )
}

import { useEffect, useId, useState } from "react"
import { isLocalHost } from "@/domain/ai-model"
import type { CatalogTool } from "@/domain/catalog"
import { formatUsd } from "@/domain/mail-agent"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { HarderStatus } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import type { HarderChoice } from "@/platform/types"
import { errorText } from "@/shared/errors"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { useSearchHarder, useSearchHarderPreview, useSetSearchHarder } from "./api"
import { ModelAddressFields, useRefusalText } from "./ModelAddressFields"
import { type SearchHarderText, searchHarderMessages } from "./messages-search-harder"
import { ProviderKey, providerName } from "./ProviderKey"

const PROVIDERS = ["anthropic", "openai"] as const
// Long enough that typing a model name asks memo once, not at every letter.
const TYPING_MS = 600

/** What the form holds: a null model is memo's choice for the provider; the address counts only for OpenAI. */
export type Draft = { provider: string; model: string | null; baseUrl: string }

export function choiceOf(d: Draft): HarderChoice {
  const model = d.model?.trim() || null
  const baseUrl = (d.provider === "openai" && d.baseUrl.trim()) || null
  return { provider: d.provider, model, baseUrl }
}

export const draftOf = (s: HarderStatus): Draft => ({ provider: s.provider, model: s.model, baseUrl: s.baseUrl ?? "" })

/** Browser build only: `?harder=consent` opens the consent step without a click, for review captures. */
const consentByScenario = () =>
  platform.kind === "mock" && new URLSearchParams(window.location.search).get("harder") === "consent"

/**
 * memo's search harder: a hosted model reorders the first hits of one search the owner starts on the Search page. Off
 * until he reads here what goes where and allows it.
 */
export function SearchHarder({ tool }: { tool: CatalogTool }) {
  const m = useMessages(searchHarderMessages)
  const headingId = useId()
  const state = useSearchHarder(tool.id)
  const change = useSetSearchHarder(tool.id)
  const refusalText = useRefusalText()
  const [consenting, setConsenting] = useState(consentByScenario)
  const [done, setDone] = useState<"on" | "off" | null>(null)

  if (!tool.searchHarder) return null
  const answer = state.data
  const status = answer?.state === "ready" ? answer.status : null
  const view = !answer ? "loading" : answer.state === "old" ? "old" : consenting ? "consent" : status?.on ? "on" : "off"

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 border-line border-t pt-4 lg:col-span-2"
    >
      <h4 id={headingId} className="text-[1.02rem] font-semibold text-ink">
        {m.title}
      </h4>
      <p className="max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">{m.what}</p>
      <Collapse open={state.isError}>
        <ErrorNotice inline raw={state.isError ? errorText(state.error) : null}>
          {state.isError && m.readFailed}
        </ErrorNotice>
      </Collapse>
      <AutoHeight swap={view} className="max-w-[44rem]">
        <Crossfade swap={view}>
          {view === "loading" && !state.isError && <Skeleton className="h-[2.25rem] w-full max-w-[28rem]" />}
          {answer?.state === "old" && (
            <p className="text-[0.9rem] text-ink-soft">{answer.need ? m.oldNeed(answer.need) : m.oldNone}</p>
          )}
          {view === "off" && (
            <div className="flex flex-col gap-2">
              <p className="text-[0.9rem] text-ink-soft" aria-live="polite">
                {done === "off" ? m.turnedOff : m.off}
              </p>
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDone(null)
                    setConsenting(true)
                  }}
                >
                  {m.allow}
                </Button>
              </div>
            </div>
          )}
          {view === "consent" && status && (
            <Consent
              m={m}
              toolId={tool.id}
              start={draftOf(status)}
              proposed={status.proposedFromEnrichment && !status.on}
              busy={change.isPending}
              onAgree={(choice) =>
                change.mutate(choice, {
                  onSuccess: () => {
                    setConsenting(false)
                    setDone("on")
                  },
                })
              }
              onCancel={() => {
                setConsenting(false)
                change.reset()
              }}
            />
          )}
          {view === "on" && status && (
            <On
              m={m}
              toolId={tool.id}
              status={status}
              justOn={done === "on"}
              busy={change.isPending}
              onChange={() => {
                setDone(null)
                change.reset()
                setConsenting(true)
              }}
              onOff={() => change.mutate(null, { onSuccess: () => setDone("off") })}
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
    </section>
  )
}

function PriceLine({ m, s }: { m: SearchHarderText; s: HarderStatus }) {
  const lang = useLang()
  if (s.usdPerMillionInput === null || s.usdPerMillionOutput === null) return <li>{m.priceUnknown}</li>
  return <li>{m.price(formatUsd(s.usdPerMillionInput, lang), formatUsd(s.usdPerMillionOutput, lang))}</li>
}

function Consent(props: {
  m: SearchHarderText
  toolId: string
  start: Draft
  proposed: boolean
  busy: boolean
  onAgree: (choice: HarderChoice) => void
  onCancel: () => void
}) {
  const { m, toolId, start, proposed, busy, onAgree, onCancel } = props
  const titleId = useId()
  const groupName = useId()
  const preview = useSearchHarderPreview(toolId)
  const refused = useRefusalText()(preview.error)
  const [draft, setDraft] = useState(start)
  // The last answer stays on screen, dimmed, while memo is asked about a new choice, so the list does not jump.
  const [last, setLast] = useState<{ key: string; status: HarderStatus } | null>(null)
  const { mutate: ask } = preview
  const choice = choiceOf(draft)
  const key = JSON.stringify(choice)
  const first = last === null

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the choice; asking again only when it changes
  useEffect(() => {
    const asked = JSON.parse(key) as HarderChoice
    const timer = setTimeout(
      () => ask(asked, { onSuccess: (status) => setLast({ key, status }) }),
      first ? 0 : TYPING_MS,
    )
    return () => clearTimeout(timer)
  }, [key, ask])

  const shown = last?.status ?? null
  const current = last?.key === key && !preview.isPending ? shown : null
  const modelValue = draft.model ?? shown?.model ?? ""

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-[0.35rem] border border-line bg-app px-4 py-3.5"
    >
      <h5 id={titleId} className="font-semibold text-ink">
        {m.consentTitle}
      </h5>
      {proposed && <p className="text-[0.875rem] text-ink-dim">{m.proposed}</p>}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[0.9rem] font-medium text-ink-dim">{m.providerLabel}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <label key={p} className="relative cursor-pointer">
              <input
                type="radio"
                name={groupName}
                checked={draft.provider === p}
                disabled={busy}
                onChange={() => setDraft({ provider: p, model: null, baseUrl: "" })}
                className="peer sr-only"
              />
              <span className="flex h-full items-center rounded-[0.35rem] border border-line-strong px-3 py-2 text-[0.9rem] font-medium text-ink transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2">
                {providerName(p)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <ModelAddressFields
        model={modelValue}
        onModel={(model) => setDraft({ ...draft, model })}
        modelLabel={
          <>
            {m.modelLabel}
            {draft.model === null && shown && <span className="font-normal text-ink-dim"> · {m.memoDefault}</span>}
          </>
        }
        modelHelp={m.modelHelp}
        address={draft.baseUrl}
        onAddress={(baseUrl) => setDraft({ ...draft, baseUrl })}
        addressLabel={m.addressLabel}
        addressHelp={m.addressHelp}
        withAddress={draft.provider === "openai"}
        disabled={busy}
      />
      {!shown && !preview.isError && <Skeleton className="h-[6.5rem] w-full" label={m.checking} />}
      <Collapse open={preview.isError}>
        <ErrorNotice
          raw={preview.isError && !refused ? errorText(preview.error) : null}
          inline
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => ask(choice, { onSuccess: (status) => setLast({ key, status }) })}
            >
              {m.tryAgain}
            </Button>
          }
        >
          {preview.isError && (refused ?? m.previewFailed)}
        </ErrorNotice>
      </Collapse>
      {shown && (
        <ul
          aria-busy={!current}
          className={cx(
            "flex list-disc flex-col gap-1.5 pl-5 text-[0.9rem] leading-relaxed text-ink transition-opacity motion-reduce:transition-none",
            !current && "opacity-60",
          )}
        >
          <li>{m.sends(shown.candidates, shown.charsPerHit)}</li>
          <li>{m.to(providerName(shown.provider), shown.endpointHost, shown.model)}</li>
          <PriceLine m={m} s={shown} />
          <li>{m.plain}</li>
          <li className="-ml-5 list-none">
            <ProviderKey
              toolId={toolId}
              provider={shown.provider}
              found={shown.key}
              keys
              missing={m.keyMissing(shown.key.envVar)}
              local={isLocalHost(shown.endpointHost)}
              onChanged={() => ask(choice, { onSuccess: (status) => setLast({ key, status }) })}
            />
          </li>
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="primary" disabled={!current || busy} onClick={() => onAgree(choice)}>
          {m.agree(providerName(draft.provider))}
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

function On(props: {
  m: SearchHarderText
  toolId: string
  status: HarderStatus
  justOn: boolean
  busy: boolean
  onChange: () => void
  onOff: () => void
}) {
  const { m, toolId, status, justOn, busy, onChange, onOff } = props
  const lang = useLang()
  const provider = providerName(status.provider)
  const when = status.consentedAt
    ? formatDate(status.consentedAt, { dateStyle: "medium", timeStyle: "short" }, lang)
    : ""
  return (
    <div className="flex flex-col gap-2 text-[0.9rem] text-ink-soft" aria-live="polite">
      {justOn && <p className="font-medium text-ink">{m.turnedOn(provider)}</p>}
      <p>{m.onSince(when, provider, status.model, status.endpointHost)}</p>
      <ProviderKey
        toolId={toolId}
        provider={status.provider}
        found={status.key}
        keys
        missing={m.keyMissing(status.key.envVar)}
        local={isLocalHost(status.endpointHost)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" disabled={busy} onClick={onChange}>
          {m.change}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onOff}>
          {m.turnOff}
        </Button>
        {busy && <span className="text-ink-dim">{m.turningOff}</span>}
      </div>
    </div>
  )
}

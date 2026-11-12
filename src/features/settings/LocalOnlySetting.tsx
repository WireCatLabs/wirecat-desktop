import { useEffect, useId } from "react"
import { hostOfOrigin } from "@/domain/ai-model"
import type { Gap } from "@/domain/needs"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { LocalOnlyStatus } from "@/platform/ai-model-schemas"
import { useAiModel } from "@/shared/ai-model-store"
import { modelRefusalMessages, modelRefusalOf } from "@/shared/messages-model-refusals"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { useTools } from "@/shared/tools-store"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { SectionTitle } from "@/ui/SectionTitle"
import { Skeleton } from "@/ui/Skeleton"
import { Switch } from "@/ui/Switch"
import { useLocalOnly } from "./local-only-store"
import { localOnlyMessages, PLACES, type Place } from "./messages-local-only"

const isPlace = (where: string): where is Place => (PLACES as readonly string[]).includes(where)

/** Settings, "Only this computer": memo's one switch for every model call, and where each feature sends data now. */
export function LocalOnlySetting() {
  const m = useMessages(localOnlyMessages)
  const memo = useTools((s) => (s.installs.memo?.length ?? 0) > 0)
  const known = useTools((s) => s.installs.memo !== undefined)
  const gap: Gap | null = known && !memo ? { kind: "missing", tool: "memo", others: [] } : null
  const head = useId()
  if (!memo && !gap) return null
  return (
    <section id="local-only" aria-labelledby={head} className="flex scroll-mt-4 flex-col gap-3">
      <div>
        <SectionTitle as="h3" id={head}>
          {m.heading}
        </SectionTitle>
        <p className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-soft">{m.intro}</p>
      </div>
      {memo ? <LocalOnlyBody /> : gap && <ToolNeeded gap={gap} inline />}
    </section>
  )
}

function LocalOnlyBody() {
  const m = useMessages(localOnlyMessages)
  const answer = useLocalOnly((s) => s.answer)
  const error = useLocalOnly((s) => s.error)
  const version = useTools((s) => s.installs.memo?.[0]?.version ?? null)
  // The AI model's address decides where several features go, so a saved model is read here again.
  const aiModel = useAiModel((s) => s.model)

  // biome-ignore lint/correctness/useExhaustiveDependencies: read again whenever the AI model changes
  useEffect(() => {
    void useLocalOnly.getState().load()
    return () => useLocalOnly.setState({ actionError: null })
  }, [aiModel])

  if (error)
    return (
      <ErrorNotice raw={error} inline>
        {m.readFailed}
      </ErrorNotice>
    )
  if (answer === null) return <Skeleton className="h-[2.25rem] w-full max-w-[28rem]" label={m.looking} />
  if (answer.state === "old")
    return (
      <ToolNeeded gap={{ kind: "old", tool: "memo", version: answer.version ?? version, need: answer.need }} inline />
    )
  return <LocalOnlyForm status={answer.status} />
}

function LocalOnlyForm({ status }: { status: LocalOnlyStatus }) {
  const m = useMessages(localOnlyMessages)
  const refusals = useMessages(modelRefusalMessages)
  const lang = useLang()
  const busy = useLocalOnly((s) => s.busy)
  const actionError = useLocalOnly((s) => s.actionError)
  const switchId = useId()
  const stateId = useId()
  const refused = status.features.filter((f) => f.refused).length
  const refusal = actionError ? modelRefusalOf(actionError) : null
  const said =
    actionError === "local-only.owner-only" ? m.ownerOnly : refusal ? refusals[refusal] : actionError && m.setFailed
  const when = status.since ? formatDate(status.since, { dateStyle: "medium", timeStyle: "short" }, lang) : null

  return (
    <div className="flex max-w-[44rem] flex-col gap-3">
      <div className="flex items-start gap-3">
        <Switch
          id={switchId}
          checked={status.on}
          disabled={busy}
          onChange={(on) => void useLocalOnly.getState().set(on)}
          aria-describedby={stateId}
          className="mt-[0.1rem]"
        />
        <div className="flex flex-col gap-0.5">
          <label htmlFor={switchId} className="cursor-pointer font-medium">
            {m.switchLabel}
          </label>
          <p id={stateId} className="text-[0.9rem] text-ink-soft" aria-live="polite">
            {status.on ? (when ? m.onSince(when) : m.onNoDate) : m.off}
            {status.on && refused > 0 && <> {m.refusedNow(refused)}</>}
          </p>
        </div>
      </div>
      <Collapse open={Boolean(said)}>
        <ErrorNotice inline raw={said === m.setFailed ? actionError : null}>
          {said}
        </ErrorNotice>
      </Collapse>
      <div className="flex flex-col gap-1.5">
        <h4 className="text-[0.9rem] font-medium text-ink-dim">{m.listTitle}</h4>
        <ul className="flex flex-col divide-y divide-line rounded-[0.35rem] border border-line">
          {status.features.map((f) => {
            const place = isPlace(f.where) ? m.places[f.where] : m.placeUnknown
            const host = f.address && f.where !== "agent" ? hostOfOrigin(f.address) : null
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-[0.45rem] text-[0.9rem]">
                <span className="min-w-0 flex-1 basis-[14rem] text-ink">{m.features[f.id] ?? f.title}</span>
                {host && <span className="font-mono text-[0.8rem] text-ink-dim">{host}</span>}
                <span className="flex items-center gap-1.5">
                  <Pill size="sm" tone={f.where === "this-computer" ? "brand" : "neutral"}>
                    {place}
                  </Pill>
                  {f.refused && (
                    <Pill size="sm" tone="bad">
                      {m.refused}
                    </Pill>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        {status.features.some((f) => f.where === "agent") && (
          <p className="text-[0.85rem] text-ink-dim">{m.agentNote}</p>
        )}
      </div>
    </div>
  )
}

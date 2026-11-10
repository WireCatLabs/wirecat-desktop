import { LoaderCircle } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { hostOfOrigin, providerHost, staysHere } from "@/domain/ai-model"
import { REFUSED, tooOldFor } from "@/domain/memory-add"
import { useMessages } from "@/i18n"
import type { AiChecked, AiModel } from "@/platform/ai-model-schemas"
import { useAiModel } from "@/shared/ai-model-store"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Checkbox, Radio } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FieldError, invalidBorder, useFieldError } from "@/ui/FieldError"
import { fieldClass } from "@/ui/field"
import { SecretField } from "@/ui/SecretField"
import { Skeleton } from "@/ui/Skeleton"
import { aiModelMessages, SAVE_REASONS, type SaveReason } from "./messages-ai-model"

export const AI_PROVIDERS = ["anthropic", "openai", "ollama"] as const
type Provider = (typeof AI_PROVIDERS)[number]

const OPENROUTER = "https://openrouter.ai/api/v1"

type Draft = { provider: Provider | null; model: string; baseUrl: string; images: boolean }

const draftOf = (m: AiModel): Draft => ({
  provider: AI_PROVIDERS.find((p) => p === m.provider) ?? null,
  model: m.model ?? "",
  baseUrl: m.baseUrl ?? "",
  images: m.images,
})

/** Settings, "AI model": one model for reading sources and pictures. A key goes to memo once and is never shown back. */
export function AiModelSetting() {
  const memo = useTools((s) => (s.installs.memo?.length ?? 0) > 0)
  // Without memo there is nothing to set, and asking would start a failing run on every visit.
  return memo ? <AiModelSection /> : null
}

function AiModelSection() {
  const m = useMessages(aiModelMessages)
  const model = useAiModel((s) => s.model)
  const error = useAiModel((s) => s.error)
  const head = useId()

  useEffect(() => {
    void useAiModel.getState().load()
    return () => useAiModel.setState({ actionError: null, failed: null, turnedOff: false, checked: null })
  }, [])

  return (
    <section id="ai-model" aria-labelledby={head} className="flex scroll-mt-4 flex-col gap-3">
      <div>
        <h3 id={head} className="font-medium">
          {m.heading}
        </h3>
        <p className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-soft">{m.intro}</p>
      </div>
      {error ? (
        tooOldFor(error) ? (
          <p className="text-[0.95rem] text-ink-soft">{m.tooOld}</p>
        ) : error === REFUSED ? (
          <ErrorNotice inline>{m.refused}</ErrorNotice>
        ) : (
          <ErrorNotice inline>
            {m.failed} {error}
          </ErrorNotice>
        )
      ) : model === null ? (
        <Skeleton className="h-[8rem] w-full max-w-[36rem] rounded-[0.35rem]" label={m.looking} />
      ) : (
        <AiModelForm saved={model} />
      )}
    </section>
  )
}

function AiModelForm({ saved }: { saved: AiModel }) {
  const m = useMessages(aiModelMessages)
  const busy = useAiModel((s) => s.busy)
  const actionError = useAiModel((s) => s.actionError)
  const failed = useAiModel((s) => s.failed)
  const turnedOff = useAiModel((s) => s.turnedOff)
  const checked = useAiModel((s) => s.checked)
  const [draft, setDraft] = useState<Draft>(() => draftOf(saved))
  const [key, setKey] = useState("")
  const [justSaved, setJustSaved] = useState(false)
  const name = useId()
  const urlId = useId()
  const urlHelp = useId()
  const modelId = useId()
  const keyId = useId()
  const keyHelp = useId()
  const imagesId = useId()
  const consent = useId()
  const noProvider = useFieldError(`${name}-providers`)
  const noModel = useFieldError(modelId)
  const [nothing, setNothing] = useState(false)

  useEffect(() => setDraft(draftOf(saved)), [saved])

  const { provider } = draft
  const local = provider === "ollama"
  const savedDraft = draftOf(saved)
  const dirty =
    key.trim() !== "" ||
    draft.provider !== savedDraft.provider ||
    draft.model.trim() !== savedDraft.model ||
    draft.baseUrl.trim() !== savedDraft.baseUrl ||
    draft.images !== savedDraft.images
  const set = (patch: Partial<Draft>) => {
    setJustSaved(false)
    setNothing(false)
    noModel.clear()
    setDraft((d) => ({ ...d, ...patch }))
  }
  // A key, a model name and an address typed for one provider never carry over to another.
  const pick = (p: Provider) => {
    const same = p === savedDraft.provider
    noProvider.clear()
    setKey("")
    set({ provider: p, model: same ? savedDraft.model : "", baseUrl: same ? savedDraft.baseUrl : "" })
  }
  const host = provider === null ? "" : providerHost(provider, provider === "openai" ? draft.baseUrl : null)
  const keyHere = saved.key.stored && saved.provider === provider
  const keyLine = keyHere
    ? [
        m.keyReplace,
        saved.key.source === "file"
          ? m.keyInFile
          : saved.key.source === "environment"
            ? m.keyFromEnvironment
            : m.keyHelp,
      ].join(" ")
    : `${m.keyNone} ${m.keyHelp}`

  return (
    <form
      className="flex max-w-[40rem] flex-col gap-[0.9rem]"
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy !== null) return
        if (provider === null) return noProvider.fail(m.needProvider)
        if (draft.model.trim() === "") return noModel.fail(m.needModel)
        if (!dirty) return setNothing(true)
        // The field empties either way: the key is handed on once and never kept in the window.
        const given = key.trim()
        setKey("")
        const url = provider === "openai" ? draft.baseUrl.trim() : ""
        setJustSaved(
          await useAiModel.getState().save({
            provider,
            model: draft.model.trim(),
            baseUrl: url || null,
            key: given || null,
            images: draft.images,
          }),
        )
      }}
    >
      <fieldset
        id={`${name}-providers`}
        className="flex flex-col rounded-[0.45rem] border border-line aria-[invalid=true]:border-bad"
        {...noProvider.field}
      >
        <legend className="sr-only">{m.providerLegend}</legend>
        {AI_PROVIDERS.map((p) => (
          <label
            key={p}
            className="flex cursor-pointer items-center gap-[0.8rem] border-line px-[0.9rem] py-[0.65rem] not-first:border-t"
          >
            <Radio name={name} value={p} checked={provider === p} disabled={busy !== null} onChange={() => pick(p)} />
            <span className="font-medium">{m.providers[p]}</span>
          </label>
        ))}
      </fieldset>
      {noProvider.hint}

      {provider === "openai" && (
        <div className="flex flex-col gap-[0.3rem]">
          <label htmlFor={urlId} className="text-[0.9rem] text-ink-dim">
            {m.baseUrl}
          </label>
          <input
            id={urlId}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={OPENROUTER}
            value={draft.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            aria-describedby={urlHelp}
            className={`${fieldClass} selectable font-mono`}
          />
          <p id={urlHelp} className="text-[0.85rem] text-ink-soft">
            {m.baseUrlHelp} {m.baseUrlRule}
          </p>
        </div>
      )}

      {local && <p className="text-[0.9rem] text-ink-soft">{m.ollamaBeta}</p>}

      {provider !== null && (
        <>
          <div className="flex flex-col gap-[0.3rem]">
            <label htmlFor={modelId} className="text-[0.9rem] text-ink-dim">
              {m.model}
            </label>
            <input
              id={modelId}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={draft.model}
              onChange={(e) => set({ model: e.target.value })}
              {...noModel.field}
              className={cx(fieldClass, invalidBorder, "selectable font-mono")}
            />
            {noModel.hint}
            <p className="text-[0.85rem] text-ink-soft">{m.modelHelp}</p>
          </div>

          {!local && (
            <div className="flex flex-col gap-[0.3rem]">
              <label htmlFor={keyId} className="text-[0.9rem] text-ink-dim">
                {m.key}
              </label>
              <SecretField
                id={keyId}
                value={key}
                onChange={(k) => {
                  setJustSaved(false)
                  setKey(k)
                }}
                showLabel={m.showKey}
                hideLabel={m.hideKey}
                describedBy={keyHelp}
                disabled={busy === "save"}
              />
              <p id={keyHelp} className="text-[0.85rem] text-ink-soft">
                {keyLine}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-[0.3rem]">
            <label htmlFor={imagesId} className="flex cursor-pointer items-center gap-2 text-[0.95rem]">
              <Checkbox
                id={imagesId}
                checked={draft.images}
                onChange={(images) => set({ images })}
                disabled={busy !== null}
                aria-describedby={consent}
              />
              {m.images}
            </label>
            <p id={consent} className="ml-[1.5rem] text-[0.85rem] text-ink-soft">
              {m.imagesConsent(host, staysHere(provider, provider === "openai" ? draft.baseUrl : null))}
            </p>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={busy !== null}
          icon={busy === "save" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
        >
          {m.save}
        </Button>
        <Button
          size="sm"
          disabled={saved.provider === null || dirty || busy !== null}
          aria-describedby={`${name}-cost`}
          onClick={() => void useAiModel.getState().check()}
          icon={busy === "check" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
        >
          {busy === "check" ? m.checking : m.check}
        </Button>
        {saved.provider !== null && (
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void useAiModel.getState().off()}>
            {m.turnOff}
          </Button>
        )}
        {justSaved && !actionError && !turnedOff && checked === null && (
          <span role="status" className="text-[0.9rem] text-ink-soft">
            {m.saved}
          </span>
        )}
        {turnedOff && saved.provider === null && (
          <span role="status" className="text-[0.9rem] text-ink-soft">
            {m.turnedOff}
          </span>
        )}
      </div>
      <FieldError id={`${name}-nothing`}>{nothing && m.nothingToSave}</FieldError>
      <p id={`${name}-cost`} className="-mt-[0.5rem] text-[0.85rem] text-ink-dim">
        {dirty && saved.provider !== null ? m.checkSaveFirst : m.checkCost}
      </p>
      {saved.provider === null && <p className="text-[0.9rem] text-ink-soft">{m.off}</p>}
      {saved.provider !== null && (
        <p className="text-[0.9rem] text-ink-soft">
          {m.summary(m.providers[saved.provider] ?? saved.provider, saved.model ?? "")}
        </p>
      )}

      <Collapse open={actionError !== null}>
        {actionError && (
          <ErrorNotice inline>
            {(SAVE_REASONS as readonly string[]).includes(actionError)
              ? m.saveReasons[actionError as SaveReason]
              : actionError === REFUSED
                ? m.refused
                : `${failed === "off" ? m.offFailed : failed === "check" ? m.checkFailed : m.saveFailed} ${actionError}`}
          </ErrorNotice>
        )}
      </Collapse>
      <Collapse open={checked !== null}>{checked && <CheckResult checked={checked} saved={saved} />}</Collapse>
    </form>
  )
}

function CheckResult({ checked, saved }: { checked: AiChecked; saved: AiModel }) {
  const m = useMessages(aiModelMessages)
  const provider = checked.provider ?? saved.provider
  const say = Object.hasOwn(m.checkReasons, checked.reason) ? m.checkReasons[checked.reason] : undefined
  const text = say
    ? say({
        host: hostOfOrigin(checked.origin ?? saved.origin) || providerHost(provider ?? "openai", null),
        model: checked.model ?? saved.model ?? "",
        ms: checked.ms,
        ollama: provider === "ollama",
      })
    : m.checkUnknown
  return checked.ok ? (
    <p role="status" className="text-[0.95rem] text-ok">
      {text}
    </p>
  ) : (
    <ErrorNotice inline>{text}</ErrorNotice>
  )
}

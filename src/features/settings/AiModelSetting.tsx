import { LoaderCircle } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { hostOfOrigin, isLocalHost, providerHost, staysHere } from "@/domain/ai-model"
import { REFUSED, tooOldFor } from "@/domain/memory-add"
import type { Gap } from "@/domain/needs"
import { useMessages } from "@/i18n"
import type { AiChecked, AiModel } from "@/platform/ai-model-schemas"
import { platform } from "@/platform/bridge"
import { useAiModel } from "@/shared/ai-model-store"
import { externalHref } from "@/shared/external-href"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { useTools } from "@/shared/tools-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { Combobox } from "@/ui/Combobox"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FieldError, useFieldError } from "@/ui/FieldError"
import { fieldClass } from "@/ui/field"
import { SecretField } from "@/ui/SecretField"
import { SectionTitle } from "@/ui/SectionTitle"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { aiModelMessages, SAVE_REASONS, type SaveReason } from "./messages-ai-model"

export const AI_PROVIDERS = ["anthropic", "openai", "ollama"] as const
type Provider = (typeof AI_PROVIDERS)[number]

const OPENROUTER = "https://openrouter.ai/api/v1"
const NO_MODEL = "none"
const MODEL_DOCS: Record<string, { company: string; url: string }> = {
  anthropic: { company: "Anthropic", url: "https://platform.claude.com/docs/en/about-claude/models/overview" },
  openai: { company: "OpenAI", url: "https://developers.openai.com/api/docs/models" },
}

type ModelList = { state: "none" | "loading" | "failed" } | { state: "ready"; models: string[] }

/** A list that needs no key. Anthropic's and OpenAI's need the key only memo reads, so they stay free text for now. */
const listSource = (provider: Provider | null, host: string) =>
  provider === "ollama" ? "ollama" : provider === "openai" && host === "openrouter.ai" ? "openrouter" : null

function useModelList(source: "ollama" | "openrouter" | null): ModelList {
  const [list, setList] = useState<ModelList>({ state: "none" })
  useEffect(() => {
    if (source === null) return setList({ state: "none" })
    let current = true
    setList({ state: "loading" })
    platform.aiModelList(source).then(
      (models) => current && setList({ state: "ready", models }),
      () => current && setList({ state: "failed" }),
    )
    return () => {
      current = false
    }
  }, [source])
  return list
}

type Draft = { provider: Provider | null; model: string; baseUrl: string; images: boolean }

const draftOf = (m: AiModel): Draft => ({
  provider: AI_PROVIDERS.find((p) => p === m.provider) ?? null,
  model: m.model ?? "",
  baseUrl: m.baseUrl ?? "",
  images: m.images,
})

/** Settings, "AI model": one model for reading sources and pictures. A key goes to memo once and is never shown back. */
export function AiModelSetting() {
  const m = useMessages(aiModelMessages)
  const memo = useTools((s) => (s.installs.memo?.length ?? 0) > 0)
  // Known missing only from a finished detection (kept from the last run): Settings starts no scan of its own.
  const known = useTools((s) => s.installs.memo !== undefined)
  const gap: Gap | null = known && !memo ? { kind: "missing", tool: "memo", others: [] } : null
  const head = useId()
  if (!memo && !gap) return null
  return (
    <section id="ai-model" aria-labelledby={head} className="flex scroll-mt-4 flex-col gap-3">
      <div>
        <SectionTitle as="h3" id={head}>
          {m.heading}
        </SectionTitle>
        <p className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-soft">{m.intro}</p>
      </div>
      {/* Without memo there is nothing to set, and asking would start a failing run on every visit. */}
      {memo ? <AiModelBody /> : gap && <ToolNeeded gap={gap} inline />}
    </section>
  )
}

function AiModelBody() {
  const m = useMessages(aiModelMessages)
  const model = useAiModel((s) => s.model)
  const error = useAiModel((s) => s.error)
  const version = useTools((s) => s.installs.memo?.[0]?.version ?? null)

  useEffect(() => {
    void useAiModel.getState().load()
    return () => useAiModel.setState({ actionError: null, failed: null, turnedOff: false, checked: null })
  }, [])

  return error ? (
    tooOldFor(error) ? (
      <ToolNeeded gap={{ kind: "old", tool: "memo", version, need: null }} inline />
    ) : error === REFUSED ? (
      <ErrorNotice inline>{m.refused}</ErrorNotice>
    ) : (
      <ErrorNotice raw={error} inline>
        {m.failed}
      </ErrorNotice>
    )
  ) : model === null ? (
    <Skeleton className="h-[8rem] w-full max-w-[36rem] rounded-[0.35rem]" label={m.looking} />
  ) : (
    <AiModelForm saved={model} />
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
  const noModel = useFieldError(modelId)
  const saveFirst = useFieldError(`${name}-save`)
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
  useEffect(() => {
    if (dirty) setNothing(false)
    else saveFirst.clear()
  }, [dirty, saveFirst.clear])
  const set = (patch: Partial<Draft>) => {
    setJustSaved(false)
    setNothing(false)
    noModel.clear()
    setDraft((d) => ({ ...d, ...patch }))
  }
  // A key, a model name and an address typed for one provider never carry over to another.
  const pick = (p: Provider | null) => {
    const same = p === savedDraft.provider
    setKey("")
    set({ provider: p, model: same ? savedDraft.model : "", baseUrl: same ? savedDraft.baseUrl : "" })
  }
  const host = provider === null ? "" : providerHost(provider, provider === "openai" ? draft.baseUrl : null)
  const source = listSource(provider, host)
  const list = useModelList(source)
  const models = list.state === "ready" ? list.models : []
  const docs = provider !== null && source === null && host === `api.${provider}.com` ? MODEL_DOCS[provider] : undefined
  const modelLine =
    list.state === "loading"
      ? m.listLoading
      : list.state === "failed"
        ? source === "ollama"
          ? m.listOllamaOff
          : m.listFailed
        : list.state === "ready"
          ? models.length > 0
            ? m.modelHelp
            : source === "ollama"
              ? m.listOllamaEmpty
              : m.modelType
          : docs
            ? m.listNeedsKey(docs.company)
            : m.listOtherAddress
  const savedHost = saved.provider === null ? "" : hostOfOrigin(saved.origin)
  // memo refuses a picture when the key is missing, whatever the consent says.
  const reads = saved.images && (saved.provider === "ollama" || saved.key.stored)
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
        if (provider === null) {
          if (saved.provider === null) return setNothing(true)
          setKey("")
          void useAiModel.getState().off()
          return
        }
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
      <div className="flex flex-col gap-[0.3rem]">
        <label htmlFor={`${name}-providers`} className="text-[0.9rem] text-ink-dim">
          {m.providerLegend}
        </label>
        <Select
          id={`${name}-providers`}
          className="w-full"
          value={provider ?? NO_MODEL}
          disabled={busy !== null}
          onChange={(v) => pick(AI_PROVIDERS.find((p) => p === v) ?? null)}
          options={[
            { value: NO_MODEL, label: m.noModel },
            ...AI_PROVIDERS.map((p) => ({ value: p, label: m.providers[p] ?? p })),
          ]}
        />
      </div>

      <AutoHeight swap={provider}>
        <div className="flex flex-col gap-[0.9rem]">
          {provider === null && <p className="text-[0.9rem] text-ink-soft">{m.noModelDetails}</p>}

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
                <Combobox
                  id={modelId}
                  value={draft.model}
                  onChange={(model) => set({ model })}
                  options={models}
                  {...noModel.field}
                  className={cx("font-mono", noModel.error !== null && "border-bad")}
                />
                {noModel.hint}
                <p className="text-[0.85rem] text-ink-soft">
                  {modelLine}
                  {docs && (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="text-brand underline hover:text-brand-hover"
                        onClick={() => platform.openUrl(docs.url)}
                        {...externalHref(docs.url)}
                      >
                        {m.listDocs(docs.company)}
                      </button>
                    </>
                  )}
                </p>
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
                <div id={consent} className="ml-[1.5rem] flex flex-col gap-[0.3rem] text-[0.85rem] text-ink-soft">
                  <p>{m.imagesConsent(host, staysHere(provider, provider === "openai" ? draft.baseUrl : null))}</p>
                  <p>{m.imagesNow(reads ? saved.model : null, isLocalHost(savedHost))}</p>
                  <p>{m.imagesChange}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </AutoHeight>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          id={`${name}-save`}
          type="submit"
          size="sm"
          variant="primary"
          disabled={busy !== null}
          icon={
            busy === "save" || busy === "off" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined
          }
        >
          {m.save}
        </Button>
        {provider !== null && (
          <Button
            size="sm"
            disabled={busy !== null}
            aria-describedby={`${name}-cost`}
            onClick={() =>
              dirty
                ? saveFirst.fail((lang) => aiModelMessages[lang].checkSaveFirst)
                : void useAiModel.getState().check()
            }
            icon={busy === "check" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
          >
            {busy === "check" ? m.checking : m.check}
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
      {saveFirst.hint}
      {provider !== null && (
        <p id={`${name}-cost`} className="-mt-[0.5rem] text-[0.85rem] text-ink-dim">
          {m.checkCost}
        </p>
      )}
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

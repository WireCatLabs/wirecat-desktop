import { LoaderCircle, TriangleAlert } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { tooOldFor } from "@/domain/memory-add"
import { useMessages } from "@/i18n"
import type { Reader } from "@/platform/memory-add-schemas"
import { useReaders } from "@/shared/readers-store"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Radio } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { SecretField } from "@/ui/SecretField"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { readersMessages } from "./messages-readers"

const PROVIDERS = ["openai", "anthropic"] as const
type Provider = (typeof PROVIDERS)[number]

/**
 * Settings, "Reading for facts": the readers memo found and the owner's pick. Nothing is picked here for the owner,
 * even when only one reader exists; a key goes to memo once and is never shown back.
 */
export function ReadersSetting() {
  const memo = useTools((s) => (s.installs.memo?.length ?? 0) > 0)
  // Without memo there is nothing to choose, and asking would start a failing run on every visit.
  return memo ? <Readers /> : null
}

function Readers() {
  const m = useMessages(readersMessages)
  const readers = useReaders((s) => s.readers)
  const error = useReaders((s) => s.error)
  const chooseError = useReaders((s) => s.chooseError)
  const head = useId()
  const help = useId()

  useEffect(() => {
    void useReaders.getState().load()
  }, [])

  return (
    <section aria-labelledby={head} className="flex flex-col gap-3">
      <div>
        <h3 id={head} className="font-medium">
          {m.heading}
        </h3>
        <p id={help} className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-soft">
          {m.help}
        </p>
      </div>
      {error ? (
        tooOldFor(error) ? (
          <p className="text-[0.95rem] text-ink-soft">{m.tooOld}</p>
        ) : (
          <ErrorNotice inline>
            {m.failed} {error}
          </ErrorNotice>
        )
      ) : readers === null ? (
        <Skeleton className="h-[5rem] w-full max-w-[36rem] rounded-[0.35rem]" label={m.looking} />
      ) : (
        <>
          {readers.length === 0 ? (
            <p className="text-[0.95rem] text-ink-soft">{m.none}</p>
          ) : (
            <ReaderChoice readers={readers} describedBy={help} />
          )}
          <Collapse open={chooseError !== null}>
            <ErrorNotice inline>
              {m.chooseFailed} {chooseError}
            </ErrorNotice>
          </Collapse>
          <KeyForm />
        </>
      )}
    </section>
  )
}

/** Arrow keys move through the radios, so a pick is only marked there; the button saves it. */
export function ReaderChoice({ readers, describedBy }: { readers: Reader[]; describedBy: string }) {
  const m = useMessages(readersMessages)
  const busy = useReaders((s) => s.busy)
  const name = useId()
  const chosen = readers.find((r) => r.chosen)?.id ?? null
  const [picked, setPicked] = useState<string | null>(null)
  const marked = picked ?? chosen
  const need = useFieldError(`${name}-readers`)
  const state = (r: Reader) =>
    !r.available ? (r.id === "key" ? m.noKey : m.notFound) : r.signedIn === false ? m.notSignedIn : null
  return (
    <div className="flex flex-col gap-3">
      <fieldset
        id={`${name}-readers`}
        {...need.field}
        aria-describedby={need.error ? `${name}-readers-error ${describedBy}` : describedBy}
        className="flex max-w-[40rem] flex-col rounded-[0.45rem] border border-line aria-[invalid=true]:border-bad"
      >
        <legend className="sr-only">{m.heading}</legend>
        {readers.map((r) => {
          const off = !r.available || r.signedIn === false
          return (
            <label
              key={r.id}
              className="flex cursor-pointer items-start gap-[0.8rem] border-line px-[0.9rem] py-[0.7rem] not-first:border-t has-disabled:cursor-default has-disabled:opacity-60"
            >
              <Radio
                className="mt-[0.2rem]"
                name={name}
                value={r.id}
                checked={marked === r.id}
                disabled={off || busy === "choose"}
                onChange={() => {
                  setPicked(r.id)
                  need.clear()
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{m.names[r.id] ?? r.id}</span>
                  {r.model && <span className="font-mono text-[0.85rem] text-ink-dim">{m.model(r.model)}</span>}
                </span>
                <span className="block text-[0.9rem] text-ink-soft">
                  {state(r) ?? (r.leavesComputer ? m.leaves : m.stays)}
                </span>
                {r.readsFiles && (
                  <span className="mt-[0.15rem] flex items-center gap-2 text-[0.9rem] text-warn-ink">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden />
                    {m.readsFiles(m.names[r.id] ?? r.id)}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </fieldset>
      {need.hint}
      <span>
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() => {
            if (marked === null) return need.fail(m.needReader)
            if (marked === chosen) return need.fail(m.sameReader)
            void useReaders.getState().choose(marked)
          }}
          icon={busy === "choose" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
        >
          {m.use}
        </Button>
      </span>
    </div>
  )
}

function KeyForm() {
  const m = useMessages(readersMessages)
  const busy = useReaders((s) => s.busy)
  const saved = useReaders((s) => s.keySaved)
  const failed = useReaders((s) => s.keyError)
  const [provider, setProvider] = useState<Provider | "">("")
  const [key, setKey] = useState("")
  const keyId = useId()
  const providerId = useId()
  const help = useId()
  const noProvider = useFieldError(providerId)
  const noKey = useFieldError(keyId)

  return (
    <form
      className="flex max-w-[40rem] flex-col gap-[0.5rem]"
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy !== null) return
        if (provider === "") return noProvider.fail(m.needProvider)
        if (key.trim() === "") return noKey.fail(m.needKey)
        // The field empties either way: the key is handed on once and never kept in the window.
        const given = key
        setKey("")
        await useReaders.getState().saveKey(provider, given)
      }}
    >
      <h4 className="font-medium">{m.keyHeading}</h4>
      <p id={help} className="text-[0.9rem] text-ink-soft">
        {m.keyHelp}
      </p>
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-[0.3rem]">
          <span id={`${providerId}-label`} className="text-[0.9rem] text-ink-dim">
            {m.provider}
          </span>
          <Select<Provider | "">
            id={providerId}
            value={provider}
            onChange={(p) => {
              setProvider(p)
              noProvider.clear()
            }}
            placeholder={m.pickProvider}
            options={PROVIDERS.map((p) => ({ value: p, label: m.providers[p] ?? p }))}
            aria-labelledby={`${providerId}-label`}
            {...noProvider.field}
          />
          {noProvider.hint}
        </div>
        <div className="flex flex-col gap-[0.3rem]">
          <label htmlFor={keyId} className="text-[0.9rem] text-ink-dim">
            {m.key}
          </label>
          <SecretField
            id={keyId}
            value={key}
            onChange={(k) => {
              setKey(k)
              noKey.clear()
            }}
            showLabel={m.showKey}
            hideLabel={m.hideKey}
            invalid={noKey.error !== null}
            describedBy={noKey.error ? `${keyId}-error ${help}` : help}
            disabled={busy === "key"}
          />
          {noKey.hint}
        </div>
      </div>
      <span className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          disabled={busy !== null}
          icon={busy === "key" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
        >
          {m.saveKey}
        </Button>
        {saved && (
          <span role="status" className="text-[0.9rem] text-ink-soft">
            {m.keySaved(saved)}
          </span>
        )}
      </span>
      <Collapse open={failed !== null}>
        <ErrorNotice inline>
          {m.keyFailed} {failed}
        </ErrorNotice>
      </Collapse>
    </form>
  )
}

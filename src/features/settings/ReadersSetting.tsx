import { LoaderCircle, TriangleAlert } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { findTool } from "@/domain/catalog"
import { readerOff, tooOldFor } from "@/domain/memory-add"
import { isNewer } from "@/domain/status"
import { useMessages } from "@/i18n"
import type { Reader } from "@/platform/memory-add-schemas"
import { goAiModel } from "@/shared/go-ai-model"
import { useReaders } from "@/shared/readers-store"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Radio } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { readersMessages } from "./messages-readers"

/** Readers that read with an API key: the one key is set in «AI model», never here. */
const KEYED = new Set(["key", "openai", "anthropic"])

/**
 * Settings, "Reading for facts": the readers memo found and the owner's pick. Nothing is picked here for the owner,
 * even when only one reader exists. memo's `ai-model` reader uses the model and key set in «AI model».
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
  const version = useTools((s) => s.installs.memo?.[0]?.version ?? null)
  const need = findTool("memo")?.memory?.minVersion
  const old = version !== null && need !== undefined && isNewer(need, version)
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
          {old && <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{m.updateForAiModel}</p>}
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
  // memo also sends `problem` for the other readers; only the AI model's is worded here, the rest as before.
  const aiWaiting = (r: Reader) => r.id === "ai-model" && readerOff(r)
  const keyless = (r: Reader) => KEYED.has(r.id) && (!r.available || r.signedIn === false)
  const state = (r: Reader) =>
    aiWaiting(r)
      ? m.aiModelNotReady
      : keyless(r)
        ? m.noKey
        : !r.available
          ? m.notFound
          : r.signedIn === false
            ? m.notSignedIn
            : null
  const toAiModel = (r: Reader) => aiWaiting(r) || keyless(r)
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
          const off = readerOff(r)
          return (
            <label
              key={r.id}
              className="flex cursor-pointer items-start gap-[0.8rem] border-line px-[0.9rem] py-[0.7rem] not-first:border-t has-disabled:cursor-default"
            >
              <Radio
                className="mt-[0.2rem]"
                name={name}
                value={r.id}
                checked={marked === r.id}
                disabled={busy === "choose"}
                onChange={() => {
                  setPicked(r.id)
                  need.clear()
                }}
              />
              {/* A reader that cannot read yet stays choosable; its line says why, and only that line is dimmed. */}
              <span
                className={off && marked !== r.id ? "min-w-0 flex-1 [&>*:not(button)]:opacity-60" : "min-w-0 flex-1"}
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{m.names[r.id] ?? r.id}</span>
                  {r.id === "ai-model" && (
                    <Pill tone="brand" size="sm">
                      {m.recommended}
                    </Pill>
                  )}
                  {r.model && <span className="font-mono text-[0.85rem] text-ink-dim">{m.model(r.model)}</span>}
                </span>
                {r.id === "ai-model" && <span className="block text-[0.9rem] text-ink-soft">{m.aiModelUses}</span>}
                <span className="block text-[0.9rem] text-ink-soft">
                  {state(r) ?? (r.leavesComputer ? m.leaves : m.stays)}
                </span>
                {toAiModel(r) && (
                  <Button size="sm" variant="ghost" className="-ml-2" onClick={goAiModel}>
                    {m.goAiModel}
                  </Button>
                )}
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

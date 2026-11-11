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
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { Pill } from "@/ui/Pill"
import { SectionTitle } from "@/ui/SectionTitle"
import { Select } from "@/ui/Select"
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
        <SectionTitle as="h3" id={head}>
          {m.heading}
        </SectionTitle>
        <p id={help} className="mt-1 max-w-[70ch] text-[0.9rem] text-ink-soft">
          {m.help}
        </p>
      </div>
      {error ? (
        tooOldFor(error) ? (
          <p className="text-[0.95rem] text-ink-soft">{m.tooOld}</p>
        ) : (
          <ErrorNotice raw={error} inline>
            {m.failed}
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
            <ErrorNotice raw={chooseError} inline>
              {m.chooseFailed}
            </ErrorNotice>
          </Collapse>
          {old && <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{m.updateForAiModel}</p>}
        </>
      )}
    </section>
  )
}

/** Choosing in the list only marks a reader and shows its details; the button saves it. */
export function ReaderChoice({ readers, describedBy }: { readers: Reader[]; describedBy: string }) {
  const m = useMessages(readersMessages)
  const busy = useReaders((s) => s.busy)
  const name = useId()
  const chosen = readers.find((r) => r.chosen)?.id ?? null
  const [picked, setPicked] = useState<string | null>(null)
  const marked = picked ?? chosen
  const need = useFieldError(`${name}-readers`)
  const reader = readers.find((r) => r.id === marked)
  const nameOf = (r: Reader) => m.names[r.id] ?? r.id
  return (
    <div className="flex max-w-[40rem] flex-col gap-3">
      <Select
        id={`${name}-readers`}
        className="w-full"
        aria-label={m.heading}
        placeholder={m.pick}
        value={marked ?? ""}
        disabled={busy === "choose"}
        aria-invalid={need.field["aria-invalid"]}
        aria-describedby={need.error ? `${name}-readers-error ${describedBy}` : describedBy}
        onChange={(id) => {
          setPicked(id)
          need.clear()
        }}
        options={readers.map((r) => ({
          value: r.id,
          label: r.id === "ai-model" ? m.recommendedName(nameOf(r)) : nameOf(r),
        }))}
      />
      {need.hint}
      <AutoHeight swap={marked}>{reader && <ReaderDetails reader={reader} />}</AutoHeight>
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

function ReaderDetails({ reader: r }: { reader: Reader }) {
  const m = useMessages(readersMessages)
  // memo also sends `problem` for the other readers; only the AI model's is worded here, the rest as before.
  const aiWaiting = r.id === "ai-model" && readerOff(r)
  const keyless = KEYED.has(r.id) && (!r.available || r.signedIn === false)
  const state = aiWaiting
    ? m.aiModelNotReady
    : keyless
      ? m.noKey
      : !r.available
        ? m.notFound
        : r.signedIn === false
          ? m.notSignedIn
          : null
  return (
    <div className="flex flex-col gap-[0.15rem] text-[0.9rem] text-ink-soft">
      {r.id === "ai-model" && (
        <span>
          <Pill tone="brand" size="sm">
            {m.recommended}
          </Pill>
        </span>
      )}
      {r.model && <span className="font-mono text-[0.85rem] text-ink-dim">{m.model(r.model)}</span>}
      {r.id === "ai-model" && <span>{m.aiModelUses}</span>}
      <span>{state ?? (r.leavesComputer ? m.leaves : m.stays)}</span>
      {(aiWaiting || keyless) && (
        <span>
          <Button size="sm" variant="ghost" className="-ml-2" onClick={goAiModel}>
            {m.goAiModel}
          </Button>
        </span>
      )}
      {r.readsFiles && (
        <span className="flex items-center gap-2 text-warn-ink">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {m.readsFiles(m.names[r.id] ?? r.id)}
        </span>
      )}
    </div>
  )
}

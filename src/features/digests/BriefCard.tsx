import { useEffect, useId, useState } from "react"
import { briefChars } from "@/domain/digest-editors"
import { type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { SectionTitle } from "@/ui/SectionTitle"
import { Skeleton } from "@/ui/Skeleton"
import { briefTemplate } from "./brief-template"
import { area, card, useMemoEditor } from "./editor-state"
import { editorMessages } from "./messages-editors"

/** "What to collect": the owner's brief, through memo's `digest brief`. memo refuses it to an agent, never to him. */
export function BriefCard({ name }: { name?: string | undefined }) {
  const all = useMessages(editorMessages)
  const m = all.brief
  const titleId = useId()
  const counterId = useId()
  const fieldId = useId()
  const { value, readError, busy, failed, change } = useMemoEditor(() => platform.digestBrief(name), `brief:${name}`)
  const lang = useLang()
  const saved = value?.state === "ready" ? (value.body ?? "") : ""
  // With no brief yet the field starts from a template to edit; a brief already written is never replaced.
  const start = value?.state === "ready" && value.body == null ? briefTemplate(name, lang) : saved
  const [draft, setDraft] = useState(start)

  const ready = value?.state === "ready" ? value : null
  const limit = ready?.limit ?? 4000
  const chars = briefChars(draft)
  const over = chars > limit
  const problem = over
    ? (lang: Lang) => editorMessages[lang].brief.tooLong(limit)
    : chars === 0
      ? (lang: Lang) => editorMessages[lang].brief.empty
      : draft.trim() === saved.trim()
        ? (lang: Lang) => editorMessages[lang].unchanged
        : null
  const need = useFieldError(fieldId, { live: { problem, early: over } })
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new saved brief starts without the last complaint
  useEffect(() => {
    setDraft(start)
    need.clear()
  }, [start])

  if (value?.state === "noMemo") return null

  return (
    <section aria-labelledby={titleId} className={card}>
      <SectionTitle id={titleId}>{m.title}</SectionTitle>
      <p className="max-w-[70ch] text-[0.88rem] text-ink-soft">{m.hint}</p>
      {readError ? (
        <ErrorNotice raw={readError} inline>
          {all.readFailed}
        </ErrorNotice>
      ) : value === null ? (
        <Skeleton className="h-[9rem] w-full" label={m.title} />
      ) : value.state === "unsupported" ? (
        <p className="text-[0.92rem] text-ink-soft">{m.unsupported}</p>
      ) : (
        <>
          <textarea
            id={fieldId}
            aria-label={m.label}
            aria-describedby={cx(need.field["aria-describedby"], counterId)}
            aria-invalid={need.field["aria-invalid"]}
            rows={7}
            value={draft}
            placeholder={m.placeholder}
            onChange={(e) => setDraft(e.target.value)}
            className={area}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span id={counterId} className={cx("text-[0.85rem] tabular-nums", over ? "text-bad" : "text-ink-dim")}>
              {m.counter(chars, limit)}
            </span>
            <span className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || ready?.history === 0}
              onClick={() => void change(() => platform.digestBriefUndo(name))}
            >
              {all.undo}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || ready?.body == null}
              onClick={() => void change(() => platform.digestBriefReset(name))}
            >
              {m.remove}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => (problem ? need.fail() : void change(() => platform.digestBriefSave(draft, name)))}
            >
              {busy ? all.saving : m.save}
            </Button>
          </div>
          {need.hint}
          {ready?.body == null && need.error === null && <p className="text-[0.85rem] text-ink-dim">{m.none}</p>}
          {failed && <ErrorNotice inline>{m.failed(failed)}</ErrorNotice>}
        </>
      )}
    </section>
  )
}

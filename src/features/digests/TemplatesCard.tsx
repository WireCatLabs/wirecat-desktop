import { useEffect, useId, useState } from "react"
import {
  localeFor,
  TEMPLATE_CHANNELS,
  TEMPLATE_LOCALES,
  type TemplateChannel,
  type TemplateLocale,
} from "@/domain/digest-editors"
import { ENDONYMS, type Lang, useLang, useMessages } from "@/i18n"
import type { TemplatePreview } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { LinkButton } from "@/ui/LinkButton"
import { SectionTitle } from "@/ui/SectionTitle"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { area, card, useMemoEditor } from "./editor-state"
import { editorMessages } from "./messages-editors"
import { TEMPLATE_EXAMPLE, TEMPLATE_VARS, templateHelpMessages } from "./messages-template-help"

type Shown = { state: "asking" } | { state: "shown"; preview: TemplatePreview } | { state: "failed"; message: string }

/**
 * "How it looks": the morning digest's template per channel and language, through memo's `templates`. A preview
 * renders the draft as it stands, unsaved; memo checks a save itself and its refusal is shown as it says it.
 */
export function TemplatesCard({ name }: { name?: string | undefined }) {
  const all = useMessages(editorMessages)
  const m = all.templates
  const lang = useLang()
  const titleId = useId()
  const [channel, setChannel] = useState<TemplateChannel>("telegram")
  const [locale, setLocale] = useState<TemplateLocale>(() => localeFor(lang))
  const { value, readError, busy, failed, change } = useMemoEditor(
    () => platform.digestTemplate(channel, locale, name),
    `${name}/${channel}/${locale}`,
  )
  const saved = value?.state === "ready" ? value.body : ""
  const [draft, setDraft] = useState(saved)
  const [shown, setShown] = useState<Shown | null>(null)
  const fieldId = useId()
  const problem = !draft.trim()
    ? (l: Lang) => editorMessages[l].templates.empty
    : draft === saved
      ? (l: Lang) => editorMessages[l].unchanged
      : null
  const need = useFieldError(fieldId, { live: { problem } })
  useEffect(() => {
    setDraft(saved)
    setShown(null)
    need.clear()
  }, [saved, need.clear])

  if (value?.state === "noMemo") return null
  const ready = value?.state === "ready" ? value : null

  const preview = () => {
    setShown({ state: "asking" })
    platform.digestTemplatePreview(channel, locale, draft === saved ? null : draft, name).then(
      (p) => setShown({ state: "shown", preview: p }),
      (e) => setShown({ state: "failed", message: e instanceof Error ? e.message : String(e) }),
    )
  }

  return (
    <section aria-labelledby={titleId} className={card}>
      <SectionTitle id={titleId}>{m.title}</SectionTitle>
      <p className="max-w-[70ch] text-[0.88rem] text-ink-soft">
        {m.hint} <TemplateHelp />
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          aria-label={m.channel}
          value={channel}
          onChange={setChannel}
          options={TEMPLATE_CHANNELS.map((c) => ({ value: c, label: m.channels[c] }))}
        />
        <Select
          size="sm"
          aria-label={m.language}
          value={locale}
          onChange={setLocale}
          options={TEMPLATE_LOCALES.map((l) => ({ value: l, label: ENDONYMS[l] }))}
        />
        {ready && <span className="text-[0.85rem] text-ink-dim">{ready.stored ? m.own : m.shipped}</span>}
      </div>
      {readError ? (
        <ErrorNotice raw={readError} inline>
          {all.readFailed}
        </ErrorNotice>
      ) : value === null ? (
        <Skeleton className="h-[16rem] w-full" label={m.title} />
      ) : value.state === "unsupported" ? (
        <p className="text-[0.92rem] text-ink-soft">{m.unsupported}</p>
      ) : (
        <>
          <textarea
            id={fieldId}
            {...need.field}
            aria-label={m.body}
            rows={14}
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={cx(area, "font-mono text-[0.82rem] leading-[1.45]")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" disabled={shown?.state === "asking"} onClick={preview}>
              {shown?.state === "asking" ? m.previewing : m.preview}
            </Button>
            <span className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || ready?.history === 0}
              onClick={() => void change(() => platform.digestTemplateUndo(channel, locale, name))}
            >
              {all.undo}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || !ready?.stored}
              onClick={() => void change(() => platform.digestTemplateReset(channel, locale, name))}
            >
              {m.reset}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() =>
                problem ? need.fail() : void change(() => platform.digestTemplateSave(channel, locale, draft, name))
              }
            >
              {busy ? all.saving : m.save}
            </Button>
          </div>
          {need.hint}
          {failed && <ErrorNotice inline>{m.failed(failed)}</ErrorNotice>}
          {shown?.state === "failed" && (
            <ErrorNotice raw={shown.message} inline>
              {m.previewFailed}
            </ErrorNotice>
          )}
          {shown?.state === "shown" && <Preview preview={shown.preview} />}
        </>
      )}
    </section>
  )
}

function Preview({ preview }: { preview: TemplatePreview }) {
  const m = useMessages(editorMessages).templates
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5 border-line border-t pt-3">
      <h3 id={titleId} className="font-semibold text-ink">
        {m.previewTitle}
      </h3>
      <p className="text-[0.85rem] text-ink-dim">{preview.sample ? m.previewSample : m.previewLast}</p>
      {preview.problems.length > 0 && (
        <div className="text-[0.88rem] text-bad">
          <p>{m.problems}</p>
          <ul className="list-disc pl-5">
            {preview.problems.map((p) => (
              <li key={p} className="selectable">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* The channel's own markup, shown as text: the preview is never rendered as HTML in the app. */}
      <pre className="selectable max-h-[24rem] overflow-auto rounded-[0.3rem] bg-app-3 px-3 py-2 font-mono text-[0.82rem] whitespace-pre-wrap text-ink-soft">
        {preview.text}
      </pre>
    </section>
  )
}

/** What a template is and what it can use, in the app: memo's own docs are its source. */
function TemplateHelp() {
  const m = useMessages(templateHelpMessages)
  const [open, setOpen] = useState(false)
  const varsId = useId()
  return (
    <>
      <LinkButton onClick={() => setOpen(true)}>{m.open}</LinkButton>
      <Dialog open={open} title={m.title} onClose={() => setOpen(false)} wide scroll>
        <div className="flex max-w-[72ch] flex-col gap-3 text-[0.92rem] text-ink-soft">
          <p>{m.what}</p>
          <p>{m.liquid}</p>
          <p>{m.builtIn}</p>
          <p>{m.check}</p>
          <h3 id={varsId} className="mt-1 font-semibold text-ink">
            {m.varsTitle}
          </h3>
          <dl aria-labelledby={varsId} className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
            {TEMPLATE_VARS.map((v) => (
              <div key={v} className="contents">
                <dt className="selectable font-mono text-[0.82rem] text-ink">{v}</dt>
                <dd>{m.vars[v]}</dd>
              </div>
            ))}
          </dl>
          <p>{m.safety}</p>
          <h3 className="mt-1 font-semibold text-ink">{m.exampleTitle}</h3>
          <pre className="selectable overflow-auto rounded-[0.3rem] bg-app-3 px-3 py-2 font-mono text-[0.82rem] whitespace-pre text-ink-soft">
            {TEMPLATE_EXAMPLE}
          </pre>
        </div>
      </Dialog>
    </>
  )
}

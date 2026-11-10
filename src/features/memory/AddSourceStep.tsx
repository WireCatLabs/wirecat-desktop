import { FileText, Link2, LoaderCircle, Paperclip } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { fileName, isLink, missingOf, type Way, wordCount } from "@/domain/memory-add"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { FieldError, invalidBorder } from "@/ui/FieldError"
import { fieldFocus } from "@/ui/field"
import { SourcePreview } from "./AddPreview"
import { Refusal } from "./AddRefusal"
import { useAddSource } from "./add-store"
import { addMessages } from "./messages-add"

const WAYS: { way: Way; Icon: typeof FileText }[] = [
  { way: "text", Icon: FileText },
  { way: "link", Icon: Link2 },
  { way: "file", Icon: Paperclip },
]

const field = `selectable w-full rounded-[0.35rem] border border-line-strong bg-app px-3 text-[1rem] text-ink placeholder:text-ink-dim ${fieldFocus}`

/** Step 1: Text, Link or File, each with its own input; Save keeps it and moves on. */
export function SourceStep() {
  const m = useMessages(addMessages)
  const draft = useAddSource((s) => s.draft)
  const busy = useAddSource((s) => s.busy)
  const { setWay, save } = useAddSource.getState()
  const name = useId()
  const missing = missingOf(draft)
  const [tries, setTries] = useState(0)
  const inputs = `${name}-inputs`
  const problem = `${name}-problem`
  const early = missing === "tooLong" || (missing === "link" && draft.url.trim() !== "")
  const shown = tries > 0 || early ? missing : null
  // biome-ignore lint/correctness/useExhaustiveDependencies: another way to add starts without the last complaint
  useEffect(() => setTries(0), [draft.way])
  useEffect(() => {
    if (tries === 0) return
    const box = document.getElementById(inputs)
    box?.querySelector<HTMLElement>("[aria-invalid='true'], button")?.focus()
  }, [tries, inputs])

  return (
    <form
      noValidate
      className="flex flex-col gap-[1rem]"
      onSubmit={(e) => {
        e.preventDefault()
        if (missing) {
          setTries((n) => n + 1)
          return
        }
        void save()
      }}
    >
      <div className="grid gap-[1rem] md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <fieldset className="flex flex-col gap-[0.5rem]">
          <legend className="mb-[0.5rem] font-medium">{m.what}</legend>
          {WAYS.map(({ way, Icon }) => (
            <label key={way} className="relative flex">
              <input
                type="radio"
                name={name}
                checked={draft.way === way}
                onChange={() => setWay(way)}
                className="peer sr-only"
              />
              <span className="flex w-full cursor-pointer items-start gap-[0.7rem] rounded-[0.45rem] border border-line-strong px-[0.8rem] py-[0.65rem] transition-colors duration-(--motion-fast) hover:bg-app-2 peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                <Icon className="mt-[0.15rem] size-[1.1rem] shrink-0 text-ink-soft" aria-hidden />
                <span>
                  <span className="block font-medium">{m.ways[way].name}</span>
                  <span className="block text-[0.9rem] text-ink-soft">{m.ways[way].line}</span>
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div key={draft.way} id={inputs} className="fade-in min-w-0">
          {draft.way === "text" ? (
            <TextInput invalid={shown === "text" || shown === "tooLong"} problem={problem} />
          ) : draft.way === "link" ? (
            <LinkInput invalid={shown === "link"} problem={problem} />
          ) : (
            <FileInput problem={shown === "file" ? problem : undefined} />
          )}
        </div>
      </div>
      <Refusal />
      <FieldError id={problem}>{shown && m.missing[shown]}</FieldError>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={!!busy}
          icon={busy === "save" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
        >
          {busy === "save" ? m.saving[draft.way] : m.save}
        </Button>
      </div>
    </form>
  )
}

function TextInput({ invalid, problem }: { invalid: boolean; problem: string }) {
  const m = useMessages(addMessages)
  const draft = useAddSource((s) => s.draft)
  const { edit } = useAddSource.getState()
  const title = useId()
  const text = useId()
  const hint = useId()
  return (
    <div className="flex flex-col gap-[0.6rem]">
      <label htmlFor={title} className="text-[0.95rem] font-medium">
        {m.titleLabel}
      </label>
      <input
        id={title}
        value={draft.title}
        maxLength={500}
        aria-describedby={hint}
        onChange={(e) => edit({ title: e.target.value })}
        className={cx(field, "h-10")}
      />
      <p id={hint} className="-mt-[0.3rem] text-[0.85rem] text-ink-dim">
        {m.titleHint}
      </p>
      <span className="flex items-baseline justify-between">
        <label htmlFor={text} className="text-[0.95rem] font-medium">
          {m.textLabel}
        </label>
        <span aria-live="polite" className="font-mono text-[0.85rem] tabular-nums text-ink-dim">
          {m.words(wordCount(draft.text))}
        </span>
      </span>
      <textarea
        id={text}
        rows={4}
        value={draft.text}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? problem : undefined}
        onChange={(e) => edit({ text: e.target.value })}
        className={cx(field, invalidBorder, "min-h-[6.5rem] resize-y py-2 leading-snug")}
      />
    </div>
  )
}

/** The address stops changing for this long before the page is read, so typing does not start a read per key. */
const SETTLE_MS = 600

function LinkInput({ invalid, problem }: { invalid: boolean; problem: string }) {
  const m = useMessages(addMessages)
  const draft = useAddSource((s) => s.draft)
  const preview = useAddSource((s) => s.preview)
  const { edit, previewLink } = useAddSource.getState()
  const url = useId()
  const hint = useId()
  const address = draft.url.trim()
  useEffect(() => {
    if (!isLink(address) || useAddSource.getState().preview?.of === address) return
    const wait = setTimeout(() => void previewLink(address), SETTLE_MS)
    return () => clearTimeout(wait)
  }, [address, previewLink])
  return (
    <div className="flex flex-col gap-[0.6rem]">
      <label htmlFor={url} className="text-[0.95rem] font-medium">
        {m.urlLabel}
      </label>
      <input
        id={url}
        type="url"
        inputMode="url"
        value={draft.url}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${problem} ${hint}` : hint}
        onChange={(e) => edit({ url: e.target.value })}
        className={cx(field, invalidBorder, "h-10 font-mono")}
      />
      <p id={hint} className="max-w-[70ch] text-[0.9rem] text-ink-soft">
        {m.urlHint}
      </p>
      <SourcePreview preview={preview} of={address} />
    </div>
  )
}

function FileInput({ problem }: { problem: string | undefined }) {
  const m = useMessages(addMessages)
  const path = useAddSource((s) => s.draft.path)
  const busy = useAddSource((s) => s.busy)
  const preview = useAddSource((s) => s.preview)
  const { pickFile } = useAddSource.getState()
  const shown = !!path && preview?.of === path && preview.state !== "none"
  return (
    <div className="flex min-h-[9rem] flex-col items-start justify-center gap-[0.6rem] rounded-[0.45rem] border border-dashed border-line-strong px-[1rem] py-[0.9rem]">
      {path &&
        (shown ? (
          <div className="w-full">
            <SourcePreview preview={preview} of={path} />
          </div>
        ) : (
          <p className="selectable font-medium break-all">{fileName(path)}</p>
        ))}
      <Button
        size="sm"
        disabled={!!busy}
        aria-describedby={problem}
        onClick={() => void pickFile()}
        icon={busy === "pick" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
      >
        {path ? m.chooseOther : m.chooseFile}
      </Button>
      <p className="text-[0.9rem] text-ink-soft">{m.fileHint}</p>
    </div>
  )
}

import { Clock, ExternalLink, Eye, EyeOff, FileJson, KeyRound } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { linkParts } from "@/domain/format"
import type { AppPasswordProvider, MailNotes } from "@/domain/mail-signin"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { setClientFile, setPassword, useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { mailMessages } from "./messages-mail"
import { telegramMessages } from "./messages-telegram"

const FIELD =
  "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"

function Numbered({ i }: { i: number }) {
  return (
    <span
      aria-hidden
      className="mt-[0.15rem] grid size-[1.45rem] shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[0.85rem] text-brand tabular-nums"
    >
      {i + 1}
    </span>
  )
}

function OpenPage({ url, label }: { url: string; label: string }) {
  const tm = useMessages(telegramMessages)
  return (
    <div className="flex items-center gap-1 self-start">
      <Button
        size="sm"
        variant="secondary"
        icon={<ExternalLink className="size-4" aria-hidden />}
        onClick={() => platform.openUrl(url)}
      >
        {label}
      </Button>
      <CopyButton value={url} label={tm.copyLink(new URL(url).host)} />
    </div>
  )
}

/**
 * The app password in one step: what it is, how to make it at the provider, and the field to paste it in. The password
 * waits outside the store until the run asks for it, and a refusal brings the owner back here with the field empty.
 */
export function AppPasswordStep({ provider }: { provider: AppPasswordProvider }) {
  const m = useMessages(mailMessages)
  const { planMissing, passwordProblem, method } = useSignIn()
  const guide = m.guides[provider]
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const [shown, setShown] = useState(false)
  // The store starts each visit empty (`begin`, and a refusal), so the field matches what would be sent.
  useEffect(() => {
    input.current?.focus()
  }, [])
  const refused = passwordProblem ? m.refused[passwordProblem.reason] : undefined
  const missing = planMissing === "password"
  return (
    <div className="flex min-h-[19rem] flex-col gap-4 text-left">
      {passwordProblem && refused && (
        <ErrorNotice
          detail={
            <div className="flex flex-col gap-2">
              <p>{refused.cause}</p>
              <Disclosure summary={m.details}>
                <p className="selectable font-mono text-[0.85rem] break-words text-ink-soft">
                  {passwordProblem.message}
                </p>
              </Disclosure>
            </div>
          }
        >
          <span className="font-medium">{refused.title(guide.name)}</span>
        </ErrorNotice>
      )}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-[1.15rem] font-semibold text-ink">{guide.title}</h3>
        <p className="flex items-start gap-2.5 rounded-[0.3rem] border border-line bg-app-2 px-3 py-2.5 text-body leading-snug font-medium text-ink">
          <KeyRound className="mt-[0.1rem] size-[1.1rem] shrink-0 text-brand" aria-hidden />
          <span>{guide.notYours}</span>
        </p>
        <ol className="flex flex-col gap-2.5">
          {guide.steps.map((step, i) => (
            <li key={step.text} className="flex items-start gap-3">
              <Numbered i={i} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-body leading-snug text-ink">{step.text}</span>
                {step.open && <OpenPage url={step.open.url} label={step.open.label} />}
              </div>
            </li>
          ))}
        </ol>
        {guide.notes.map((note) => (
          <p key={note} className="text-[0.95rem] leading-snug text-ink-soft">
            {note}
          </p>
        ))}
        <p className="flex items-center gap-3 text-[0.95rem] text-ink-soft">
          <Clock className="size-[1.1rem] shrink-0 text-ink-dim" aria-hidden />
          <span>{guide.time}</span>
        </p>
      </section>
      <section className="flex max-w-[30rem] flex-col gap-2 pl-[2.05rem]">
        <label htmlFor={id} className="text-[1.05rem] font-medium text-ink">
          {m.field}
        </label>
        <div className="relative">
          <input
            ref={input}
            id={id}
            type={shown ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setPassword(e.target.value)
              useSignIn.setState({ planMissing: null })
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") useSignIn.getState().begin()
            }}
            aria-invalid={missing}
            aria-describedby={`${id}-hint`}
            className={cx(FIELD, "pr-12")}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-label={m.field}
            className="absolute top-1 right-1"
            icon={shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          />
        </div>
        <p id={`${id}-hint`} className="min-h-[2.75em] text-[0.9rem] leading-snug text-ink-soft">
          {missing ? (
            <span role="alert" className="text-bad">
              {m.needPassword}
            </span>
          ) : (
            m.fieldHint(guide.name)
          )}
        </p>
        {method === "gmail" && (
          <div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => useSignIn.setState({ planStep: "choose", way: "browser", passwordProblem: null })}
            >
              {m.useBrowser}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

/** A Google Desktop app client the way Google's console gives it; the tool reads only `installed`. */
export const clientJson = (clientId: string, secret: string) =>
  JSON.stringify({ installed: { client_id: clientId.trim(), client_secret: secret.trim() } })

const GOOGLE_CLIENT = /\.apps\.googleusercontent\.com$/

/**
 * The owner's own Google client: its downloaded file, or its ID and secret typed here. Typed, they become the same JSON
 * a download holds and travel as one; Rust writes it to a file only the owner can read and passes its path.
 */
export function GoogleClient({
  fileLabel,
  fileChosen,
  unreadable,
  onPick,
}: {
  fileLabel: string
  fileChosen: string | null
  unreadable: string | null
  onPick: () => void
}) {
  const m = useMessages(mailMessages)
  const { ownFile, planMissing } = useSignIn()
  const id = useId()
  const [typing, setTyping] = useState(false)
  const [clientId, setClientId] = useState("")
  const [secret, setSecret] = useState("")
  const [shown, setShown] = useState(false)
  const wrongId = clientId.trim() !== "" && !GOOGLE_CLIENT.test(clientId.trim())
  const update = (nextId: string, nextSecret: string) => {
    const good = GOOGLE_CLIENT.test(nextId.trim()) && nextSecret.trim() !== ""
    setClientFile(good ? nextId.trim() : null, good ? clientJson(nextId, nextSecret) : undefined)
    useSignIn.setState({ planMissing: null })
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={typing ? "ghost" : "secondary"}
          icon={<FileJson className="size-4" aria-hidden />}
          onClick={() => {
            setTyping(false)
            onPick()
          }}
        >
          {fileLabel}
        </Button>
        <Button
          size="sm"
          variant={typing ? "secondary" : "ghost"}
          icon={<KeyRound className="size-4" aria-hidden />}
          aria-expanded={typing}
          aria-controls={`${id}-typed`}
          onClick={() => {
            setTyping(true)
            if (!typing) setClientFile(null)
          }}
        >
          {m.client.typed}
        </Button>
      </div>
      {!typing && (
        <p role="status" className={cx("text-[0.9rem]", unreadable ? "text-bad" : "text-ink-soft")}>
          {unreadable ?? (ownFile ? fileChosen : null)}
        </p>
      )}
      <div id={`${id}-typed`} hidden={!typing} className="step-in flex max-w-[30rem] flex-col gap-2">
        <label htmlFor={`${id}-id`} className="text-[0.9rem] font-medium text-ink">
          {m.client.id}
        </label>
        <input
          id={`${id}-id`}
          spellCheck={false}
          autoComplete="off"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value)
            update(e.target.value, secret)
          }}
          aria-invalid={wrongId}
          aria-describedby={`${id}-id-hint`}
          className={FIELD}
        />
        <p id={`${id}-id-hint`} className={cx("text-[0.9rem]", wrongId ? "text-bad" : "text-ink-soft")}>
          {wrongId ? m.client.idWrong : m.client.idHint}
        </p>
        <label htmlFor={`${id}-secret`} className="text-[0.9rem] font-medium text-ink">
          {m.client.secret}
        </label>
        <div className="relative">
          <input
            id={`${id}-secret`}
            type={shown ? "text" : "password"}
            spellCheck={false}
            autoComplete="off"
            value={secret}
            onChange={(e) => {
              setSecret(e.target.value)
              update(clientId, e.target.value)
            }}
            aria-describedby={`${id}-secret-hint`}
            className={cx(FIELD, "pr-12")}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-label={m.client.secret}
            className="absolute top-1 right-1"
            icon={shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          />
        </div>
        <p id={`${id}-secret-hint`} className="text-[0.9rem] leading-snug text-ink-soft">
          {m.client.secretHint}
        </p>
      </div>
      {planMissing === "client" && (
        <p role="alert" className="text-[0.9rem] text-bad">
          {m.client.missing}
        </p>
      )}
    </div>
  )
}

/** A line of the tool's own text with each link a button and a copy beside it, never a raw address to read. */
function Linked({ text }: { text: string }) {
  const tm = useMessages(telegramMessages)
  return (
    <span>
      {linkParts(text).map((part) => {
        if (!part.url) return <span key={part.at}>{part.text}</span>
        const url = new URL(part.text)
        return (
          <span key={part.at} className="inline-flex items-center gap-0.5 align-middle">
            <button
              type="button"
              onClick={() => platform.openUrl(part.text)}
              className="rounded font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
            >
              {`${url.host}${url.pathname === "/" ? "" : url.pathname}`}
            </button>
            <CopyButton value={part.text} label={tm.copyLink(url.host)} />
          </span>
        )
      })}
    </span>
  )
}

/**
 * mail-cli's notes for a provider the window has no steps of, read back into a list: the server is under Details, and
 * the lines meant for the provider table's maintainers are left out.
 */
export function MailPrepare({ notes, heading }: { notes: MailNotes; heading: string }) {
  const m = useMessages(mailMessages)
  if (notes.steps.length === 0 && notes.notes.length === 0 && !notes.server) return null
  return (
    <section className="flex w-full max-w-[32rem] flex-col gap-2 text-left">
      <h3 className="text-body font-semibold text-ink">{heading}</h3>
      {notes.steps.length > 0 && (
        <ol className="flex flex-col gap-2">
          {notes.steps.map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-body leading-snug text-ink">
              <Numbered i={i} />
              <Linked text={step} />
            </li>
          ))}
        </ol>
      )}
      {notes.notes.map((note) => (
        <p key={note} className="text-[0.95rem] leading-snug text-ink-soft">
          <Linked text={note} />
        </p>
      ))}
      {notes.server && (
        <Disclosure summary={m.details}>
          <p className="selectable font-mono text-[0.85rem] text-ink-soft">
            {m.runtime.server}: {notes.server}
          </p>
        </Disclosure>
      )}
    </section>
  )
}

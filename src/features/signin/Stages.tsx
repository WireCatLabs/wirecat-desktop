import { CheckCircle2, ExternalLink, LoaderCircle } from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react"
import { findTool } from "@/domain/catalog"
import { checkPhone, formatPhone, phoneTyped } from "@/domain/phone"
import { qrModules, qrPath } from "@/domain/qr"
import {
  checkKey,
  type KeyField,
  keyHints,
  type TelegramFix,
  telegramFailure,
  telegramNote,
} from "@/domain/telegram-signin"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useOnboarding } from "../onboarding/store"
import { ReportThis } from "../report/ReportThis"
import { openConnect, openTool } from "../tools/go"
import { AnswerForm, type Check } from "./AnswerForm"
import { signinMessages } from "./messages"
import { telegramMessages } from "./messages-telegram"
import {
  APP_KEYS,
  ENDED,
  keptAnswer,
  NEEDS_UPDATE,
  type Need,
  type OpenUrl,
  type Pairing,
  type Qr,
  receivingHistory,
  useSignIn,
} from "./store"
import {
  isTelegramApps,
  MY_TELEGRAM,
  OpenLink,
  TelegramAppGuide,
  TelegramFailureText,
  TelegramScanSteps,
} from "./TelegramGuide"

const STAGE = "flex min-h-[19rem] flex-col items-center justify-center gap-3 text-center text-[1rem]"

const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?…]$/.test(s) ? "" : "."}`

/** The store at one moment. A stage draws only from this, so the copy fading out keeps showing what it showed. */
export type SignInView = ReturnType<typeof useSignIn.getState>

/** The keys step as tg will ask it, drawn while tg starts again after a refusal or a switch. */
const APPS: OpenUrl = { event: "openUrl", url: `https://${MY_TELEGRAM}/apps`, purpose: null }
const FIRST_KEY: Need = { event: "needs", field: "api_id", secret: false, prompt: "App api_id", hint: null }

const isKeys = (s: SignInView) =>
  (s.phase === "starting" && s.expect === "keys") ||
  // tg opens my.telegram.org and asks the keys in the same breath; the page is the keys step, not a wait.
  (s.phase === "browser" && s.tool === "tg" && s.url !== null && isTelegramApps(s.url)) ||
  (s.phase === "answer" && s.need !== null && APP_KEYS.has(s.need.field) && s.url !== null && isTelegramApps(s.url))

/**
 * Which stage is on screen; a new value cross-fades to the next one. Both app keys are one stage, so their guide stays
 * put while the question under it changes; every other question is a stage of its own.
 */
export function stageKey(s: SignInView) {
  if (s.phase === "plan") return `plan:${s.method}`
  if (isKeys(s)) return "keys"
  if (s.phase === "answer" && s.need) return `answer:${s.need.field}`
  return s.phase
}

export function Stage({ name, s }: { name: string; s: SignInView }) {
  const m = useMessages(signinMessages)
  const tm = useMessages(telegramMessages)
  if (isKeys(s)) return <KeysStage name={name} s={s} />
  if (s.phase === "starting") {
    const switching = s.switchingTo ? tm.switching[s.switchingTo] : undefined
    return (
      <div className={STAGE}>
        <LoaderCircle className="size-8 text-brand motion-safe:animate-spin" aria-hidden />
        <p className={switching ? "font-medium text-ink" : "text-ink"}>{switching ?? m.asking(name)}</p>
        {switching && <p className="max-w-[28rem] text-ink-soft">{tm.switchingWhy}</p>}
      </div>
    )
  }
  if (s.phase === "scan" && s.qr) return <ScanStage qr={s.qr} name={name} tool={s.tool} scannedAt={s.scannedAt} />
  if (s.phase === "pair" && s.pairing) return <PairStage pairing={s.pairing} />
  if (s.phase === "answer" && s.need) {
    const tg = s.tool === "tg"
    const said = tg ? s.notes.map(telegramNote) : []
    const sent = said.findLast((n) => n?.kind === "codeSent")
    const last = said.at(-1)
    const refused = last?.kind === "notAccepted" && s.need.field === last.what ? tm.notAccepted[last.what] : undefined
    const phone = tg && s.need.field === "phone"
    const checkNumber: Check = (typed) => {
      const result = checkPhone(typed)
      return result.problem === null
        ? { value: result.value, error: null }
        : { value: result.value, error: tm.phoneProblem(result) }
    }
    const readBack = (typed: string) => {
      const result = checkPhone(typed)
      return result.problem === null ? tm.phonePreview(formatPhone(result.value)) : null
    }
    return (
      <div className="flex min-h-[19rem] flex-col items-center justify-center gap-4 text-[1rem]">
        {s.url && !isTelegramApps(s.url) && <BrowserLink url={s.url} compact />}
        <AnswerForm
          need={s.need}
          sent={s.sent}
          onAnswer={s.answer}
          initial={keptAnswer(s.need.field)}
          note={tg && isPassword(s.need) ? tm.password : undefined}
          hint={
            s.need.field === "code" && sent?.kind === "codeSent"
              ? tm.codeSent[sent.via]
              : phone
                ? tm.phoneHint
                : undefined
          }
          problem={refused}
          {...(phone ? { check: checkNumber, filter: phoneTyped, preview: readBack } : {})}
        />
      </div>
    )
  }
  if (s.phase === "browser" && s.url) {
    return (
      <div className={STAGE}>
        {isTelegramApps(s.url) ? <TelegramAppGuide url={s.url} /> : <BrowserLink url={s.url} />}
        <p className="flex items-center gap-2 text-ink-soft">
          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
          {m.waitingBrowser}
        </p>
      </div>
    )
  }
  if (s.phase === "progress") {
    const history = receivingHistory(s)
    const slow = s.progress?.step === "waiting"
    return (
      <div className={STAGE}>
        <LoaderCircle className="size-8 text-brand motion-safe:animate-spin" aria-hidden />
        <p className="font-medium text-ink">
          {history
            ? slow
              ? m.historySlow
              : m.historyLinked
            : s.progress?.message
              ? sentence(s.progress.message)
              : m.working}
        </p>
        {history && <p className="max-w-[28rem]">{m.keepOpen(name)}</p>}
      </div>
    )
  }
  if (s.phase === "done" && s.done) {
    const { received, alreadyLinked } = s.done
    return (
      <div className={STAGE}>
        <CheckCircle2 className="size-8 text-ok" aria-hidden />
        <p className="font-medium text-ink">
          {alreadyLinked ? m.alreadySignedIn(name, s.profile ?? "") : m.signedIn(name, s.profile ?? "")}
        </p>
        {received && <p className="tabular-nums">{m.received(received)}</p>}
        <NextAfterSignIn />
      </div>
    )
  }
  if (s.phase === "failed" && s.failure) {
    const needsClientId = s.tool === "zm" && s.failure.message.includes("zoom.client_id")
    const telegram = s.tool === "tg" ? telegramFailure(s.failure.message, s.failure.code) : null
    const fix = telegram && isFixLabel(telegram.fix) ? telegram.fix : null
    const hints = telegram?.fix === "keys" ? keyHints(keptAnswer("api_id"), keptAnswer("api_hash")) : []
    const switchFailed = s.switchingTo ? tm.switchFailed[s.switchingTo] : undefined
    return (
      <div className="flex min-h-[19rem] flex-col justify-center gap-4 text-[1rem]">
        {switchFailed && <p className="font-medium text-ink">{switchFailed}</p>}
        {needsClientId ? (
          <ClientIdForm />
        ) : (
          <ErrorNotice
            action={
              <>
                {fix && (
                  <Button size="sm" variant="secondary" onClick={s.again}>
                    {tm.fix[fix]}
                  </Button>
                )}
                <ReportThis
                  what={`Signing in to ${name} as ${s.profile}`}
                  tool={s.tool}
                  error={s.failure.message}
                  onOpen={() => useSignIn.getState().close()}
                />
              </>
            }
          >
            {telegram ? (
              <TelegramFailureText failure={telegram} hints={hints} />
            ) : s.failure.code === NEEDS_UPDATE ? (
              m.needsUpdate
            ) : s.failure.code === ENDED ? (
              m.ended
            ) : (
              s.failure.message
            )}
          </ErrorNotice>
        )}
      </div>
    )
  }
  return <div className={STAGE} />
}

/** tg asks with field `password`; the prompt is checked too, so a reworded question still gets the note. */
export const isPassword = (need: Need) => need.field === "password" || /password|2fa|two-step/i.test(need.prompt)

/**
 * The guide, then the question for the keys; the method line says what comes after them. While tg starts, the same
 * layout waits with the field off, so the real question fills it in place.
 */
function KeysStage({ name, s }: { name: string; s: SignInView }) {
  const m = useMessages(signinMessages)
  const tm = useMessages(telegramMessages)
  const asked = s.phase === "answer" && s.need !== null
  const need = asked && s.need ? s.need : FIRST_KEY
  const field = need.field as KeyField
  const check: Check = (typed) => {
    const result = checkKey(field, typed)
    return result.problem === null
      ? { value: result.value, error: null }
      : { value: result.value, error: tm.keyProblem(result) }
  }
  const next = s.method ? tm.next[s.method] : undefined
  return (
    <div className="flex flex-col gap-5 py-1 text-[1rem]">
      <TelegramAppGuide url={s.url ?? APPS} />
      {/* Under the guide the field lines up with the steps' text, as their next step. */}
      <div className="flex flex-col gap-1 pl-[2.05rem]">
        <AnswerForm
          need={need}
          sent={!asked || s.sent}
          status={asked ? undefined : ((s.switchingTo && tm.switching[s.switchingTo]) ?? m.asking(name))}
          onAnswer={s.answer}
          initial={keptAnswer(need.field)}
          check={check}
        />
        {next && <p className="text-[0.95rem] text-ink-dim">{next}</p>}
      </div>
    </div>
  )
}

/** The fixes with a button of their own; the rest are the dialog's Try again, or nothing the window can do. */
const isFixLabel = (fix: TelegramFix): fix is "keys" | "phone" | "code" | "password" =>
  fix === "keys" || fix === "phone" || fix === "code" || fix === "password"

/** The tool has usually opened the page itself; the button opens it again. */
function BrowserLink({ url, compact = false }: { url: OpenUrl; compact?: boolean }) {
  const m = useMessages(signinMessages)
  const host = new URL(url.url).host
  return (
    <div
      className={
        compact ? "flex w-full max-w-[24rem] flex-col gap-2" : "flex max-w-[26rem] flex-col items-center gap-3"
      }
    >
      <p className={compact ? "text-[0.95rem] text-ink-soft" : "text-[1rem] text-ink"}>
        {url.purpose ? sentence(url.purpose) : m.continueOn(host)}
      </p>
      <div className={compact ? "self-start" : undefined}>
        <OpenLink url={url.url} primary={!compact} />
      </div>
    </div>
  )
}

function PairStage({ pairing }: { pairing: Pairing }) {
  const m = useMessages(signinMessages)
  return (
    <div className={STAGE}>
      <p>{pairing.place ? m.typeCodeAt(pairing.place) : m.typeCode}</p>
      <p className="selectable font-mono text-[2.2rem] font-semibold tracking-[0.18em] text-ink tabular-nums">
        {pairing.code}
      </p>
      {pairing.expiresAt && <ExpiresIn at={pairing.expiresAt} />}
    </div>
  )
}

/** Seconds since `at`, ticking; null before it, or when there is no `at`. */
function useSecondsSince(at: number | null) {
  const since = () => (at === null || Date.now() < at ? null : Math.floor((Date.now() - at) / 1000))
  const [seconds, setSeconds] = useState(since)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new moment restarts the count
  useEffect(() => {
    setSeconds(since())
    if (at === null) return
    const timer = setInterval(() => setSeconds(since()), 1000)
    return () => clearInterval(timer)
  }, [at])
  return seconds
}

/** A code that expired with no new one after it was most likely scanned: tg stops renewing once it is. */
const LATE_MS = 3000

/**
 * The code, and beside it how to scan it. Once the tool says anything after the code, it was scanned; when the code
 * expires and no new one comes, the window says it waits, and for how long, instead of "expired".
 */
function ScanStage({
  qr,
  name,
  tool,
  scannedAt,
}: {
  qr: Qr
  name: string
  tool: string | null
  scannedAt: number | null
}) {
  const m = useMessages(signinMessages)
  const late = useSecondsSince(qr.expiresAt ? Date.parse(qr.expiresAt) + LATE_MS : null)
  const since = useSecondsSince(scannedAt)
  const state = scannedAt !== null ? "accepted" : late !== null ? "late" : "scan"
  const scan = qr.scan ? `${qr.scan.charAt(0).toUpperCase()}${qr.scan.slice(1)}.` : null
  return (
    <div className="flex min-h-[19rem] flex-wrap items-center justify-center gap-x-8 gap-y-4 py-2 text-[1rem]">
      <QrImage text={qr.text} used={state !== "scan"} />
      <AutoHeight swap={state} className="min-w-[16rem] flex-1">
        <Crossfade swap={state}>
          {state === "accepted" ? (
            <Waiting title={m.scanAccepted(name)} seconds={since ?? 0} body={m.finishing} />
          ) : state === "late" ? (
            <Waiting title={m.waitingFor(name)} seconds={late ?? 0} body={m.waitingWhy(name)} />
          ) : (
            <div className="flex flex-col gap-3">
              {tool === "tg" ? (
                <TelegramScanSteps />
              ) : (
                <>
                  {scan && <p className="font-medium text-ink">{scan}</p>}
                  <p>{m.pointCamera}</p>
                </>
              )}
              {qr.expiresAt ? <ExpiresIn at={qr.expiresAt} /> : <p className="text-ink-dim">{m.codeChanges}</p>}
            </div>
          )}
        </Crossfade>
      </AutoHeight>
    </div>
  )
}

function Waiting({ title, seconds, body }: { title: string; seconds: number; body: ReactNode }) {
  const m = useMessages(signinMessages)
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2.5 font-medium text-ink">
        <LoaderCircle className="size-5 shrink-0 text-brand motion-safe:animate-spin" aria-hidden />
        <span>{title}</span>
        <span className="font-mono text-[0.9rem] font-normal text-ink-dim tabular-nums">{m.elapsed(seconds)}</span>
      </p>
      <p className="text-ink-soft">{body}</p>
    </div>
  )
}

/**
 * Drawn from the tool's text, never from a link: the tool prints none. Dark on white in both themes, because a phone
 * camera reads an inverted code badly.
 */
function QrImage({ text, used = false }: { text: string; used?: boolean }) {
  const m = useMessages(signinMessages)
  const dark = qrModules(text)
  if (!dark) {
    return (
      <pre
        role="img"
        aria-label={m.qrLabel}
        className="rounded-[0.35rem] bg-black p-2 font-mono text-[0.5rem] leading-none text-white"
      >
        {text}
      </pre>
    )
  }
  const size = dark.length
  return (
    <svg
      role="img"
      aria-label={m.qrLabel}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cx(
        "size-[17rem] shrink-0 rounded-[0.35rem] border border-line transition-opacity duration-300 ease-out-quart",
        used && "opacity-30",
      )}
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={qrPath(dark)} fill="#000000" />
    </svg>
  )
}

function ExpiresIn({ at }: { at: string }) {
  const m = useMessages(signinMessages)
  const left = () => Math.max(0, Math.round((Date.parse(at) - Date.now()) / 1000))
  const [seconds, setSeconds] = useState(left)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new code restarts the count
  useEffect(() => {
    setSeconds(left())
    const timer = setInterval(() => setSeconds(left()), 1000)
    return () => clearInterval(timer)
  }, [at])
  return <p className="text-[0.95rem] text-ink-dim tabular-nums">{seconds > 0 ? m.expiresIn(seconds) : m.expired}</p>
}

/** Zoom signs in with an app of the owner's own; its Public Client ID is saved with zm's own `config set`. */
function ClientIdForm() {
  const id = useId()
  const m = useMessages(signinMessages)
  const { tool, profile, start, onFinish, method } = useSignIn()
  const guide = tool ? findTool(tool)?.signIn?.guide : undefined
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!tool || !profile) return
    if (!value.trim()) {
      setError(m.clientIdEmpty)
      document.getElementById(id)?.focus()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await platform.settingsSet(tool, null, false, "zoom.client_id", value.trim())
      start(tool, profile, onFinish ?? undefined, method ?? undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-[26rem] flex-col gap-2">
      <p className="text-ink">{m.clientIdIntro}</p>
      {guide && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          icon={<ExternalLink className="size-4" aria-hidden />}
          onClick={() => platform.openUrl(guide)}
        >
          {m.howToMakeApp}
        </Button>
      )}
      <label htmlFor={id} className="mt-1 text-[1rem] font-medium text-ink">
        {m.clientId}
      </label>
      <input
        id={id}
        spellCheck={false}
        autoComplete="off"
        value={value}
        disabled={saving}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        aria-invalid={error !== null}
        aria-describedby={`${id}-error`}
        className="selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"
      />
      <p id={`${id}-error`} role={error ? "alert" : undefined} className="min-h-[1.3rem] text-[0.95rem] text-bad">
        {error}
      </p>
      <Button type="submit" variant="primary" disabled={saving} className="self-start">
        {saving ? m.saving : m.saveAndSignIn}
      </Button>
    </form>
  )
}

/** Rule 9: after the goal, what is worth doing next. Not in the first-run setup, which has its own next step. */
function NextAfterSignIn() {
  const tool = useSignIn((s) => (s.tool ? findTool(s.tool) : undefined))
  const close = useSignIn((s) => s.close)
  const onboarding = useOnboarding((s) => s.open)
  const m = useMessages(signinMessages)
  if (!tool || onboarding) return null
  return (
    <div className="mt-2 flex flex-col items-center gap-2">
      {tool.mcpServer && <p>{m.nextConnect}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {tool.mcpServer && (
          <Button
            size="sm"
            onClick={() => {
              close()
              openConnect(tool.id)
            }}
          >
            {m.connectApp}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            close()
            openTool(tool.id)
          }}
        >
          {m.openTool(tool.name)}
        </Button>
      </div>
    </div>
  )
}

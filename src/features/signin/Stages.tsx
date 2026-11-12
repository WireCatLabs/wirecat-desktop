import { CheckCircle2, LoaderCircle } from "lucide-react"
import type { ReactNode } from "react"
import { findTool } from "@/domain/catalog"
import { MAIL_PROVIDERS_LIST, readMailNotes } from "@/domain/mail-signin"
import { checkPhone, formatPhone, phoneTyped } from "@/domain/phone"
import { qrModules, qrPath } from "@/domain/qr"
import { zoomNeedsClientId } from "@/domain/signin-failure"
import {
  checkKey,
  type KeyField,
  keyHints,
  type TelegramFix,
  telegramFailure,
  telegramNote,
} from "@/domain/telegram-signin"
import { openConnect, openTool } from "@/features/tools"
import { useMessages } from "@/i18n"
import { OpenLink } from "@/shared/OpenLink"
import { useOnboarding } from "@/shared/onboarding-store"
import { ReportThis } from "@/shared/ReportThis"
import {
  APP_KEYS,
  BITRIX,
  BITRIX_APP,
  keptAnswer,
  linkIn,
  methodOf,
  type Need,
  type OpenUrl,
  type Pairing,
  type Qr,
  receivingHistory,
  running,
  useSignIn,
} from "@/shared/signin-store"
import { useNow } from "@/shared/use-elapsed"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { AnswerForm, type Check } from "./AnswerForm"
import { DriveFolders } from "./DriveFolders"
import { explainView, FailureCard } from "./Failure"
import { MailPrepare } from "./MailSteps"
import { signinMessages } from "./messages"
import { mailMessages } from "./messages-mail"
import { planMessages } from "./messages-plan"
import { setupMessages } from "./messages-setup"
import { telegramMessages } from "./messages-telegram"
import { wizardMessages } from "./messages-wizard"
import { isTelegramApps, MY_TELEGRAM, TelegramAppGuide, TelegramFailureText, TelegramScanSteps } from "./TelegramGuide"
import { MAIL_SERVER_FIELDS, maxTokenIn } from "./wizard"
import { SyncNow, ZoomAppSetup } from "./ZoomApp"

const STAGE = "flex min-h-[19rem] flex-col items-center justify-center gap-3 text-center text-[1.1rem]"

const sentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?…]$/.test(s) ? "" : "."}`

/** The store at one moment. A stage draws only from this, so the copy fading out keeps showing what it showed. */
export type SignInView = ReturnType<typeof useSignIn.getState>

/** The keys step as tg will ask it, drawn while tg starts again after a refusal or a switch. */
const APPS: OpenUrl = { event: "openUrl", url: `https://${MY_TELEGRAM}/apps`, purpose: null }
const FIRST_KEY: Need = { event: "needs", field: "api_id", secret: false, prompt: "App api_id", hint: null }

export const isKeys = (s: SignInView) =>
  (s.phase === "starting" && s.expect === "keys") ||
  // tg opens my.telegram.org and asks the keys in the same breath; the page is the keys step, not a wait.
  (s.phase === "browser" && s.tool === "tg" && s.url !== null && isTelegramApps(s.url)) ||
  (s.phase === "answer" && s.need !== null && APP_KEYS.has(s.need.field) && s.url !== null && isTelegramApps(s.url))

/**
 * Which stage is on screen; a new value cross-fades to the next one. Both app keys are one stage, so their guide stays
 * put while the question under it changes; every other question is a stage of its own.
 */
/**
 * Bitrix24's webhook is checked on its paste step: the step stays on screen while b24 runs. The local application
 * goes on to the browser instead.
 */
export const checksInPlan = (s: Pick<SignInView, "tool" | "method" | "phase">) =>
  s.tool === BITRIX && s.method !== BITRIX_APP && running(s.phase)

export function stageKey(s: SignInView) {
  if (s.phase === "plan" || checksInPlan(s)) return `plan:${s.method}:${checksInPlan(s) ? "paste" : s.planStep}`
  if (isKeys(s)) return "keys"
  if (s.phase === "answer" && s.need) return `answer:${s.need.field}`
  return s.phase
}

export function Stage({ name, s }: { name: string; s: SignInView }) {
  const m = useMessages(signinMessages)
  const tm = useMessages(telegramMessages)
  const pm = useMessages(planMessages)
  const sm = useMessages(setupMessages)
  const mm = useMessages(mailMessages)
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
    const phone = s.need.field === "phone"
    if (s.need.field === "token") return <TokenStage need={s.need} s={s} />
    if (s.need.field === "redirect") return <RedirectStage need={s.need} s={s} />
    if (s.need.field === "client_id") return <ZoomAppSetup need={s.need} />
    if (MAIL_SERVER_FIELDS.has(s.need.field)) return <ServerStage need={s.need} s={s} />
    const mailPassword = s.tool === "email" && isPassword(s.need)
    // mail's list of every provider is for its maintainers; the window's own words say what an app password is.
    const link = mailPassword && linkIn(s.need.hint)?.includes(MAIL_PROVIDERS_LIST) ? null : linkIn(s.need.hint)
    const checkNumber: Check = (typed) => {
      const result = checkPhone(typed)
      return result.problem === null
        ? { value: result.value, error: null }
        : { value: result.value, error: tm.phoneProblem(result) }
    }
    const readBack = (typed: string) => {
      const result = checkPhone(typed)
      if (result.problem !== null) return null
      return tg ? tm.phonePreview(formatPhone(result.value)) : sm.wa.phonePreview(formatPhone(result.value))
    }
    return (
      <div className="flex min-h-[19rem] flex-col items-center justify-center gap-4 text-[1.1rem]">
        {s.url && !isTelegramApps(s.url) && <BrowserLink url={s.url} compact />}
        {mailPassword && <MailPrepare notes={readMailNotes(s.notes)} heading={sm.mail.prepare} />}
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
                ? tg
                  ? tm.phoneHint
                  : sm.wa.phoneHint
                : mailPassword
                  ? mm.runtime.notYours
                  : undefined
          }
          problem={refused}
          {...(phone ? { check: checkNumber, filter: phoneTyped, preview: readBack } : {})}
        />
        {link && (
          <div className="w-full max-w-[32rem]">
            <OpenLink url={link} />
          </div>
        )}
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
        {s.tool && s.profile && findTool(s.tool)?.folderPicker ? (
          <DriveFolders tool={s.tool} profile={s.profile} name={name} />
        ) : (
          <NextAfterSignIn />
        )}
      </div>
    )
  }
  if (s.phase === "failed" && s.failure) {
    const needsClientId = zoomNeedsClientId(s.tool ?? "", s.failure.message, s.failure.reason)
    // A tool from before WireCat's Google app (gcal 0.19) refuses to start without the owner's own.
    const needsOwnApp =
      Boolean(s.tool && methodOf(s.tool, s.method)?.clientFile) &&
      /no Google OAuth client|own Google app/.test(s.failure.message)
    const telegram = s.tool === "tg" ? telegramFailure(s.failure.message, s.failure.code) : null
    const fix = telegram && isFixLabel(telegram.fix) ? telegram.fix : null
    const hints = telegram?.fix === "keys" ? keyHints(keptAnswer("api_id"), keptAnswer("api_hash")) : []
    const switchFailed = s.switchingTo ? tm.switchFailed[s.switchingTo] : undefined
    const explained = explainView(s)
    return (
      <div className="flex min-h-[19rem] flex-col justify-center gap-4 text-[1.1rem]">
        {switchFailed && <p className="font-medium text-ink">{switchFailed}</p>}
        {needsClientId ? (
          <ZoomAppSetup />
        ) : needsOwnApp ? (
          <ErrorNotice
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => useSignIn.setState({ phase: "plan", failure: null, planError: pm.noWireCatApp(name) })}
              >
                {pm.ownApp}
              </Button>
            }
          >
            {pm.noWireCatApp(name)}
          </ErrorNotice>
        ) : telegram ? (
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
            <TelegramFailureText failure={telegram} hints={hints} />
          </ErrorNotice>
        ) : (
          explained && <FailureCard s={s} explained={explained} />
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
    <div className="flex flex-col gap-5 py-1 text-[1.1rem]">
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
        {next && <p className="text-body text-ink-dim">{next}</p>}
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
      <p className={compact ? "text-body text-ink-soft" : "text-[1.1rem] text-ink"}>
        {url.purpose ? sentence(url.purpose) : m.continueOn(host)}
      </p>
      <div className={compact ? "self-start" : undefined}>
        <OpenLink url={url.url} variant={compact ? "secondary" : "primary"} size={compact ? "sm" : "md"} />
      </div>
    </div>
  )
}

function PairStage({ pairing }: { pairing: Pairing }) {
  const m = useMessages(signinMessages)
  return (
    <div className={STAGE}>
      {/* wa's place is a whole instruction of its own ("WhatsApp on the phone: tap …"), not a place to name after "on". */}
      {pairing.place?.includes(":") ? (
        <div className="flex max-w-[30rem] flex-col gap-1">
          <p className="font-medium text-ink">{m.typeCode}</p>
          <p className="text-body text-ink-soft">{sentence(pairing.place)}</p>
        </div>
      ) : (
        <p>{pairing.place ? m.typeCodeAt(pairing.place) : m.typeCode}</p>
      )}
      <p className="selectable font-mono text-[2.2rem] font-semibold tracking-[0.18em] text-ink tabular-nums">
        {pairing.code}
      </p>
      {pairing.expiresAt && <ExpiresIn at={pairing.expiresAt} />}
    </div>
  )
}

/** Seconds since `at`, ticking; null before it, or when there is no `at`. */
function useSecondsSince(at: number | null) {
  const now = useNow(at !== null)
  return at === null || now < at ? null : Math.floor((now - at) / 1000)
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
    <div className="flex min-h-[19rem] flex-wrap items-center justify-center gap-x-8 gap-y-4 py-2 text-[1.1rem]">
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
        <span className="font-mono text-[0.95rem] font-normal text-ink-dim tabular-nums">{m.elapsed(seconds)}</span>
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
        className="rounded-control bg-black p-2 font-mono text-[0.5rem] leading-none text-white"
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
        "size-[17rem] shrink-0 rounded-control border border-line transition-opacity duration-(--motion-slow) ease-out-quart",
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
  const seconds = Math.max(0, Math.round((Date.parse(at) - useNow(true)) / 1000))
  return <p className="text-body text-ink-dim tabular-nums">{seconds > 0 ? m.expiresIn(seconds) : m.expired}</p>
}

/**
 * mail-cli asks the server only when discovery found none (mail-cli PR #128). The host is required; a port or the SMTP
 * server may be left empty for the tool's default, so an empty answer is sent as it is.
 */
function ServerStage({ need, s }: { need: Need; s: SignInView }) {
  const sm = useMessages(setupMessages)
  const port = need.field.endsWith("_port")
  const check: Check = (typed) => {
    const value = typed.trim()
    if (need.field === "imap_host" && !value) return { value, error: sm.mail.serverEmpty }
    if (port && value && !(Number(value) >= 1 && Number(value) <= 65535)) return { value, error: sm.mail.portWrong }
    return { value, error: null }
  }
  return (
    <div className="flex min-h-[19rem] flex-col items-center justify-center gap-4 text-[1.1rem]">
      <AnswerForm
        need={need}
        sent={s.sent}
        onAnswer={s.answer}
        initial={keptAnswer(need.field)}
        hint={sm.mail.serverHint[need.field]}
        check={check}
        {...(port ? { filter: (typed: string) => typed.replace(/\D/g, "").slice(0, 5) } : {})}
      />
    </div>
  )
}

/**
 * Zoom and Drive wait for the browser to come back with the code. When it does not, the tool asks for the address
 * the browser ended on; in the tool's own words that reads as a riddle, so the window says it in steps.
 */
function RedirectStage({ need, s }: { need: Need; s: SignInView }) {
  const m = useMessages(signinMessages)
  const wm = useMessages(wizardMessages)
  const check: Check = (typed) => {
    const value = typed.trim()
    return { value, error: value ? null : m.answerEmpty }
  }
  return (
    <div className="flex min-h-[19rem] flex-col gap-4 text-left text-[1.1rem]">
      <section className="flex flex-col gap-2.5">
        <h3 className="text-[1.15rem] font-semibold text-ink">{wm.redirect.title}</h3>
        <p className="text-body leading-snug text-ink-soft">{wm.redirect.lead}</p>
        <ol className="flex flex-col gap-2">
          {wm.redirect.steps.map((text, i) => (
            <li key={text} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-[0.15rem] grid size-[1.45rem] shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[0.85rem] text-brand tabular-nums"
              >
                {i + 1}
              </span>
              <span className="text-body leading-snug text-ink">{text}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          {s.url && <OpenLink url={s.url.url} />}
          <Button size="sm" variant="secondary" onClick={s.again}>
            {m.tryAgain}
          </Button>
        </div>
      </section>
      <div>
        <AnswerForm
          need={need}
          label={wm.redirect.label}
          hint={wm.redirect.hint}
          sent={s.sent}
          onAnswer={s.answer}
          check={check}
        />
      </div>
    </div>
  )
}

/** MAX's token: where web.max.ru keeps it, step by step, and the field that takes the whole stored value. */
function TokenStage({ need, s }: { need: Need; s: SignInView }) {
  const wm = useMessages(wizardMessages)
  const check: Check = (typed) => {
    const value = maxTokenIn(typed)
    return { value, error: value ? null : wm.token.empty }
  }
  return (
    <div className="flex min-h-[19rem] flex-col gap-4 text-left text-[1.1rem]">
      <section className="flex flex-col gap-2.5">
        <h3 className="text-[1.15rem] font-semibold text-ink">{wm.token.title}</h3>
        <ol className="flex flex-col gap-2">
          {wm.token.steps.map((text, i) => (
            <li key={text} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-[0.15rem] grid size-[1.45rem] shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[0.85rem] text-brand tabular-nums"
              >
                {i + 1}
              </span>
              <span className="text-body leading-snug text-ink">{text}</span>
            </li>
          ))}
        </ol>
        <div className="self-start">
          <OpenLink url="https://web.max.ru/">{wm.token.open}</OpenLink>
        </div>
      </section>
      <div className="pl-[2.05rem]">
        <AnswerForm need={need} sent={s.sent} onAnswer={s.answer} check={check} />
      </div>
    </div>
  )
}

/** Rule 9: after the goal, what is worth doing next. Not in the first-run setup, which has its own next step. */
function NextAfterSignIn() {
  const tool = useSignIn((s) => (s.tool ? findTool(s.tool) : undefined))
  const close = useSignIn((s) => s.close)
  const profile = useSignIn((s) => s.profile)
  const onboarding = useOnboarding((s) => s.open)
  const m = useMessages(signinMessages)
  const wm = useMessages(wizardMessages)
  if (!tool || onboarding) return null
  return (
    <div className="mt-2 flex flex-col items-center gap-2">
      {tool.sync?.run && profile && <p className="max-w-[30rem]">{wm.next.syncLead(tool.name)}</p>}
      {tool.mcpServer && <p>{m.nextConnect}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {profile && <SyncNow tool={tool.id} profile={profile} primary />}
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

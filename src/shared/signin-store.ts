import { create } from "zustand"
import { ASTERISK, sourceProblem, sourceSettings } from "@/domain/asterisk-source"
import {
  type AppProblem,
  appIdShaped,
  appProblem,
  portalHost,
  portalProblem,
  type WebhookProblem,
  webhookParts,
  webhookProblem,
} from "@/domain/bitrix-signin"
import { findTool, signInMethods } from "@/domain/catalog"
import { type AppPasswordProvider, appPasswordProvider, appPasswordValue, type MailWay } from "@/domain/mail-signin"
import { type Gap, gapOf } from "@/domain/needs"
import type { FailedAt } from "@/domain/signin-failure"
import { isTelegramAppsUrl, keysStillGood, telegramFailure } from "@/domain/telegram-signin"
import { platform } from "@/platform/bridge"
import { tooOld as refusedAsOld } from "@/platform/command-error"
import type { SignInEvent, SignInInputs } from "@/platform/signin-schemas"
import { useSandbox } from "@/shared/sandbox-store"
import { useTools } from "@/shared/tools-store"
import { errorText } from "./errors"

/** A sign-in command the installed tool lacks is `signin.rs`'s "needs update", whichever way it failed. */
const failedCode = (e: unknown) => (refusedAsOld(e) ? "needs_update" : null)

type Of<K extends SignInEvent["event"]> = Extract<SignInEvent, { event: K }>
export type Qr = Of<"qr">
export type Pairing = Of<"pairingCode">
export type OpenUrl = Of<"openUrl">
export type Need = Of<"needs">
type Done = Of<"done">
type Failed = Of<"failed">

/** `signin_steps.rs`: the tool does not know the flag the app passes. */
export const NEEDS_UPDATE = "needs_update"

/** The tool stopped without a `done` or `failed` event; the English message still goes to the bug report. */
const ENDED = "ended"

/** What the dialog shows: the step the tool reached last. `plan` says what will happen, before anything runs. */
export type Phase = "plan" | "starting" | "scan" | "pair" | "browser" | "answer" | "progress" | "done" | "failed"

type SignInState = {
  tool: string | null
  profile: string | null
  method: string | null
  phase: Phase
  /** The code on screen; kept in memory only, and dropped when the dialog closes. */
  qr: Qr | null
  /** How many codes the tool has shown, so the window can say a new one replaced the last. */
  codes: number
  pairing: Pairing | null
  /** The page the owner approves in; it stays beside a question that follows it (Zoom's pasted address). */
  url: OpenUrl | null
  need: Need | null
  /** An answer was sent and the tool has not yet taken the next step. The answer itself is never kept here. */
  sent: boolean
  progress: Of<"progress"> | null
  notes: string[]
  done: Done | null
  failure: Failed | null
  /** The step on screen when the tool gave up: a QR code nobody scanned reads differently from a page never finished. */
  failedAt: FailedAt
  stopping: boolean
  /**
   * What the next step will be while the tool starts, when the dialog knows it: tg asks the app keys again after a
   * refusal or a switch, because it stores them only once Telegram has signed in. The step is drawn at once, so the
   * dialog does not flash something else first.
   */
  expect: "keys" | null
  /** This run answers the app keys typed earlier in the dialog by itself: a method switch, or a retry they passed. */
  reuse: boolean
  /** When the tool said anything after its last QR code: someone scanned it, and it is finishing. */
  scannedAt: number | null
  /**
   * The method this run switched to, until its first step is on screen: the dialog says it is switching, and a failure
   * before that step says the switch failed.
   */
  switchingTo: string | null
  /** Typed in the plan before the run: the mail address, and the name of the owner's own client file, if chosen. */
  address: string
  ownFile: string | null
  /** The owner's own app id (Microsoft's Application ID), saved as the method's `clientId` setting before the run. */
  ownId: string
  /** The own app id could not be saved, so the plan stays open with the tool's reason. */
  planError: string | null
  /** Start was pressed without what the method needs. */
  planMissing:
    | "address"
    | "password"
    | "client"
    | "portal"
    | "webhook"
    | "appId"
    | "appKey"
    | "update"
    | "source"
    | null
  /** Gmail's way in: the browser, with WireCat's Google app or the owner's own client, or an app password. */
  way: MailWay
  /**
   * The plan's own steps before the run. Mail: the provider (`choose`), then the app password. Bitrix24: the portal
   * (`choose`) and the way in, then how to make the webhook and the field it is pasted in, or the local application's
   * steps with its id and key (`app`).
   */
  planStep: PlanStep
  /** Bitrix24's portal host, as the owner typed it on the first step. */
  portal: string
  /** pbx's source settings by key, saved with `config set` before the run; never the password. */
  source: Record<string, string>
  /** The local application's Application ID (client_id); not a secret. Its key stays outside the store. */
  appId: string
  /** Why b24 refused the local application's sign-in; its form says it, with what to do. */
  appProblem: AppProblem | null
  /** Why the pasted webhook cannot be used; the paste step says it, with what to do. */
  webhookProblem: WebhookProblem | null
  /** The window is asking the other profiles whether one already holds this webhook. */
  comparing: boolean
  /** The provider refused the app password typed on that step; the step opens again, saying why. */
  passwordProblem: { reason: string; message: string } | null
  /** The last page a question's hint named, such as the provider's app password page; a failure offers it again. */
  hintPage: string | null
  run: number
  onFinish: (() => void) | null
  /** When each account last finished a sign-in here; survives the dialog closing. */
  signedInAt: Record<string, number>
  /** Without `method` it opens on the plan, and `begin` runs it; with one (a switch, a retry) it runs at once. */
  start(tool: string, profile: string, onFinish?: () => void, method?: string, reuse?: boolean): void
  /** Saves the owner's own app id first when one is typed, then runs the sign-in. */
  begin(): void
  /** Starts the same sign-in again, after a failure. */
  again(): void
  /** Back to the plan: a run in progress is stopped; the address and the own app typed there stay. */
  toPlan(): void
  answer(value: string): Promise<void>
  /** Stops the tool and waits for what it kept: `wa`'s history. The dialog stays open to say what came. */
  stop(): void
  /** Closes at once; a tool still running is stopped in the background, and `onFinish` runs once it has ended. */
  close(): void
}

const closed = {
  tool: null,
  profile: null,
  method: null,
  phase: "starting" as Phase,
  qr: null,
  codes: 0,
  pairing: null,
  url: null,
  need: null,
  sent: false,
  progress: null,
  notes: [],
  done: null,
  failure: null,
  failedAt: null as FailedAt,
  stopping: false,
  expect: null as "keys" | null,
  reuse: false,
  scannedAt: null as number | null,
  switchingTo: null as string | null,
  onFinish: null,
  address: "",
  ownFile: null,
  ownId: "",
  planError: null,
  planMissing: null as SignInState["planMissing"],
  way: "browser" as MailWay,
  planStep: "choose" as PlanStep,
  portal: "",
  source: {} as Record<string, string>,
  appId: "",
  appProblem: null as AppProblem | null,
  webhookProblem: null as WebhookProblem | null,
  comparing: false,
  passwordProblem: null as SignInState["passwordProblem"],
  hintPage: null as string | null,
}

export type PlanStep = "choose" | "password" | "webhook" | "paste" | "app"

/** Bitrix24's webhook is pasted in the window and checked there: the paste step stays while it runs. */
export const BITRIX = "bitrix"
/** Bitrix24's local application: its id and key are typed in the window, then b24 signs in in the browser. */
export const BITRIX_APP = "app"
const isBitrixApp = (s: Pick<SignInState, "tool" | "method">) => s.tool === BITRIX && s.method === BITRIX_APP

/** The first https link in a tool's hint, without the sentence's closing punctuation. */
export const linkIn = (hint: string | null | undefined) =>
  hint?.match(/https:\/\/[^\s<>"]*[^\s<>".,;:!?)]/)?.[0] ?? null

/** A sign-in process runs, or is about to: the plan has started nothing yet. */
export const running = (phase: Phase) => phase !== "done" && phase !== "failed" && phase !== "plan"

/** `wa`'s wait for the phone's history: a stop then keeps what came. */
export const receivingHistory = (s: Pick<SignInState, "phase" | "progress">) =>
  s.phase === "progress" && (s.progress?.step === "history" || s.progress?.step === "waiting")

/**
 * The app keys typed in this dialog, so a new try after Telegram refused them opens with them filled in for editing.
 * Outside the store, so no snapshot of it carries them; forgotten when the sign-in ends or the dialog closes.
 */
const keys = new Map<string, string>()
const KEPT = new Set(["api_id", "api_hash"])
/**
 * Other answers a new try starts with: what is not secret (a mail server, a phone number). Never a login code, which
 * is spent once sent, and never a password.
 */
const refill = new Map<string, string>()
const SPENT = new Set(["code"])
export const keptAnswer = (field: string) => keys.get(field) ?? refill.get(field) ?? ""
export const APP_KEYS = KEPT

/** The app password and the client file's text, kept beside the app keys and forgotten with them. */
const typed: { password: string | undefined; clientFile: string | undefined; sentIn: number | null } = {
  password: undefined,
  clientFile: undefined,
  sentIn: null,
}
const forget = () => {
  keys.clear()
  refill.clear()
  typed.password = undefined
  typed.clientFile = undefined
  typed.sentIn = null
}
export const setPassword = (value: string) => {
  typed.password = value
}
/** Whether a webhook is still pasted after a refusal, so the field says so; never the text itself. */
export const hasPasted = () => Boolean(typed.password?.trim())
export const setClientFile = (name: string | null, text?: string) => {
  typed.clientFile = name ? text : undefined
  useSignIn.setState({ ownFile: name })
}

/**
 * The provider whose app password the plan asks on its own step before the run, so the tool's question is answered
 * from it; null when the tool asks it in its own words, or the sign-in is in the browser.
 */
export const guidedProvider = (
  s: Pick<SignInState, "tool" | "method" | "address" | "way">,
): AppPasswordProvider | null =>
  s.tool === "email" && !(s.method === "gmail" && s.way === "browser") ? appPasswordProvider(s.method, s.address) : null

/** The refusals that mean the pasted password was not the app password: its step opens again. */
const WRONG_PASSWORD = new Set(["mail.app-password-required", "mail.login-refused"])

/** What the plan keeps across a run, a new try and a way back to it. */
const kept = (s: Pick<SignInState, "address" | "ownFile" | "ownId" | "way" | "portal" | "appId" | "source">) => ({
  address: s.address,
  portal: s.portal,
  source: s.source,
  appId: s.appId,
  ownFile: s.ownFile,
  ownId: s.ownId,
  way: s.way,
})

/** Only what the method takes, and the owner's own app before an app password: with it, Gmail signs in by browser. */
export const methodOf = (tool: string, method: string | null) => {
  const entry = findTool(tool)
  return entry ? signInMethods(entry).find((m) => m.id === method) : undefined
}

type Installs = ReturnType<typeof useTools.getState>["installs"]

function tooOld(tool: string | null, need: string | null | undefined, installs: Installs): Gap | null {
  if (!tool || !need) return null
  const gap = gapOf({ anyOf: [tool], minVersion: need }, (id) => ({ version: installs[id]?.[0]?.version }))
  return gap !== "unknown" && gap?.kind === "old" ? gap : null
}

/** The installed tool, when it predates the method's sign-in with the tool's own app. */
export const oauthTooOld = (tool: string | null, method: string | null, installs = useTools.getState().installs) =>
  tooOld(tool, tool ? methodOf(tool, method)?.oauthMinVersion : undefined, installs)

/** The installed tool, when it predates the method itself. */
export const methodTooOld = (tool: string | null, method: string | null, installs = useTools.getState().installs) =>
  tooOld(tool, tool ? methodOf(tool, method)?.minVersion : undefined, installs)

function inputsFor(
  tool: string,
  method: string,
  s: Pick<SignInState, "address" | "way" | "portal" | "appId">,
): SignInInputs {
  const { address, way } = s
  const m = methodOf(tool, method)
  if (!m) return {}
  const inputs: SignInInputs = {}
  if (m.portal && m.appId) {
    inputs.portal = s.portal
    inputs.appId = s.appId.trim()
  }
  if (m.address && address.trim()) inputs.address = address.trim()
  if (m.clientFile && typed.clientFile) inputs.clientFile = typed.clientFile
  else if (m.oauth && way === "browser") inputs.oauth = true
  else if ((m.password || m.stdin) && typed.password) inputs.password = typed.password
  return inputs
}

/** The run in flight, so a new one waits for it to end: the tool runs one sign-in at a time. */
let ending: Promise<unknown> = Promise.resolve()

/**
 * Rust's stop: the tool's grace after SIGTERM (`signin.rs` GRACE, 5 s), then a kill and the pipes drained. A run that
 * has not ended by then is stuck; the next one starts anyway, and Rust says so if the tool is still busy.
 */
const STOP_MS = 8000
const previousEnded = () => Promise.race([ending, new Promise((done) => setTimeout(done, STOP_MS))])

const bothKeys = () => [...KEPT].every((k) => keys.has(k))

/** Nobody waits for this stop: the run's end is ignored, and the next run waits for it through `ending`. */
const stopInBackground = (tool: string) => {
  platform.signInStop(tool).catch(() => {})
}

/** A failure older than the account's last sign-in here says nothing about the sign-in any more. */
export const signedInSince = (
  s: Pick<SignInState, "signedInAt">,
  tool: string,
  profile: string | null,
  at: number | null,
) => at !== null && (s.signedInAt[`${tool}:${profile}`] ?? 0) > at

export const useSignIn = create<SignInState>()((set, get) => {
  const apply = (e: SignInEvent) => {
    // Any step after a question means the tool has its answer, or no longer waits for one.
    const next = { need: null, sent: false }
    switch (e.event) {
      case "note":
        return set((s) => ({
          notes: [...s.notes, e.text],
          ...(s.phase === "scan" && s.scannedAt === null ? { scannedAt: Date.now() } : {}),
        }))
      case "qr":
        return set((s) => ({ ...next, phase: "scan", qr: e, codes: s.codes + 1, scannedAt: null, switchingTo: null }))
      case "pairingCode":
        return set({ ...next, phase: "pair", pairing: e, qr: null, switchingTo: null })
      case "openUrl":
        // Keys this run sends again by itself: drawing their page would look like a step back.
        if (get().reuse && bothKeys() && isTelegramAppsUrl(e.url)) return
        // b24 opens the browser only at a terminal; under the app it only names the page.
        if (isBitrixApp(get())) platform.openUrl(e.url).catch(() => {})
        return set({ ...next, phase: "browser", url: e, qr: null })
      case "needs": {
        const key = keys.get(e.field)
        const { tool, reuse } = get()
        if (reuse && tool && key !== undefined && KEPT.has(e.field)) {
          platform
            .signInAnswer(tool, key)
            .catch((err) => apply({ event: "failed", message: errorText(err), code: failedCode(err) }))
          return
        }
        const provider = guidedProvider(get())
        if (tool && provider && e.secret && e.field === "password" && typed.password) {
          const value = appPasswordValue(provider, typed.password)
          typed.password = undefined
          typed.sentIn = get().run
          platform
            .signInAnswer(tool, value)
            .catch((err) => apply({ event: "failed", message: errorText(err), code: failedCode(err) }))
          return
        }
        const page = linkIn(e.hint)
        return set((s) => ({
          phase: "answer",
          need: e,
          sent: false,
          qr: null,
          expect: null,
          switchingTo: null,
          hintPage: page ?? s.hintPage,
        }))
      }
      case "progress": {
        const s = get()
        // After the code, any word from the tool means the scan went through; the code stays, dimmed, beside it.
        if (s.phase === "scan" && !receivingHistory({ phase: "progress", progress: e }))
          return set({ progress: e, scannedAt: s.scannedAt ?? Date.now() })
        // Checking an answer keeps the question on screen, marked sent, rather than swapping it for a spinner and back.
        if (s.phase === "answer" && s.sent) return set({ progress: e })
        // Keys sent again by themselves are checked behind the step already drawn.
        if (s.reuse && (s.phase === "starting" || s.phase === "browser")) return set({ progress: e })
        return set({ ...next, phase: "progress", progress: e, qr: null, url: null, expect: null })
      }
      case "done":
        forget()
        set((s) => ({
          ...next,
          phase: "done",
          done: e,
          qr: null,
          url: null,
          stopping: false,
          switchingTo: null,
          signedInAt: { ...s.signedInAt, [`${s.tool}:${s.profile}`]: Date.now() },
        }))
        return get().onFinish?.()
      case "failed": {
        const s = get()
        // A refused webhook keeps its address: after ticking a right in Bitrix24 it stays the same, so Check again works.
        const app = isBitrixApp(s) ? appProblem(e) : null
        if (app)
          return set({
            ...closed,
            ...kept(s),
            tool: s.tool,
            profile: s.profile,
            method: s.method,
            onFinish: s.onFinish,
            run: s.run + 1,
            phase: "plan",
            planStep: "app",
            appProblem: app,
          })
        const refusal = s.tool === BITRIX && !isBitrixApp(s) ? webhookProblem(e) : null
        if (refusal)
          return set({
            ...closed,
            ...kept(s),
            tool: s.tool,
            profile: s.profile,
            method: s.method,
            onFinish: s.onFinish,
            run: s.run + 1,
            phase: "plan",
            planStep: "paste",
            webhookProblem: refusal,
          })
        if (typed.sentIn === s.run && e.reason && WRONG_PASSWORD.has(e.reason))
          return set({
            ...closed,
            ...kept(s),
            tool: s.tool,
            profile: s.profile,
            method: s.method,
            onFinish: s.onFinish,
            run: s.run + 1,
            phase: "plan",
            planStep: "password",
            passwordProblem: { reason: e.reason, message: e.message },
          })
        return set({
          ...next,
          phase: "failed",
          failure: e,
          failedAt: running(s.phase) ? (s.phase as FailedAt) : null,
          qr: null,
          url: null,
          stopping: false,
        })
      }
      case "stopped":
        forget()
        return set({ ...closed })
    }
  }

  /** Portal and the way in, then its steps; the paste step's and the application's button run through `begin`. */
  const bitrixNext = () => {
    const { planStep, portal, tool, method } = get()
    if (planStep === "choose") {
      const host = portalHost(portal)
      if (!host || portalProblem(portal)) return set({ planMissing: "portal" })
      // Before the owner makes the application in Bitrix24, not after: an older b24 cannot use it.
      if (method === BITRIX_APP && methodTooOld(tool, method)) return set({ portal: host, planMissing: "update" })
      const step = method === BITRIX_APP ? "app" : "webhook"
      return set({ portal: host, planStep: step, planMissing: null, webhookProblem: null, appProblem: null })
    }
    set({ planStep: "paste", planMissing: null })
  }

  /** What the window can tell before b24 runs: the address's shape, its portal, and another profile already on it. */
  const compareThenRun = async (run: () => void) => {
    const { tool, profile, portal, run: at } = get()
    if (!tool || !profile) return
    if (!typed.password?.trim()) return set({ planMissing: "webhook", webhookProblem: null })
    const parts = webhookParts(typed.password)
    if (!parts) return set({ webhookProblem: { kind: "malformed", message: "" } })
    if (parts.host !== portalHost(portal)) return set({ webhookProblem: { kind: "wrongPortal", host: parts.host } })
    set({ comparing: true, webhookProblem: null, planMissing: null })
    // b24 refuses a duplicate too: a failed read here leaves it to the run.
    const same = await platform.signInOnPortal(tool, parts.host).catch(() => [])
    if (get().run !== at || get().phase !== "plan") return
    const other = same.find((p) => p.profile !== profile && p.user === parts.user)
    set({ comparing: false })
    if (other) return set({ webhookProblem: { kind: "duplicate", profile: other.profile, message: "" } })
    run()
  }

  return {
    ...closed,
    run: 0,
    signedInAt: {},
    start(tool, profile, onFinish, method, reuse = false) {
      const entry = findTool(tool)
      const chosen = method ?? (entry ? signInMethods(entry)[0]?.id : undefined) ?? "qr"
      const previous = get()
      // Switching methods: the tool runs one sign-in at a time, so the last run ends before the next starts.
      const same = previous.tool === tool && previous.profile === profile
      if (!same) forget()
      const keep = same ? kept(previous) : {}
      const switching = previous.tool !== null && running(previous.phase)
      if (switching && previous.tool) stopInBackground(previous.tool)
      const run = previous.run + 1
      if (method === undefined && !switching) {
        set({ ...closed, ...keep, tool, profile, method: chosen, run, phase: "plan", onFinish: onFinish ?? null })
        return
      }
      const reusing = (reuse || switching) && keys.size > 0
      // Keys typed but not both sent again by themselves, or a switch away from the keys step: tg asks them first.
      const onKeys = previous.phase === "answer" && previous.need !== null && KEPT.has(previous.need.field)
      const keysFirst = !(reusing && bothKeys()) && (keys.size > 0 || onKeys)
      set({
        ...closed,
        ...keep,
        tool,
        profile,
        method: chosen,
        run,
        onFinish: onFinish ?? null,
        reuse: reusing,
        expect: keysFirst ? "keys" : null,
        switchingTo: switching ? chosen : null,
        // The step the run left from, so its copy fading out still shows it.
        planStep: same ? previous.planStep : "choose",
      })
      const inputs = inputsFor(tool, chosen, get())
      const mine = () => get().run === run && get().tool !== null
      // A stop sent before Rust registered the run is lost, so a word from a run nobody watches stops it again. Rust
      // sends the last word after the tool exited: from then on the next run may start, and a late word is ignored.
      let ended = false
      let over = () => {}
      const last = new Promise<void>((done) => {
        over = done
      })
      const onEvent = (e: SignInEvent) => {
        const final = e.event === "stopped" || e.event === "done" || e.event === "failed"
        if (mine()) apply(e)
        else if (!ended && !final) stopInBackground(tool)
        if (final) over()
      }
      // A run closed a moment ago may still be stopping, even when nothing runs on screen.
      const started = previousEnded().then(() =>
        mine() ? platform.signIn(tool, chosen, profile, onEvent, inputs) : undefined,
      )
      ending = Promise.race([started.catch(() => {}), last]).then(() => {
        ended = true
      })
      started.then(
        () => {
          if (mine() && running(get().phase))
            apply({ event: "failed", message: "The sign-in ended without saying how.", code: ENDED })
        },
        (e) => mine() && apply({ event: "failed", message: errorText(e), code: failedCode(e) }),
      )
    },
    begin() {
      const { tool, profile, method, phase, onFinish, ownId, ownFile, planStep } = get()
      if (phase !== "plan" || !tool || !profile || !method) return
      if (tool === BITRIX && planStep !== "paste" && planStep !== "app") return bitrixNext()
      if (tool === BITRIX && planStep === "app") {
        if (!appIdShaped(get().appId)) return set({ planMissing: "appId", appProblem: null })
        if (!typed.password?.trim()) return set({ planMissing: "appKey", appProblem: null })
        set({ planMissing: null, appProblem: null })
      }
      const chosen = methodOf(tool, method)
      if (guidedProvider(get())) {
        if (planStep === "choose") {
          typed.password = undefined
          return set({ planStep: "password", planMissing: null, passwordProblem: null })
        }
        if (!typed.password?.trim()) return set({ planMissing: "password" })
      }
      if (chosen?.oauth && get().way === "browser" && !ownFile && oauthTooOld(tool, method))
        return set({ planMissing: "client" })
      if (chosen?.password && !ownFile && !typed.password) return set({ planMissing: "password" })
      if (tool === ASTERISK) {
        if (sourceProblem(method, get().source)) return set({ planMissing: "source" })
        if (chosen?.stdin && !typed.password) return set({ planMissing: "password" })
      }
      const setting = chosen?.clientId
      const saves: [string, string][] = [
        ...(setting && ownId.trim() ? [[setting, ownId.trim()] as [string, string]] : []),
        ...(tool === ASTERISK ? sourceSettings(method, get().source) : []),
      ]
      const run = () => get().start(tool, profile, onFinish ?? undefined, method)
      const go = () => {
        if (saves.length === 0) return run()
        set({ planError: null })
        saves
          .reduce<Promise<void>>(
            (saved, [key, value]) => saved.then(() => platform.settingsSet(tool, profile, false, key, value)),
            Promise.resolve(),
          )
          .then(run, (e) => set({ planError: errorText(e) }))
      }
      const launch = tool === BITRIX && planStep === "paste" ? () => void compareThenRun(go) : go
      if (!useSandbox.getState().name) return launch()
      const asked = get().run
      void useSandbox
        .getState()
        .confirmSignIn()
        .then((ok) => ok && get().run === asked && get().phase === "plan" && launch())
    },
    again() {
      const { tool, profile, onFinish, method, failure } = get()
      const good = tool === "tg" && failure !== null && keysStillGood(telegramFailure(failure.message, failure.code))
      if (tool && profile) get().start(tool, profile, onFinish ?? undefined, method ?? undefined, good)
    },
    toPlan() {
      const s = get()
      const { tool, profile, method, phase, onFinish, run } = s
      if (!tool || !profile) return
      if (running(phase)) stopInBackground(tool)
      set({ ...closed, ...kept(s), tool, profile, method, run: run + 1, phase: "plan", onFinish, planStep: s.planStep })
    },
    async answer(value) {
      const { tool, need, sent } = get()
      if (!tool || !need || sent) return
      set({ sent: true })
      if (KEPT.has(need.field)) keys.set(need.field, value)
      else if (!need.secret && !SPENT.has(need.field)) refill.set(need.field, value)
      // The plan's own field: a new try passes it as the method's flag, and the tool does not ask again.
      if (need.field === "address" && !need.secret) set({ address: value })
      try {
        await platform.signInAnswer(tool, value)
      } catch (e) {
        if (get().need === need) set({ sent: false })
        throw e
      }
    },
    stop() {
      const { tool, phase, stopping } = get()
      if (!tool || !running(phase) || stopping) return
      set({ stopping: true })
      platform.signInStop(tool).catch((e) => apply({ event: "failed", message: errorText(e), code: failedCode(e) }))
    },
    close() {
      const { tool, phase, onFinish } = get()
      forget()
      set({ ...closed })
      if (!tool || !running(phase)) return
      stopInBackground(tool)
      // `wa` keeps the history that came before the stop; the accounts list shows it once the run has ended.
      ending.then(() => onFinish?.())
    },
  }
})

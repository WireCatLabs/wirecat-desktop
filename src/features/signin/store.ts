import { create } from "zustand"
import { findTool, signInMethods } from "@/domain/catalog"
import { isTelegramAppsUrl, keysStillGood, telegramFailure } from "@/domain/telegram-signin"
import { platform } from "@/platform/bridge"
import type { SignInEvent, SignInInputs } from "@/platform/signin-schemas"

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
export const ENDED = "ended"

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
  planMissing: "address" | "password" | null
  run: number
  onFinish: (() => void) | null
  /** Without `method` it opens on the plan, and `begin` runs it; with one (a switch, a retry) it runs at once. */
  start(tool: string, profile: string, onFinish?: () => void, method?: string, reuse?: boolean): void
  /** Saves the owner's own app id first when one is typed, then runs the sign-in. */
  begin(): void
  /** Starts the same sign-in again, after a failure. */
  again(): void
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
  planMissing: null,
}

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
export const keptAnswer = (field: string) => keys.get(field) ?? ""
export const APP_KEYS = KEPT

/** The app password and the client file's text, kept beside the app keys and forgotten with them. */
const typed: { password: string | undefined; clientFile: string | undefined } = {
  password: undefined,
  clientFile: undefined,
}
const forget = () => {
  keys.clear()
  typed.password = undefined
  typed.clientFile = undefined
}
export const setPassword = (value: string) => {
  typed.password = value
}
export const setClientFile = (name: string | null, text?: string) => {
  typed.clientFile = name ? text : undefined
  useSignIn.setState({ ownFile: name })
}

/** Only what the method takes, and the owner's own app before an app password: with it, Gmail signs in by browser. */
export const methodOf = (tool: string, method: string | null) => {
  const entry = findTool(tool)
  return entry ? signInMethods(entry).find((m) => m.id === method) : undefined
}

function inputsFor(tool: string, method: string, address: string): SignInInputs {
  const m = methodOf(tool, method)
  if (!m) return {}
  const inputs: SignInInputs = {}
  if (m.address && address.trim()) inputs.address = address.trim()
  if (m.clientFile && typed.clientFile) inputs.clientFile = typed.clientFile
  else if (m.password && typed.password) inputs.password = typed.password
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

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Nobody waits for this stop: the run's end is ignored, and the next run waits for it through `ending`. */
const stopInBackground = (tool: string) => {
  platform.signInStop(tool).catch(() => {})
}

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
        return set({ ...next, phase: "browser", url: e, qr: null })
      case "needs": {
        const typed = keys.get(e.field)
        const { tool, reuse } = get()
        if (reuse && tool && typed !== undefined && KEPT.has(e.field)) {
          platform
            .signInAnswer(tool, typed)
            .catch((err) => apply({ event: "failed", message: message(err), code: null }))
          return
        }
        return set({ phase: "answer", need: e, sent: false, qr: null, expect: null, switchingTo: null })
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
        set({ ...next, phase: "done", done: e, qr: null, url: null, stopping: false, switchingTo: null })
        return get().onFinish?.()
      case "failed":
        return set({ ...next, phase: "failed", failure: e, qr: null, url: null, stopping: false })
      case "stopped":
        forget()
        return set({ ...closed })
    }
  }

  return {
    ...closed,
    run: 0,
    start(tool, profile, onFinish, method, reuse = false) {
      const entry = findTool(tool)
      const chosen = method ?? (entry ? signInMethods(entry)[0]?.id : undefined) ?? "qr"
      const previous = get()
      // Switching methods: the tool runs one sign-in at a time, so the last run ends before the next starts.
      const same = previous.tool === tool && previous.profile === profile
      if (!same) forget()
      const kept = same ? { address: previous.address, ownFile: previous.ownFile, ownId: previous.ownId } : {}
      const switching = previous.tool !== null && running(previous.phase)
      if (switching && previous.tool) stopInBackground(previous.tool)
      const run = previous.run + 1
      if (method === undefined && !switching) {
        set({ ...closed, ...kept, tool, profile, method: chosen, run, phase: "plan", onFinish: onFinish ?? null })
        return
      }
      const reusing = (reuse || switching) && keys.size > 0
      // Keys typed but not both sent again by themselves, or a switch away from the keys step: tg asks them first.
      const onKeys = previous.phase === "answer" && previous.need !== null && KEPT.has(previous.need.field)
      const keysFirst = !(reusing && bothKeys()) && (keys.size > 0 || onKeys)
      set({
        ...closed,
        ...kept,
        tool,
        profile,
        method: chosen,
        run,
        onFinish: onFinish ?? null,
        reuse: reusing,
        expect: keysFirst ? "keys" : null,
        switchingTo: switching ? chosen : null,
      })
      const inputs = inputsFor(tool, chosen, get().address)
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
        (e) => mine() && apply({ event: "failed", message: message(e), code: null }),
      )
    },
    begin() {
      const { tool, profile, method, phase, onFinish, ownId, address, ownFile } = get()
      if (phase !== "plan" || !tool || !profile || !method) return
      const chosen = methodOf(tool, method)
      if (chosen?.address && !address.trim()) return set({ planMissing: "address" })
      if (chosen?.password && !ownFile && !typed.password) return set({ planMissing: "password" })
      const setting = chosen?.clientId
      const run = () => get().start(tool, profile, onFinish ?? undefined, method)
      if (!setting || !ownId.trim()) return run()
      set({ planError: null })
      platform.settingsSet(tool, profile, false, setting, ownId.trim()).then(run, (e) => set({ planError: message(e) }))
    },
    again() {
      const { tool, profile, onFinish, method, failure } = get()
      const good = tool === "tg" && failure !== null && keysStillGood(telegramFailure(failure.message, failure.code))
      if (tool && profile) get().start(tool, profile, onFinish ?? undefined, method ?? undefined, good)
    },
    async answer(value) {
      const { tool, need, sent } = get()
      if (!tool || !need || sent) return
      set({ sent: true })
      if (KEPT.has(need.field)) keys.set(need.field, value)
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
      platform.signInStop(tool).catch((e) => apply({ event: "failed", message: message(e), code: null }))
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

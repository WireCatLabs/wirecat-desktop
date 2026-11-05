import { create } from "zustand"
import { findTool, signInMethods } from "@/domain/catalog"
import { keysStillGood, telegramFailure } from "@/domain/telegram-signin"
import { platform } from "@/platform/bridge"
import type { SignInEvent } from "@/platform/signin-schemas"

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
  run: number
  onFinish: (() => void) | null
  /** Without `method` it opens on the plan, and `begin` runs it; with one (a switch, a retry) it runs at once. */
  start(tool: string, profile: string, onFinish?: () => void, method?: string, reuse?: boolean): void
  begin(): void
  /** Starts the same sign-in again, after a failure. */
  again(): void
  answer(value: string): Promise<void>
  stop(): void
  /** While the tool runs, closing stops it first; the dialog closes when the tool has stopped. */
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
  onFinish: null,
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

/** The run in flight, so a new one waits for it to end. */
let ending: Promise<unknown> = Promise.resolve()

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

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
        return set((s) => ({ ...next, phase: "scan", qr: e, codes: s.codes + 1, scannedAt: null }))
      case "pairingCode":
        return set({ ...next, phase: "pair", pairing: e, qr: null })
      case "openUrl":
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
        return set({ phase: "answer", need: e, sent: false, qr: null, expect: null })
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
        keys.clear()
        set({ ...next, phase: "done", done: e, qr: null, url: null, stopping: false })
        return get().onFinish?.()
      case "failed":
        return set({ ...next, phase: "failed", failure: e, qr: null, url: null, stopping: false })
      case "stopped":
        keys.clear()
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
      if (previous.tool !== tool || previous.profile !== profile) keys.clear()
      const switching = previous.tool !== null && running(previous.phase)
      if (switching && previous.tool) platform.signInStop(previous.tool).catch(() => {})
      const run = previous.run + 1
      if (method === undefined && !switching) {
        set({ ...closed, tool, profile, method: chosen, run, phase: "plan", onFinish: onFinish ?? null })
        return
      }
      const reusing = (reuse || switching) && keys.size > 0
      // Keys typed but not both sent again by themselves, or a switch away from the keys step: tg asks them first.
      const onKeys = previous.phase === "answer" && previous.need !== null && KEPT.has(previous.need.field)
      const keysFirst = !(reusing && [...KEPT].every((k) => keys.has(k))) && (keys.size > 0 || onKeys)
      set({
        ...closed,
        tool,
        profile,
        method: chosen,
        run,
        onFinish: onFinish ?? null,
        reuse: reusing,
        expect: keysFirst ? "keys" : null,
      })
      const mine = () => get().run === run && get().tool !== null
      const started = (switching ? ending : Promise.resolve()).then(() =>
        mine() ? platform.signIn(tool, chosen, profile, (e) => mine() && apply(e)) : undefined,
      )
      ending = started.catch(() => {})
      started.then(
        () => {
          if (mine() && running(get().phase))
            apply({ event: "failed", message: "The sign-in ended without saying how.", code: ENDED })
        },
        (e) => mine() && apply({ event: "failed", message: message(e), code: null }),
      )
    },
    begin() {
      const { tool, profile, method, phase, onFinish } = get()
      if (phase !== "plan" || !tool || !profile || !method) return
      get().start(tool, profile, onFinish ?? undefined, method)
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
      if (running(get().phase) && get().tool) get().stop()
      else {
        keys.clear()
        set({ ...closed })
      }
    },
  }
})

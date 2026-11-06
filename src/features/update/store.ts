import { create } from "zustand"
import type { Lang } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { AppUpdate, PackageOutcome, UpdateFailure, UpdateProgress } from "@/platform/types"
import { failureOf } from "./failure"

export const downloadPage = (lang: Lang) => `https://wirecat.dev/${lang}/download`
export const updatesSection = (lang: Lang) => `${downloadPage(lang)}#updates`
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/** `saved`: a .deb or .rpm is in Downloads and handed to the system; `rejected`: it failed the signature check. */
type Phase = "available" | "downloading" | "restarting" | "saved" | "rejected" | "failed"
type Saved = Extract<PackageOutcome, { result: "saved" }>
/** The install command in the user's own terminal: `missing` when none opened, so they copy it instead. */
type Terminal = "idle" | "opening" | "opened" | "missing"

type UpdateState = {
  update: AppUpdate | null
  open: boolean
  phase: Phase
  progress: UpdateProgress | null
  saved: Saved | null
  failure: UpdateFailure | null
  terminal: Terminal
  check(): Promise<void>
  show(): void
  close(): void
  install(): Promise<void>
  openTerminal(): Promise<void>
}

let checking = false

export const useUpdate = create<UpdateState>((set, get) => ({
  update: null,
  open: false,
  phase: "available",
  progress: null,
  saved: null,
  failure: null,
  terminal: "idle",

  async check() {
    // While the dialog is open or an install runs, a newer offer would change what the user is looking at.
    const busy = () => get().open || get().phase !== "available"
    if (checking || busy()) return
    checking = true
    try {
      // Offline, the release server down or no release yet: nothing to offer, and nothing worth interrupting for.
      const update = await platform.checkUpdate().catch(() => null)
      if (update && !busy() && update.version !== get().update?.version) set({ update })
    } finally {
      checking = false
    }
  },

  show: () => set({ open: true }),
  close: () => set({ open: false }),

  async install() {
    const { update, phase } = get()
    if (!update || update.kind === "other" || phase === "downloading" || phase === "restarting") return
    set({ phase: "downloading", progress: null, failure: null, terminal: "idle" })
    const onProgress = (progress: UpdateProgress) => set({ progress })
    if (update.kind !== "self") {
      try {
        const outcome = await platform.downloadPackageUpdate(update.version, onProgress)
        set(outcome.result === "saved" ? { phase: "saved", saved: outcome } : { phase: "rejected" })
      } catch (e) {
        set({ phase: "failed", failure: failureOf(e) })
      }
      return
    }
    try {
      await platform.installUpdate(onProgress)
    } catch (e) {
      set({ phase: "failed", failure: failureOf(e) })
      return
    }
    // The user pressed "Install and restart", so this restart is the one they asked for.
    set({ phase: "restarting" })
    await platform.restart().catch((e) => set({ phase: "failed", failure: failureOf(e) }))
  },

  async openTerminal() {
    if (get().phase !== "saved" || get().terminal === "opening") return
    set({ terminal: "opening" })
    try {
      await platform.openPackageTerminal()
      set({ terminal: "opened" })
    } catch {
      set({ terminal: "missing" })
    }
  },
}))

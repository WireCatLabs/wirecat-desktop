import { create } from "zustand"
import type { BotProfile, BotResult } from "@/platform/bot-schemas"
import { platform } from "@/platform/bridge"

export type BotStep = "name" | "token" | "done"
type Connected = Extract<BotResult, { outcome: "connected" }>
export type BotFailure = Extract<BotResult, { outcome: "failed" }>

type BotSignInState = {
  tool: string | null
  step: BotStep
  profile: string
  /** WhatsApp's ids; not secret, so a new try after a refusal starts with them filled in. */
  fields: Record<string, string>
  checking: boolean
  connected: Connected | null
  failure: BotFailure | null
  /** Every bot name of each tool on this computer; undefined until read, null when the read failed. */
  bots: Record<string, BotProfile[] | null | undefined>
  /** What the messenger answered about each bot; undefined while it is being asked, null when it could not be. */
  checked: Record<string, BotProfile[] | null | undefined>
  run: number
  onFinish: (() => void) | null
  open(tool: string, onFinish?: () => void): void
  /** A new token for a bot that already has a name: straight to the token step. */
  reconnect(tool: string, profile: string): void
  loadBots(tool: string): Promise<void>
  checkBots(tool: string): Promise<void>
  /** Rejects with the tool's words; the dialog that asked shows them. */
  removeBot(tool: string, profile: string): Promise<void>
  toToken(profile: string): void
  back(): void
  setField(key: string, value: string): void
  /** The token is an argument only: it is never kept in the store, so no snapshot or devtools view carries it. */
  connect(token: string): Promise<void>
  close(): void
}

const closed = {
  tool: null,
  step: "name" as BotStep,
  profile: "",
  fields: {},
  checking: false,
  connected: null,
  failure: null,
  onFinish: null,
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useBotSignIn = create<BotSignInState>()((set, get) => ({
  ...closed,
  bots: {},
  checked: {},
  run: 0,
  open(tool, onFinish) {
    set({ ...closed, tool, run: get().run + 1, onFinish: onFinish ?? null })
    void get().loadBots(tool)
  },
  reconnect(tool, profile) {
    set({ ...closed, tool, profile, step: "token", run: get().run + 1 })
  },
  async checkBots(tool) {
    set((s) => ({ checked: { ...s.checked, [tool]: undefined } }))
    try {
      const list = await platform.checkBots(tool)
      set((s) => ({ checked: { ...s.checked, [tool]: list } }))
    } catch {
      set((s) => ({ checked: { ...s.checked, [tool]: null } }))
    }
  },
  async removeBot(tool, profile) {
    await platform.removeBot(tool, profile)
    await get().loadBots(tool)
  },
  async loadBots(tool) {
    try {
      const list = await platform.listBots(tool)
      set((s) => ({ bots: { ...s.bots, [tool]: list } }))
    } catch {
      set((s) => ({ bots: { ...s.bots, [tool]: null } }))
    }
  },
  toToken(profile) {
    set({ profile, step: "token", failure: null })
  },
  back() {
    if (!get().checking) set({ step: "name", failure: null })
  },
  setField(key, value) {
    set((s) => ({ fields: { ...s.fields, [key]: value.trim() } }))
  },
  async connect(token) {
    const { tool, profile, fields, checking, run } = get()
    if (!tool || checking) return
    set({ checking: true, failure: null })
    const mine = () => get().run === run && get().tool === tool
    let result: BotResult
    try {
      result = await platform.botSignIn(tool, profile, token.trim(), fields)
    } catch (e) {
      result = { outcome: "failed", message: message(e), code: null, reason: null }
    }
    void get().loadBots(tool)
    if (result.outcome === "connected") void get().checkBots(tool)
    if (!mine()) return
    if (result.outcome === "connected") {
      set({ checking: false, connected: result, step: "done" })
      get().onFinish?.()
    } else set({ checking: false, failure: result })
  },
  close() {
    set({ ...closed, run: get().run + 1 })
  },
}))

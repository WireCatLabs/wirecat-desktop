import { create } from "zustand"
import type { BackgroundAgents } from "@/platform/background-agent-schemas"
import { platform } from "@/platform/bridge"
import { errorText as message } from "./errors"

type State = {
  /** null until the first answer. */
  agents: BackgroundAgents | null
  error: string | null
  busy: boolean
  chooseError: string | null
  load(): Promise<void>
  choose(id: string): Promise<void>
  /** True once memo's answer says the warning is kept. */
  acknowledge(id: string): Promise<boolean>
}

// Each page part asks on mount, so answers overlap: only the latest may land, or an older one undoes a choice.
let asked = 0

/** The agents for the background jobs; shared by Settings, the mail agent and the digests. */
export const useBackgroundAgents = create<State>((set, get) => ({
  agents: null,
  error: null,
  busy: false,
  chooseError: null,
  async load() {
    const mine = ++asked
    set({ error: null })
    try {
      const agents = await platform.backgroundAgents()
      if (mine === asked) set({ agents })
    } catch (e) {
      if (mine === asked) set({ error: message(e) })
    }
  },
  async choose(id) {
    if (get().busy) return
    set({ busy: true, chooseError: null })
    asked++
    try {
      set({ agents: await platform.backgroundAgentChoose(id) })
    } catch (e) {
      set({ chooseError: message(e) })
    } finally {
      set({ busy: false })
    }
  },
  async acknowledge(id) {
    set({ chooseError: null })
    asked++
    try {
      const agents = await platform.backgroundAgentAcknowledge(id)
      set({ agents })
      return agents.agents.some((a) => a.id === id && a.acknowledged)
    } catch (e) {
      set({ chooseError: message(e) })
      return false
    }
  },
}))

import { create } from "zustand"
import type { PathFix } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { useTools } from "../tools/store"
import { useConnect } from "./connect"
import { useAgents } from "./store"

export type PathFixState =
  | { state: "idle" }
  | { state: "fixing" }
  | { state: "done"; fix: PathFix }
  | { state: "failed"; error: string }

type Store = {
  status: PathFixState
  /** Puts the tools on PATH where a terminal misses them, then asks the tools and their skills again. */
  fix(tools: readonly string[]): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const usePathFix = create<Store>((set, get) => ({
  status: { state: "idle" },
  async fix(tools) {
    if (get().status.state === "fixing") return
    set({ status: { state: "fixing" } })
    try {
      const fix = await platform.fixTerminalPath([...tools])
      set({ status: { state: "done", fix } })
    } catch (e) {
      set({ status: { state: "failed", error: message(e) } })
    }
    // Asked again whatever happened: a check that failed only because the app looked too early now answers.
    await useTools
      .getState()
      .refresh()
      .catch(() => undefined)
    const reach = await platform.terminalReach().catch(() => null)
    if (reach) useConnect.setState({ reach })
    const installed = Object.entries(useTools.getState().installs).flatMap(([id, copies]) =>
      copies.length ? [id] : [],
    )
    await Promise.all(installed.map((id) => useAgents.getState().recheck(id)))
  },
}))

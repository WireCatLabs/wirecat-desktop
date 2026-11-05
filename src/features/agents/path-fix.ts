import { create } from "zustand"
import type { PathFix, ShellChoices } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { useAgents } from "@/shared/agents-store"
import { useTools } from "@/shared/tools-store"
import { useConnect } from "./connect"

export type PathFixState =
  | { state: "idle" }
  | { state: "fixing"; shell: string | null }
  /** `picked`: the shell the owner said their terminal runs, "hand" when they chose to add the line themselves. */
  | { state: "done"; fix: PathFix; picked: string | null }
  | { state: "failed"; error: string }

type Store = {
  status: PathFixState
  /** The tools of the last Fix, so choosing a shell checks the same ones. */
  tools: string[]
  /** Loaded when a check fails, for "Which shell does your terminal run?". */
  shells: ShellChoices | null
  /** Windows keeps the PATH in the registry: no shell to ask about. */
  windows: boolean
  /** Puts the tools on PATH where a terminal misses them, then asks the tools and their skills again. */
  fix(tools: readonly string[]): Promise<void>
  /** The owner's terminal runs this shell: WireCat writes its file and checks again with it. */
  pickShell(shell: string): Promise<void>
  /** The owner skips the question and adds the line themselves. */
  byHand(): void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Asked again whatever happened: a check that failed only because the app looked too early now answers. */
async function recheck() {
  await useTools
    .getState()
    .refresh()
    .catch(() => undefined)
  const reach = await platform.terminalReach().catch(() => null)
  if (reach) useConnect.setState({ reach })
  const installed = Object.entries(useTools.getState().installs).flatMap(([id, copies]) => (copies.length ? [id] : []))
  await Promise.all(installed.map((id) => useAgents.getState().recheck(id)))
}

export const usePathFix = create<Store>((set, get) => {
  const run = async (shell: string | null, call: () => Promise<PathFix>) => {
    if (get().status.state === "fixing") return
    set({ status: { state: "fixing", shell } })
    try {
      const fix = await call()
      set({ status: { state: "done", fix, picked: shell } })
      if (fix.unreachable.length > 0 && !get().windows && shell === null) {
        const shells = await platform.terminalShells().catch(() => null)
        set({ shells })
      }
    } catch (e) {
      set({ status: { state: "failed", error: message(e) } })
    }
    await recheck()
  }
  return {
    status: { state: "idle" },
    tools: [],
    shells: null,
    windows: platform.os === "windows",
    async fix(tools) {
      set({ tools: [...tools] })
      await run(null, () => platform.fixTerminalPath([...tools]))
    },
    async pickShell(shell) {
      await run(shell, () => platform.useTerminalShell(shell, get().tools))
    },
    byHand() {
      const status = get().status
      if (status.state === "done") set({ status: { ...status, picked: "hand" } })
    },
  }
})

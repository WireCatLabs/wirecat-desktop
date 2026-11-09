import { create } from "zustand"
import { platform } from "@/platform/bridge"
import { useSandbox } from "@/shared/sandbox-store"

/**
 * A sign-in the app handed to a terminal window, per tool. `preview`: the browser build, where no terminal opens.
 * The terminal reports nothing back, so the state stays until the owner checks or starts another.
 */
export type TerminalSignIn = { profile: string } & (
  | { state: "opened" }
  | { state: "preview" }
  | { state: "failed"; error: string }
)

type TerminalState = {
  byTool: Record<string, TerminalSignIn>
  open(tool: string, profile: string): Promise<void>
  clear(tool: string): void
}

export const useTerminal = create<TerminalState>((set) => ({
  byTool: {},
  async open(tool, profile) {
    if (!(await useSandbox.getState().confirmSignIn())) return
    let next: TerminalSignIn
    try {
      await platform.openSetup(tool, profile)
      next = { profile, state: platform.kind === "mock" ? "preview" : "opened" }
    } catch (e) {
      next = { profile, state: "failed", error: e instanceof Error ? e.message : String(e) }
    }
    set((s) => ({ byTool: { ...s.byTool, [tool]: next } }))
  },
  clear(tool) {
    set((s) => {
      const { [tool]: _, ...rest } = s.byTool
      return { byTool: rest }
    })
  },
}))

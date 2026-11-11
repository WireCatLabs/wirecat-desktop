import type { BackgroundAgent, BackgroundAgents } from "./background-agent-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

const AGENTS: Omit<BackgroundAgent, "state" | "signedIn" | "reason">[] = [
  { id: "claude", name: "Claude Code", reportsCost: true },
  { id: "codex", name: "Codex", reportsCost: false },
  { id: "cursor", name: "Cursor", reportsCost: false },
  { id: "gemini", name: "Gemini CLI", reportsCost: false },
  { id: "opencode", name: "OpenCode", reportsCost: false },
  { id: "hermes", name: "Hermes Agent", reportsCost: false },
  { id: "openclaw", name: "OpenClaw", reportsCost: false },
  { id: "kimi", name: "Kimi CLI", reportsCost: false },
]
const STARTS = ["claude", "codex", "gemini", "kimi"]

// The agent for background jobs: Claude Code and Codex ready, Kimi CLI installed but greyed (it approves every command
// itself), Cursor found but not one memo starts, Gemini CLI started by memo but not installed, none chosen. `?agents=claude` or `?agents=codex` has only that one ready,
// `?agents=none` none; `?agent=<id>` starts with it chosen; `?codex=signedout`; `?agents-memo=old` is a memo before
// `schedule agents`: Claude Code and Codex only, the rest wait for a newer Memo.
export function backgroundAgentMock(
  params: URLSearchParams,
): Pick<Platform, "backgroundAgents" | "backgroundAgentChoose"> {
  const have = params.get("agents") ?? "both"
  const listed = params.get("agents-memo") !== "old"
  let chosen = params.get("agent")
  const installed = (id: string) =>
    id === "cursor" ||
    (id === "kimi" && have === "both" && listed) ||
    (id === "claude" || id === "codex" ? have === "both" || have === id : false)
  const answer = (): BackgroundAgents => {
    const agents = AGENTS.map((a): BackgroundAgent => {
      const starts = listed ? STARTS.includes(a.id) : a.id === "claude" || a.id === "codex"
      const state = !starts ? (listed ? "notSupported" : "needsNewerMemo") : installed(a.id) ? "ready" : "notInstalled"
      const signedIn = state === "ready" ? !(a.id === "codex" && params.get("codex") === "signedout") : null
      // Only Claude Code and Codex are held to the CLIs' commands or folders: the others are greyed, never hidden.
      const held = a.id === "claude" || a.id === "codex"
      const shown = state === "ready" && !held ? "unrestricted" : state
      const reason = shown === "unrestricted" ? "approves every command in print mode" : null
      return {
        ...a,
        state: shown,
        signedIn: shown === "ready" ? signedIn : null,
        reportsCost: starts && a.reportsCost,
        reason,
      }
    })
    const ready = agents.filter((a) => a.state === "ready").map((a) => a.id)
    const effective = chosen ? (ready.includes(chosen) ? chosen : null) : ready.length === 1 ? (ready[0] ?? null) : null
    return { agents, chosen, effective, listed }
  }
  return {
    async backgroundAgents() {
      await delay(400)
      return answer()
    },
    async backgroundAgentChoose(id) {
      await delay(300)
      chosen = id
      return answer()
    },
  }
}

/** For tests: Claude Code and Codex, ready as `ready` lists, and Cursor found but not one memo starts. */
export function agentsFixture(ready: string[], chosen: string | null = null, listed = true): BackgroundAgents {
  const agents: BackgroundAgent[] = [
    ...["claude", "codex"].map((id) => ({
      id,
      name: id === "claude" ? "Claude Code" : "Codex",
      state: ready.includes(id) ? ("ready" as const) : ("notInstalled" as const),
      signedIn: null,
      reportsCost: id === "claude",
      reason: null,
    })),
    {
      id: "cursor",
      name: "Cursor",
      state: listed ? "notSupported" : "needsNewerMemo",
      signedIn: null,
      reportsCost: false,
      reason: null,
    },
  ]
  const effective = chosen ? (ready.includes(chosen) ? chosen : null) : ready.length === 1 ? (ready[0] ?? null) : null
  return { agents, chosen, effective, listed }
}

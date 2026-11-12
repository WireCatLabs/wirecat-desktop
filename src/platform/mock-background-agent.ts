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
// cli-core #2882: memo starts each of these and marks which it cannot limit (`restricted: false`); the real list comes
// from memo, so this set is only the mock's.
const UNHELD = ["codex", "cursor", "openclaw", "hermes", "kimi"]
const REASON = "cannot be held to read-only commands in its one-shot mode"

// The agent for background jobs: Claude Code and Gemini CLI ready, Codex and Kimi CLI installed but greyed (memo cannot
// limit their commands), Cursor's settings found but not its `cursor-agent`, the rest not installed, none chosen.
// `?agents=claude` or `?agents=gemini` has only that one ready, `?agents=none` none; `?agent=<id>` starts with it
// chosen; `?gemini=signedout`; `?agents-memo=old` is a memo before `schedule agents list`: Claude Code, and Codex
// greyed, the rest wait for a newer Memo.
export function backgroundAgentMock(
  params: URLSearchParams,
): Pick<Platform, "backgroundAgents" | "backgroundAgentChoose"> {
  const have = params.get("agents") ?? "both"
  const listed = params.get("agents-memo") !== "old"
  let chosen = params.get("agent")
  const installed = (id: string) =>
    ((id === "kimi" || id === "codex") && have === "both") ||
    ((id === "claude" || id === "gemini") && (have === "both" || have === id))
  const answer = (): BackgroundAgents => {
    const agents = AGENTS.map((a): BackgroundAgent => {
      const starts = listed || a.id === "claude" || a.id === "codex"
      const state = !starts
        ? "needsNewerMemo"
        : !installed(a.id)
          ? a.id === "cursor"
            ? "programMissing"
            : "notInstalled"
          : UNHELD.includes(a.id)
            ? "unrestricted"
            : "ready"
      const signedIn = state === "ready" ? !(a.id === "gemini" && params.get("gemini") === "signedout") : null
      const reason = state === "unrestricted" && listed ? REASON : null
      return { ...a, state, signedIn, reportsCost: starts && a.reportsCost, reason }
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

/**
 * For tests: Claude Code and Gemini CLI, ready as `ready` lists; Codex installed but refused by memo; Cursor found but
 * not one memo starts.
 */
export function agentsFixture(ready: string[], chosen: string | null = null, listed = true): BackgroundAgents {
  const agents: BackgroundAgent[] = [
    ...["claude", "gemini"].map((id) => ({
      id,
      name: id === "claude" ? "Claude Code" : "Gemini CLI",
      state: ready.includes(id) ? ("ready" as const) : ("notInstalled" as const),
      signedIn: null,
      reportsCost: id === "claude",
      reason: null,
    })),
    {
      id: "codex",
      name: "Codex",
      state: "unrestricted",
      signedIn: null,
      reportsCost: false,
      reason: listed ? REASON : null,
    },
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

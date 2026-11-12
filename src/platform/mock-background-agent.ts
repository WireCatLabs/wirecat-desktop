import type { BackgroundAgent, BackgroundAgents } from "./background-agent-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

const AGENTS: Pick<BackgroundAgent, "id" | "name" | "reportsCost">[] = [
  { id: "claude", name: "Claude Code", reportsCost: true },
  { id: "codex", name: "Codex", reportsCost: false },
  { id: "cursor", name: "Cursor", reportsCost: false },
  { id: "gemini", name: "Gemini CLI", reportsCost: false },
  { id: "opencode", name: "OpenCode", reportsCost: false },
  { id: "hermes", name: "Hermes Agent", reportsCost: false },
  { id: "openclaw", name: "OpenClaw", reportsCost: false },
  { id: "kimi", name: "Kimi CLI", reportsCost: false },
]
// cli-core #2882: memo starts each of these and marks which it cannot limit (`restricted: false`), and which of those it
// still schedules once the owner confirms a warning; the real list comes from memo, so these sets are only the mock's.
const UNHELD = ["codex", "cursor", "openclaw", "hermes", "kimi"]
const WARNED = ["codex"]
const REASON = "cannot be held to read-only commands in its one-shot mode"
const WARNED_REASON = "runs any program and reads your files; Memo blocks writing files and the network"

// The agent for background jobs: Claude Code and Gemini CLI ready, Codex ready after a warning, Kimi CLI installed but
// greyed (memo cannot limit it), Cursor's settings found but not its `cursor-agent`, the rest not installed, none
// chosen. `?agents=claude` or `?agents=gemini` has only that one ready, `?agents=none` none; `?agent=<id>` starts with
// it chosen; `?gemini=signedout`; `?codex-ack=yes` has Codex's warning confirmed; `?agents-memo=old` is a memo before
// `schedule agents list`: Claude Code, and Codex greyed, the rest wait for a newer Memo.
export function backgroundAgentMock(
  params: URLSearchParams,
): Pick<Platform, "backgroundAgents" | "backgroundAgentChoose" | "backgroundAgentAcknowledge"> {
  const have = params.get("agents") ?? "both"
  const listed = params.get("agents-memo") !== "old"
  let chosen = params.get("agent")
  const acknowledged = new Set(params.get("codex-ack") === "yes" ? ["codex"] : [])
  const installed = (id: string) =>
    ((id === "kimi" || id === "codex") && have === "both") ||
    ((id === "claude" || id === "gemini") && (have === "both" || have === id))
  const answer = (): BackgroundAgents => {
    const agents = AGENTS.map((a): BackgroundAgent => {
      const starts = listed || a.id === "claude" || a.id === "codex"
      const warned = listed && WARNED.includes(a.id)
      const state = !starts
        ? "needsNewerMemo"
        : !installed(a.id)
          ? a.id === "cursor"
            ? "programMissing"
            : "notInstalled"
          : UNHELD.includes(a.id) && !warned
            ? "unrestricted"
            : "ready"
      const signedIn = state === "ready" ? !(a.id === "gemini" && params.get("gemini") === "signedout") : null
      const reason = !listed || !UNHELD.includes(a.id) ? null : warned ? WARNED_REASON : REASON
      return {
        ...a,
        state,
        signedIn,
        reportsCost: starts && a.reportsCost,
        reason,
        needsAck: warned,
        acknowledged: acknowledged.has(a.id),
      }
    })
    const ready = agents.filter((a) => a.state === "ready" && (!a.needsAck || a.acknowledged)).map((a) => a.id)
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
      const agent = answer().agents.find((a) => a.id === id)
      if (agent?.needsAck && !agent.acknowledged) throw new Error(`Memo cannot limit what ${id} runs: confirm first.`)
      chosen = id
      return answer()
    },
    async backgroundAgentAcknowledge(id) {
      await delay(300)
      if (WARNED.includes(id)) acknowledged.add(id)
      return answer()
    },
  }
}

/**
 * For tests: Claude Code, Gemini CLI and Codex, ready as `ready` lists; Codex needs the owner's confirmation first
 * (confirmed when `acked`), Cursor is found but not one memo starts. On an old memo Codex is greyed.
 */
export function agentsFixture(
  ready: string[],
  chosen: string | null = null,
  listed = true,
  acked = false,
): BackgroundAgents {
  const plain = { signedIn: null, reason: null, needsAck: false, acknowledged: false }
  const agents: BackgroundAgent[] = [
    ...["claude", "gemini"].map((id) => ({
      ...plain,
      id,
      name: id === "claude" ? "Claude Code" : "Gemini CLI",
      state: ready.includes(id) ? ("ready" as const) : ("notInstalled" as const),
      reportsCost: id === "claude",
    })),
    {
      id: "codex",
      name: "Codex",
      state: !ready.includes("codex") ? "notInstalled" : listed ? "ready" : "unrestricted",
      signedIn: null,
      reportsCost: false,
      reason: listed ? WARNED_REASON : null,
      needsAck: listed,
      acknowledged: listed && acked,
    },
    { ...plain, id: "cursor", name: "Cursor", state: listed ? "notSupported" : "needsNewerMemo", reportsCost: false },
  ]
  const usable = ready.filter((id) => id !== "codex" || (listed && acked))
  const effective = chosen
    ? usable.includes(chosen)
      ? chosen
      : null
    : usable.length === 1
      ? (usable[0] ?? null)
      : null
  return { agents, chosen, effective, listed }
}

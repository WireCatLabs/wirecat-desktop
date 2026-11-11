import type { BackgroundAgents } from "./background-agent-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// The agent for background jobs: Claude Code and Codex both installed, none chosen yet. `?agents=claude` or
// `?agents=codex` has only that one, `?agents=none` neither; `?agent=<id>` starts with it chosen;
// `?codex=signedout` has Codex installed but not signed in.
export function backgroundAgentMock(
  params: URLSearchParams,
): Pick<Platform, "backgroundAgents" | "backgroundAgentChoose"> {
  const have = params.get("agents") ?? "both"
  let chosen = params.get("agent")
  const installed = (id: string) => have === "both" || have === id
  const answer = (): BackgroundAgents => {
    const agents = ["claude", "codex"].map((id) => ({
      id,
      installed: installed(id),
      signedIn: installed(id) ? !(id === "codex" && params.get("codex") === "signedout") : null,
    }))
    const found = agents.filter((a) => a.installed)
    return { agents, chosen, effective: chosen ?? (found.length === 1 ? (found[0]?.id ?? null) : null) }
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

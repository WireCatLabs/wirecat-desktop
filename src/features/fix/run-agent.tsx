import { CheckCircle2 } from "lucide-react"
import { useEffect } from "react"
import { useMessages } from "@/i18n"
import type { Agent, AgentRun } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { useAgents } from "@/shared/agents-store"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { fixMessages } from "./messages"

/** The agents `run_agent` can start with a prompt, and the program each runs; Rust holds the same list. */
export const STARTABLE: Record<string, string> = { claude: "claude", codex: "codex", gemini: "gemini" }

export const canStart = (agent: Agent) => agent.id in STARTABLE && agent.foundBy === "program"

/** What each startable agent is called before it is found, and the command that installs it (its npm package). */
const KNOWN: Record<string, { name: string; install: string }> = {
  claude: { name: "Claude Code", install: "npm install -g @anthropic-ai/claude-code" },
  codex: { name: "Codex", install: "npm install -g @openai/codex" },
  gemini: { name: "Gemini CLI", install: "npm install -g @google/gemini-cli" },
}

export type Launchable = { id: string; name: string; found: boolean }

/** Every agent WireCat can start, the ones found on this computer first; null while they are looked for. */
export function useLaunchable(enabled = true): Launchable[] | null {
  const agents = useAgents((s) => s.agents)
  useEffect(() => {
    if (enabled) void useAgents.getState().detect()
  }, [enabled])
  if (agents === null) return null
  const all = Object.keys(STARTABLE).map((id) => {
    const seen = agents.find((a) => a.id === id)
    return { id, name: seen?.name ?? KNOWN[id]?.name ?? id, found: seen ? canStart(seen) : false }
  })
  return [...all.filter((a) => a.found), ...all.filter((a) => !a.found)]
}

/** The agents found that WireCat can start; null while they are looked for, which starts once `enabled`. */
export function useStartableAgents(enabled = true): Agent[] | null {
  const agents = useAgents((s) => s.agents)
  useEffect(() => {
    if (enabled) void useAgents.getState().detect()
  }, [enabled])
  return agents === null ? null : agents.filter(canStart)
}

/** Opens the agent in a terminal with the prompt; a failure to even ask comes back as a terminal failure. */
export function runAgent(agent: string, prompt: string): Promise<AgentRun> {
  return platform
    .runAgent(agent, prompt)
    .catch((e): AgentRun => ({ started: false, agent, file: "", reason: "terminal", message: String(e) }))
}

/** What happened after a start: the agent is open, or why it is not and what to do instead. */
export function AgentRunNote({ run, name, started }: { run: AgentRun; name: string; started: string }) {
  const m = useMessages(fixMessages)
  if (run.started)
    return (
      <p className="flex items-start gap-2 text-[0.9rem] text-ink">
        <CheckCircle2 aria-hidden className="mt-[0.15rem] size-4 shrink-0 text-ok" />
        {started}
      </p>
    )
  const install = KNOWN[run.agent]?.install
  const why =
    run.reason === "missing"
      ? `${m.why.missing(name, STARTABLE[run.agent] ?? run.agent)}${install ? ` ${m.install(name, install)}` : ""}`
      : run.reason === "automation"
        ? m.why.automation
        : run.reason === "terminal"
          ? m.why.terminal
          : run.message
  return (
    <ErrorNotice inline detail={why}>
      {m.failed(name)}
    </ErrorNotice>
  )
}

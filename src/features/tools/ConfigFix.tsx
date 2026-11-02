import { Bot, Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { configPrompt, FIX_AGENTS } from "@/domain/config-prompt"
import type { Finding } from "@/domain/doctor"
import { useMessages } from "@/i18n"
import type { Agent } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { SplitButton } from "@/ui/SplitButton"
import { ReportThis } from "../report/ReportThis"
import { toolsMessages } from "./messages"

let detected: Promise<Agent[]> | null = null
/** Agents found as a program, which can be started with a first prompt; read once per window. */
function useFixAgents(): Agent[] {
  const [agents, setAgents] = useState<Agent[]>([])
  useEffect(() => {
    let live = true
    detected ??= platform.detectAgents().catch(() => {
      detected = null
      return []
    })
    detected.then((all) => {
      if (live) setAgents(all.filter((a) => a.foundBy === "program" && FIX_AGENTS.includes(a.id)))
    })
    return () => {
      live = false
    }
  }, [])
  return agents
}

export function forgetDetectedAgents() {
  detected = null
}

type Started = { agent: Agent; state: "opened" | "preview" | "failed"; error?: string }

/** One configuration problem: copy a prompt about it for any agent, or start an installed agent on it. */
export function ConfigFix({ tool, finding, profile }: { tool: CatalogTool; finding: Finding; profile: string | null }) {
  const m = useMessages(toolsMessages).health
  const agents = useFixAgents()
  const [copied, setCopied] = useState(false)
  const [started, setStarted] = useState<Started | null>(null)
  const prompt = configPrompt(tool, finding, profile)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
  }
  const start = async (agent: Agent) => {
    try {
      await platform.fixInAgent(agent.id, tool.id, prompt)
      setStarted({ agent, state: platform.kind === "mock" ? "preview" : "opened" })
    } catch (e) {
      setStarted({ agent, state: "failed", error: e instanceof Error ? e.message : String(e) })
    }
  }
  const [first, ...rest] = agents

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={copy}
          icon={copied ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        >
          {copied ? m.promptCopied : m.copyPrompt}
        </Button>
        {first &&
          (rest.length === 0 ? (
            <Button size="sm" onClick={() => start(first)} icon={<Bot className="size-4" aria-hidden />}>
              {m.fixIn(first.name)}
            </Button>
          ) : (
            <SplitButton
              size="sm"
              main={{
                label: m.fixIn(first.name),
                onClick: () => start(first),
                icon: <Bot className="size-4" aria-hidden />,
              }}
              items={rest.map((a) => ({ label: m.fixIn(a.name), onSelect: () => start(a) }))}
              menuLabel={m.otherAgents}
            />
          ))}
        <span className="sr-only" aria-live="polite">
          {copied ? m.promptCopied : ""}
        </span>
      </div>
      {started && (
        <div role="status" className="reveal flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-ink-soft">
          {started.state === "failed" ? (
            <>
              <span className="min-w-0 flex-1">
                {m.agentFailed(started.agent.name)} {started.error}
              </span>
              <ReportThis
                what={`Starting ${started.agent.name} on a settings problem`}
                tool={tool.id}
                error={started.error ?? ""}
              />
            </>
          ) : (
            <span>
              {started.state === "preview" ? m.agentPreview(started.agent.name) : m.agentOpened(started.agent.name)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

import { CheckCircle2, ChevronRight, SquareTerminal } from "lucide-react"
import { useEffect, useState } from "react"
import { fixPrompt, type Problem } from "@/domain/fix-prompt"
import { useMessages } from "@/i18n"
import type { Agent, AgentRun } from "@/platform/agents-schemas"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useSystem } from "../system/store"
import { fixMessages } from "./messages"

/** The agents `fix_with_agent` can start with a prompt; Rust holds the same list. */
const STARTABLE: Record<string, string> = { claude: "claude", codex: "codex", gemini: "gemini" }

/** "Fix ›": opens the panel under the error, so the owner sees where the fix goes on. */
export function FixButton({ open, onClick, controls }: { open: boolean; onClick: () => void; controls: string }) {
  const m = useMessages(fixMessages)
  return (
    <Button size="sm" aria-expanded={open} aria-controls={controls} onClick={onClick}>
      <SquareTerminal aria-hidden className="size-4" />
      {m.fix}
      <ChevronRight
        aria-hidden
        className={cx("size-4 motion-safe:transition-transform motion-safe:duration-200", open && "rotate-90")}
      />
    </Button>
  )
}

type Run = { state: "idle" } | { state: "opening"; agent: string } | { state: "done"; run: AgentRun }

/** An agent fixes the problem from a prompt, or the owner pastes that prompt or does the fix by hand. */
export function FixPanel({ id, open, problem }: { id: string; open: boolean; problem: Problem }) {
  const m = useMessages(fixMessages)
  const os = useSystem((s) => s.readiness?.os ?? "unknown OS")
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [run, setRun] = useState<Run>({ state: "idle" })
  const prompt = fixPrompt(problem, { os, app: __APP_VERSION__ })

  useEffect(() => {
    if (!open || agents !== null) return
    platform
      .detectAgents()
      .then((all) => setAgents(all.filter((a) => STARTABLE[a.id] && a.foundBy === "program")))
      .catch(() => setAgents([]))
  }, [open, agents])

  const start = async (agent: Agent) => {
    setRun({ state: "opening", agent: agent.id })
    const result = await platform
      .fixWithAgent(agent.id, prompt)
      .catch((e): AgentRun => ({ started: false, agent: agent.id, file: "", reason: "terminal", message: String(e) }))
    setRun({ state: "done", run: result })
  }
  const nameOf = (id: string) => agents?.find((a) => a.id === id)?.name ?? id
  const failed = run.state === "done" && !run.run.started ? run.run : null

  return (
    <Collapse open={open}>
      <section id={id} aria-label={m.panel} className="mt-2 flex flex-col gap-3 rounded-[0.45rem] bg-app-2/60 p-4">
        <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{m.lead}</p>
        <div className="flex flex-wrap items-center gap-2">
          {agents === null && <span className="text-[0.9rem] text-ink-dim">{m.looking}</span>}
          {agents?.length === 0 && <span className="text-[0.9rem] text-ink-soft">{m.none}</span>}
          {agents?.map((a) => (
            <Button key={a.id} size="sm" disabled={run.state === "opening"} onClick={() => start(a)}>
              <SquareTerminal aria-hidden className="size-4" />
              {run.state === "opening" && run.agent === a.id ? m.opening : m.open(a.name)}
            </Button>
          ))}
        </div>
        <div aria-live="polite">
          <Collapse open={run.state === "done"}>
            {run.state === "done" && run.run.started && (
              <p className="flex items-start gap-2 text-[0.9rem] text-ink">
                <CheckCircle2 aria-hidden className="mt-[0.15rem] size-4 shrink-0 text-ok" />
                {m.started(nameOf(run.run.agent))}
              </p>
            )}
            {failed && (
              <ErrorNotice inline detail={failed.reason ? whyText(m, failed, nameOf(failed.agent)) : failed.message}>
                {m.failed(nameOf(failed.agent))}
              </ErrorNotice>
            )}
          </Collapse>
        </div>
        {/* Open by itself once no agent can do it, so the way that is left is on screen. */}
        <Disclosure summary={m.yourself} openWhen={Boolean(failed) || agents?.length === 0}>
          <div className="flex flex-col gap-2 pt-2">
            {problem.hint && (
              <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">
                {m.byHand} <span className="text-ink">{problem.hint}</span>
              </p>
            )}
            <p className="text-[0.9rem] text-ink-soft">{m.promptLead}</p>
            <CopyField value={prompt} label={m.prompt} wrap />
          </div>
        </Disclosure>
      </section>
    </Collapse>
  )
}

function whyText(m: (typeof fixMessages)["en"], run: AgentRun, name: string) {
  if (run.reason === "missing") return m.why.missing(name, STARTABLE[run.agent] ?? run.agent)
  if (run.reason === "automation") return m.why.automation
  return m.why.terminal
}

import { ChevronRight, SquareTerminal } from "lucide-react"
import { useState } from "react"
import { fixPrompt, type Problem } from "@/domain/fix-prompt"
import { useMessages } from "@/i18n"
import type { Agent, AgentRun } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { useSystem } from "../system/store"
import { fixMessages } from "./messages"
import { AgentRunNote, runAgent, useStartableAgents } from "./run-agent"

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
  const agents = useStartableAgents(open)
  const [run, setRun] = useState<Run>({ state: "idle" })
  const prompt = fixPrompt(problem, { os, app: __APP_VERSION__ })

  const start = async (agent: Agent) => {
    setRun({ state: "opening", agent: agent.id })
    setRun({ state: "done", run: await runAgent(agent.id, prompt) })
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
            {run.state === "done" && (
              <AgentRunNote run={run.run} name={nameOf(run.run.agent)} started={m.started(nameOf(run.run.agent))} />
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

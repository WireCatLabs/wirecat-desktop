import { Check, Copy, SquareTerminal } from "lucide-react"
import { useState } from "react"
import { AgentRunNote, runAgent, useStartableAgents } from "@/features/fix"
import { useMessages } from "@/i18n"
import type { AgentRun } from "@/platform/agents-schemas"
import type { OwnReview } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Disclosure } from "@/ui/Disclosure"
import { type OwnReviewText, ownReviewMessages } from "./messages-own-review"

export const checkPrompt = (review: OwnReview, r: OwnReviewText) =>
  r.check.prompt({
    pkg: review.package,
    version: review.version,
    tarball: review.tarball,
    integrity: review.integrity,
    repo: review.repo,
    commit: review.commit,
  })

/**
 * Offered after Add and before "Install and run": the owner's agent reads the exact package file reviewed. It opens
 * like a guide's Open in (`run_agent`), or the owner copies the prompt when no agent WireCat can start is found.
 */
export function OwnAgentCheck({ review, onRun }: { review: OwnReview; onRun(run: AgentRun | null): void }) {
  const r = useMessages(ownReviewMessages)
  const agents = useStartableAgents()
  const [run, setRun] = useState<{ agent: string; result: AgentRun | null } | null>(null)
  const [copied, setCopied] = useState(false)
  const prompt = checkPrompt(review, r)
  const open = async (id: string) => {
    setRun({ agent: id, result: null })
    const result = await runAgent(id, prompt)
    setRun({ agent: id, result })
    onRun(result)
  }
  const copy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    onRun(null)
  }
  const agent = agents?.find((a) => a.id === run?.agent)
  return (
    <div className="flex flex-col gap-3 text-[0.95rem]">
      <p>{r.check.body}</p>
      {agents !== null && agents.length === 0 && <p className="text-ink-soft">{r.check.noAgent}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {(agents ?? []).map((a, i) => (
          <Button
            key={a.id}
            variant={i === 0 ? "primary" : "secondary"}
            disabled={run !== null && run.result === null}
            onClick={() => open(a.id)}
            icon={<SquareTerminal className="size-4" aria-hidden />}
          >
            {run?.agent === a.id && !run.result ? r.check.opening : r.check.with(a.name)}
          </Button>
        ))}
        <Button
          variant={agents !== null && agents.length === 0 ? "primary" : "ghost"}
          onClick={copy}
          aria-label={r.check.copyLabel}
          icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        >
          {r.check.copy}
        </Button>
      </div>
      <div aria-live="polite">
        <Collapse open={Boolean(run?.result && agent)}>
          {run?.result && agent && (
            <AgentRunNote run={run.result} name={agent.name} started={r.check.started(agent.name)} />
          )}
        </Collapse>
      </div>
      <Disclosure summary={r.check.show}>
        <pre className="selectable max-h-56 overflow-auto whitespace-pre-wrap rounded-[0.35rem] bg-app-2 p-3 font-mono text-[0.85rem]">
          {prompt}
        </pre>
      </Disclosure>
    </div>
  )
}
